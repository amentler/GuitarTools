#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")"

if [[ "${1:-}" == "-h" || "${1:-}" == "--help" ]]; then
  cat <<'EOF'
Usage: ./apply_android_firefox_onset_detector.sh

Copies the Android-Firefox onset detector candidate into production.

Environment overrides:
  PYTHON=...          Python executable to use, e.g. .venv/bin/python
  SOURCE_PREFIX=...   Default: models/onset_detector_android_firefox_candidate
  TARGET_PREFIX=...   Default: models/onset_detector_android_firefox
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
    ):
        if key in params:
            line(key.replace("_", " "), params[key])
PY
}

PYTHON="$(resolve_python)"
SOURCE_PREFIX="${SOURCE_PREFIX:-models/onset_detector_android_firefox_candidate}"
TARGET_PREFIX="${TARGET_PREFIX:-models/onset_detector_android_firefox}"

SOURCE_MODEL="$SOURCE_PREFIX.onnx"
SOURCE_SCHEMA="$SOURCE_PREFIX.schema.json"
SOURCE_METRICS="$SOURCE_PREFIX.metrics.json"
TARGET_MODEL="$TARGET_PREFIX.onnx"
TARGET_SCHEMA="$TARGET_PREFIX.schema.json"
TARGET_METRICS="$TARGET_PREFIX.metrics.json"

print_section "Apply Android-Firefox onset detector"
print_kv "source model" "$SOURCE_MODEL"
print_kv "source schema" "$SOURCE_SCHEMA"
print_kv "source metrics" "$SOURCE_METRICS"
print_kv "target model" "$TARGET_MODEL"
print_kv "target schema" "$TARGET_SCHEMA"
print_kv "target metrics" "$TARGET_METRICS"

for file in "$SOURCE_MODEL" "$SOURCE_SCHEMA" "$SOURCE_METRICS"; do
  if [[ ! -s "$file" ]]; then
    echo "ERROR: missing or empty candidate file: $file" >&2
    exit 1
  fi
done

"$PYTHON" - "$SOURCE_SCHEMA" "$SOURCE_METRICS" <<'PY'
import json
import sys

for path in sys.argv[1:]:
    with open(path, "r", encoding="utf-8") as handle:
        json.load(handle)
PY

mkdir -p "$(dirname "$TARGET_MODEL")"
cp "$SOURCE_MODEL" "$TARGET_MODEL"
cp "$SOURCE_SCHEMA" "$TARGET_SCHEMA"
cp "$SOURCE_METRICS" "$TARGET_METRICS"

print_section "Applied"
print_kv "model" "$TARGET_MODEL"
print_kv "schema" "$TARGET_SCHEMA"
print_kv "metrics" "$TARGET_METRICS"

print_section "Production values"
print_metrics_summary "$TARGET_METRICS"
