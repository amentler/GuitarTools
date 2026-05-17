#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")"

if [[ "${1:-}" == "-h" || "${1:-}" == "--help" ]]; then
  cat <<'EOF'
Usage: ./train_android_firefox.sh

Environment overrides:
  PYTHON=...       Python executable to use, e.g. .venv/bin/python
  DATA_DIR=...     Training JSON directory, default: training_data/android_firefox
  BASE_CONFIG=...  Base YAML config, default: ml/training_config.yaml
  RUN_NAME=...     Output filename suffix, default: android_firefox
  OUT_DIR=...      Output directory, default: models
EOF
  exit 0
fi

DATA_DIR="${DATA_DIR:-training_data/android_firefox}"
BASE_CONFIG="${BASE_CONFIG:-ml/training_config.yaml}"
RUN_NAME="${RUN_NAME:-android_firefox}"
OUT_DIR="${OUT_DIR:-models}"
PYTHON="${PYTHON:-python3}"

if [[ ! -d "$DATA_DIR" ]]; then
  echo "ERROR: training data directory not found: $DATA_DIR" >&2
  exit 1
fi

if ! compgen -G "$DATA_DIR/training_data_*.json" >/dev/null; then
  echo "ERROR: no training_data_*.json files found in $DATA_DIR" >&2
  exit 1
fi

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
    except ImportError:
        missing.append(package)

if missing:
    print("ERROR: missing Python training dependencies: " + ", ".join(missing), file=sys.stderr)
    print("Install them, for example:", file=sys.stderr)
    print("  python3 -m venv .venv", file=sys.stderr)
    print("  . .venv/bin/activate", file=sys.stderr)
    print("  pip install numpy pyyaml 'xgboost<3' scikit-learn onnxmltools onnx packaging", file=sys.stderr)
    print("Then run with: PYTHON=.venv/bin/python ./train_android_firefox.sh", file=sys.stderr)
    sys.exit(1)
PY

tmp_config="$(mktemp)"
cleanup() {
  rm -f "$tmp_config"
}
trap cleanup EXIT

"$PYTHON" - "$BASE_CONFIG" "$tmp_config" "$DATA_DIR" "$OUT_DIR" "$RUN_NAME" <<'PY'
import sys
from pathlib import Path

import yaml

base_config, output_config, data_dir, out_dir, run_name = sys.argv[1:]

with open(base_config, "r", encoding="utf-8") as handle:
    cfg = yaml.safe_load(handle)

paths = cfg.setdefault("paths", {})
paths["training_data_dir"] = data_dir
paths["output_model"] = str(Path(out_dir) / f"onset_detector_{run_name}.onnx")
paths["output_schema"] = str(Path(out_dir) / f"onset_detector_{run_name}.schema.json")
paths["output_metrics"] = str(Path(out_dir) / f"onset_detector_{run_name}.metrics.json")

with open(output_config, "w", encoding="utf-8") as handle:
    yaml.safe_dump(cfg, handle, sort_keys=False)
PY

echo "Training data: $DATA_DIR"
echo "Run name:      $RUN_NAME"
echo "Outputs:       $OUT_DIR/onset_detector_${RUN_NAME}.{onnx,schema.json,metrics.json}"
echo

"$PYTHON" ml/train_onset_detector.py --config "$tmp_config"
