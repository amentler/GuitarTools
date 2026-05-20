#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")"

if [[ "${1:-}" == "-h" || "${1:-}" == "--help" ]]; then
  cat <<'EOF'
Usage: ./train_android_firefox.sh

Trains the Android-Firefox onset detector from:
  tagged WAV/JSON ZIPs in tests/fixtures/sequences/sheet-music-reading

Candidate outputs:
  models/onset_detector_android_firefox_candidate.onnx
  models/onset_detector_android_firefox_candidate.schema.json
  models/onset_detector_android_firefox_candidate.metrics.json

Environment overrides:
  PYTHON=...       Python executable to use, e.g. .venv/bin/python
  TRAINING_MEDIA_DIR=...
                  Tagged ZIP/WAV source directory, default:
                  tests/fixtures/sequences/sheet-music-reading
  BASE_CONFIG=...  Base YAML config, default: ml/training_config.yaml
  PATHS_TEMPLATE=...
                  Paths template, default:
                  ml/training_config.android_firefox.paths.template.yaml
  OUT_DIR=...      Output directory, default: models

The base config requests XGBoost CUDA training and falls back to CPU if the
container/WSL GPU runtime is not available. Missing Python training
dependencies are installed automatically into the selected Python environment.
EOF
  exit 0
fi

resolve_python() {
  if [[ -n "${PYTHON:-}" ]]; then
    echo "$PYTHON"
  elif [[ -n "${VIRTUAL_ENV:-}" && -x "$VIRTUAL_ENV/bin/python" ]]; then
    echo "$VIRTUAL_ENV/bin/python"
  elif [[ -x ".venv/bin/python" ]]; then
    echo ".venv/bin/python"
  else
    echo "python3"
  fi
}

print_section() {
  printf '\n== %s ==\n' "$1"
}

print_kv() {
  printf '  %-16s %s\n' "$1:" "$2"
}

print_metrics_summary() {
  local metrics_file="$1"
  "$PYTHON" - "$metrics_file" <<'PY'
import json
import sys

metrics_path = sys.argv[1]

with open(metrics_path, "r", encoding="utf-8") as handle:
    metrics = json.load(handle)


def value(path, default=None):
    current = metrics
    for part in path:
        if not isinstance(current, dict) or part not in current:
            return default
        current = current[part]
    return current


def fmt_number(raw):
    if raw is None:
        return "n/a"
    if isinstance(raw, int):
        return str(raw)
    if isinstance(raw, float):
        return f"{raw:.4f}".rstrip("0").rstrip(".")
    return str(raw)


def line(label, raw):
    print(f"  {label + ':':<16} {fmt_number(raw)}")


peak_cm = value(["peak_picking", "confusion_matrix"], {}) or {}
selection = value(["threshold_selection"], {}) or {}
tuning = selection.get("hyperparameter_tuning") if isinstance(selection, dict) else None
params = tuning.get("params", {}) if isinstance(tuning, dict) else {}

line("threshold", metrics.get("threshold"))
line("frame precision", metrics.get("precision"))
line("frame recall", metrics.get("recall"))
line("frame f1", metrics.get("f1"))
line("roc auc", metrics.get("roc_auc"))
line("pr auc", metrics.get("pr_auc"))
print()
line("peak threshold", value(["peak_picking", "threshold"]))
line("peak precision", value(["peak_picking", "precision"]))
line("peak recall", value(["peak_picking", "recall"]))
line("peak f1", value(["peak_picking", "f1"]))
line("peak tp", peak_cm.get("true_positives"))
line("peak fp", peak_cm.get("false_positives"))
line("peak fn", peak_cm.get("false_negatives"))
print()
line("val mode", selection.get("mode"))
line("val threshold", selection.get("selected_threshold"))
line("val precision", selection.get("validation_peak_precision"))
line("val recall", selection.get("validation_peak_recall"))
line("val f beta", selection.get("validation_peak_f_beta"))

if params:
    print()
    for key in (
        "max_depth",
        "min_child_weight",
        "learning_rate",
        "n_estimators",
        "subsample",
        "colsample_bytree",
        "gamma",
        "reg_alpha",
        "reg_lambda",
        "scale_pos_weight_multiplier",
        "max_delta_step",
        "negative_sampling_ratio",
        "lookahead_frames",
    ):
        if key in params:
            line(key.replace("_", " "), params[key])
PY
}

TRAINING_MEDIA_DIR="${TRAINING_MEDIA_DIR:-tests/fixtures/sequences/sheet-music-reading}"
DATA_DIR="$(mktemp -d "${TMPDIR:-/tmp}/android-firefox-training-data.XXXXXX")"
generation_log=""
tmp_config=""
training_log=""
cleanup() {
  [[ -n "$generation_log" ]] && rm -f "$generation_log"
  [[ -n "$tmp_config" ]] && rm -f "$tmp_config"
  rm -rf "$DATA_DIR"
}
trap cleanup EXIT
BASE_CONFIG="${BASE_CONFIG:-ml/training_config.yaml}"
PATHS_TEMPLATE="${PATHS_TEMPLATE:-ml/training_config.android_firefox.paths.template.yaml}"
OUT_DIR="${OUT_DIR:-models}"
RUN_NAME="android_firefox_candidate"
PYTHON="$(resolve_python)"
CANDIDATE_PREFIX="$OUT_DIR/onset_detector_${RUN_NAME}"
CANDIDATE_MODEL="$CANDIDATE_PREFIX.onnx"
CANDIDATE_SCHEMA="$CANDIDATE_PREFIX.schema.json"
CANDIDATE_METRICS="$CANDIDATE_PREFIX.metrics.json"
TRAINING_PIP_PACKAGES=(
  "numpy"
  "pyyaml"
  "xgboost<3"
  "scikit-learn"
  "onnxmltools"
  "onnx"
  "packaging"
)

