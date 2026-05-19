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

print_section "Registering strategy"

STRATEGIES_DIR="$(dirname "$TARGET_MODEL")/strategies"
mkdir -p "$STRATEGIES_DIR"

"$PYTHON" - "$TARGET_SCHEMA" "$TARGET_METRICS" "$STRATEGIES_DIR" <<'PY'
import json
import re
import sys
from datetime import datetime, timezone
from pathlib import Path

schema_path, metrics_path, strategies_dir = sys.argv[1:]

with open(schema_path, "r", encoding="utf-8") as f:
    schema = json.load(f)
with open(metrics_path, "r", encoding="utf-8") as f:
    metrics = json.load(f)

trained_on = schema.get("trainedOn", "")
model_id = schema.get("modelId", "")
training_files = schema.get("trainingDataFiles", [])
training_file_count = len(training_files)

# Timestamp from trainedOn
try:
    dt = datetime.fromisoformat(trained_on.replace("Z", "+00:00")).astimezone(timezone.utc)
    date_label = dt.strftime("%Y-%m-%d %H:%M")
    date_key = dt.strftime("%Y%m%d-%H%M%S")
    file_ts = dt.strftime("%Y%m%d_%H%M%S")
except Exception:
    date_label = trained_on[:16] if trained_on else "unbekannt"
    date_key = re.sub(r"[^0-9]", "", trained_on[:15]) if trained_on else "0"
    file_ts = date_key

# Short id suffix from modelId (last 6 hex chars)
suffix_match = re.search(r"([0-9a-f]{6})$", model_id)
suffix = suffix_match.group(1) if suffix_match else model_id[-6:] if len(model_id) >= 6 else model_id

file_base = f"xgb_{file_ts}_{suffix}"
model_file_rel = f"strategies/{file_base}.onnx"
schema_file_rel = f"strategies/{file_base}.schema.json"
strategy_model = str(Path(strategies_dir) / f"{file_base}.onnx")
strategy_schema = str(Path(strategies_dir) / f"{file_base}.schema.json")

# Copy model + schema into strategies/
import shutil
shutil.copy2(schema_path, strategy_schema)
# onnx path: replace .schema.json with .onnx in source path
onnx_src = schema_path.replace(".schema.json", ".onnx")
shutil.copy2(onnx_src, strategy_model)

# Metrics
pp = metrics.get("peak_picking") or {}
ts_sel = metrics.get("threshold_selection") or {}
hp = (ts_sel.get("hyperparameter_tuning") or {}).get("params", {}) if isinstance(ts_sel, dict) else {}

def fnum(v, digits=4):
    if v is None:
        return "?"
    if isinstance(v, int):
        return str(v)
    return f"{v:.{digits}f}".rstrip("0").rstrip(".")

peak_f1 = round(pp.get("f1") or 0, 4)
peak_prec = round(pp.get("precision") or 0, 4)
peak_rec = round(pp.get("recall") or 0, 4)
threshold = round(metrics.get("threshold") or 0, 4)
depth = hp.get("max_depth", "?")
lr = hp.get("learning_rate", "?")
est = hp.get("n_estimators", "?")

key = f"xgboost-{date_key}"
label = f"XGB {date_label}"
description = (
    f"XGBoost Android-Firefox, trainiert {date_label}. "
    f"Peak F1 {fnum(peak_f1)}, Precision {fnum(peak_prec)}, Recall {fnum(peak_rec)}. "
    f"Threshold {fnum(threshold)}. {training_file_count} Trainingsdateien. "
    f"depth={depth} lr={fnum(lr)} est={est}."
)

registry_path = Path(strategies_dir) / "registry.json"
if registry_path.exists():
    with open(registry_path, "r", encoding="utf-8") as f:
        registry = json.load(f)
else:
    registry = {"version": 1, "strategies": []}

# Deduplicate by key
if any(s["key"] == key for s in registry["strategies"]):
    print(f"  Strategie {key!r} bereits in Registry, kein Duplikat.")
    sys.exit(0)

new_entry = {
    "key": key,
    "label": label,
    "description": description,
    "modelFile": model_file_rel,
    "schemaFile": schema_file_rel,
    "trainedOn": trained_on,
    "trainingFileCount": training_file_count,
    "peakF1": peak_f1,
    "peakPrecision": peak_prec,
    "peakRecall": peak_rec,
    "threshold": threshold,
}

registry["strategies"].append(new_entry)

MAX_STRATEGIES = 7
while len(registry["strategies"]) > MAX_STRATEGIES:
    removed = registry["strategies"].pop(0)
    # Also remove the model files of the evicted strategy
    for field in ("modelFile", "schemaFile"):
        old_file = Path(strategies_dir).parent / removed.get(field, "")
        if old_file.exists():
            old_file.unlink()
    print(f"  Aelteste Strategie entfernt: {removed['key']}")

with open(registry_path, "w", encoding="utf-8") as f:
    json.dump(registry, f, indent=2, ensure_ascii=False)
    f.write("\n")

print(f"  Strategie registriert: {key!r}")
print(f"  Label:                 {label}")
print(f"  Registry:              {len(registry['strategies'])}/{MAX_STRATEGIES} Strategien")
print(f"  Modell:                {strategy_model}")
PY