if [[ ! -d "$TRAINING_MEDIA_DIR" ]]; then
  echo "ERROR: training media directory not found: $TRAINING_MEDIA_DIR" >&2
  exit 1
fi

if [[ ! -f "$BASE_CONFIG" ]]; then
  echo "ERROR: base config not found: $BASE_CONFIG" >&2
  exit 1
fi

if [[ ! -f "$PATHS_TEMPLATE" ]]; then
  echo "ERROR: paths template not found: $PATHS_TEMPLATE" >&2
  exit 1
fi

print_section "Generating training data"
print_kv "media" "$TRAINING_MEDIA_DIR"
print_kv "target" "$DATA_DIR"

generation_log="$(mktemp "${TMPDIR:-/tmp}/android-firefox-training-data.XXXXXX.log")"
if ! node scripts/generate-xgboost-training-data-from-media.mjs \
  --media-dir "$TRAINING_MEDIA_DIR" \
  --output-dir "$DATA_DIR" \
  --clean >"$generation_log" 2>&1; then
  echo "ERROR: training data generation failed. Last log lines:" >&2
  tail -n 40 "$generation_log" >&2
  echo "Full log: $generation_log" >&2
  exit 1
fi

if ! compgen -G "$DATA_DIR/training_data_*.json" >/dev/null; then
  echo "ERROR: no generated training_data_*.json files found in $DATA_DIR" >&2
  echo "Generation log: $generation_log" >&2
  exit 1
fi

tail -n 1 "$generation_log"
rm -f "$generation_log"
generation_log=""

JSON_FILE_COUNT="$(find "$DATA_DIR" -maxdepth 1 -name 'training_data_*.json' | wc -l | tr -d ' ')"

print_section "Android-Firefox onset training"
print_kv "media" "$TRAINING_MEDIA_DIR"
print_kv "data" "$DATA_DIR"
print_kv "python" "$PYTHON"
print_kv "config" "$BASE_CONFIG"
print_kv "model" "$CANDIDATE_MODEL"
print_kv "schema" "$CANDIDATE_SCHEMA"
print_kv "metrics" "$CANDIDATE_METRICS"
print_kv "json files" "$JSON_FILE_COUNT"

check_training_dependencies() {
  "$PYTHON" - <<'PY'
import importlib
import sys

packages = {
    "numpy": "numpy",
    "yaml": "pyyaml",
    "xgboost": "xgboost",
    "sklearn": "scikit-learn",
    "onnxmltools": "onnxmltools",
    "onnx": "onnx",
    "packaging": "packaging",
}

missing = []
for module, package in packages.items():
    try:
        importlib.import_module(module)
    except ImportError as exc:
        missing.append((package, module, str(exc)))

if missing:
    print(
        "ERROR: missing Python training dependencies: "
        + ", ".join(package for package, _, _ in missing),
        file=sys.stderr,
    )
    for package, module, detail in missing:
        print(f"  {module} ({package}): {detail}", file=sys.stderr)
    sys.exit(1)
PY
}

if ! check_training_dependencies; then
  print_section "Installing dependencies"
  print_kv "target" "$PYTHON"
  "$PYTHON" -m pip install "${TRAINING_PIP_PACKAGES[@]}"
  check_training_dependencies
fi

tmp_config="$(mktemp)"
training_log="$(mktemp "${TMPDIR:-/tmp}/android-firefox-training.XXXXXX.log")"

awk '
  /^paths:/ { skip = 1 }
  skip == 0 { print }
' "$BASE_CONFIG" >"$tmp_config"
sed \
  -e "s|{{DATA_DIR}}|\"$DATA_DIR\"|g" \
  -e "s|{{OUTPUT_MODEL}}|\"$CANDIDATE_MODEL\"|g" \
  -e "s|{{OUTPUT_SCHEMA}}|\"$CANDIDATE_SCHEMA\"|g" \
  -e "s|{{OUTPUT_METRICS}}|\"$CANDIDATE_METRICS\"|g" \
  "$PATHS_TEMPLATE" >>"$tmp_config"

print_section "Training"
print_kv "log" "$training_log"

if ! "$PYTHON" ml/train_onset_detector.py --config "$tmp_config" >"$training_log" 2>&1; then
  echo "ERROR: training failed. Last log lines:" >&2
  tail -n 40 "$training_log" >&2
  echo "Full log: $training_log" >&2
  exit 1
fi

if [[ ! -s "$CANDIDATE_MODEL" || ! -s "$CANDIDATE_SCHEMA" || ! -s "$CANDIDATE_METRICS" ]]; then
  echo "ERROR: training did not write all candidate outputs." >&2
  echo "Expected prefix: $CANDIDATE_PREFIX" >&2
  echo "Full log: $training_log" >&2
  exit 1
fi

rm -f "$training_log"

print_section "Candidate outputs"
print_kv "model" "$CANDIDATE_MODEL"
print_kv "schema" "$CANDIDATE_SCHEMA"
print_kv "metrics" "$CANDIDATE_METRICS"

print_section "Best values"
print_metrics_summary "$CANDIDATE_METRICS"

printf '\nApply candidate to production? [y/N]: '
read -r apply_candidate
case "$apply_candidate" in
  [yY]|[yY][eE][sS]|[jJ]|[jJ][aA])
    ./apply_android_firefox_onset_detector.sh
    ;;
  *)
    print_section "Done"
    print_kv "status" "candidate kept, production unchanged"
    ;;
esac
