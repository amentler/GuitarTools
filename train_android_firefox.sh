#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")"

if [[ "${1:-}" == "-h" || "${1:-}" == "--help" ]]; then
  cat <<'EOF'
Usage: ./train_android_firefox.sh

Environment overrides:
  PYTHON=...       Python executable to use, e.g. .venv/bin/python
  DATA_DIR=...     Training JSON directory. If unset, choose from the menu.
  BASE_CONFIG=...  Base YAML config, default: ml/training_config.yaml
  PATHS_TEMPLATE=... Paths template, default: ml/training_config.android_firefox.paths.template.yaml
  RUN_NAME=...     Output filename suffix, default: android_firefox
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

TRAINING_DATA_DIRS=(
  "ml/data/android_firefox"
  "training_data/android_firefox"
)

BASE_CONFIG="${BASE_CONFIG:-ml/training_config.yaml}"
PATHS_TEMPLATE="${PATHS_TEMPLATE:-ml/training_config.android_firefox.paths.template.yaml}"
RUN_NAME="${RUN_NAME:-android_firefox}"
OUT_DIR="${OUT_DIR:-models}"
PYTHON="$(resolve_python)"
SELECTED_DATA_DIR=""
TRAINING_PIP_PACKAGES=(
  "numpy"
  "pyyaml"
  "xgboost<3"
  "scikit-learn"
  "onnxmltools"
  "onnx"
  "packaging"
)

select_training_data_dir() {
  if [[ -n "${DATA_DIR:-}" ]]; then
    SELECTED_DATA_DIR="$DATA_DIR"
    return
  fi

  echo "Training data directories:"
  local index
  for index in "${!TRAINING_DATA_DIRS[@]}"; do
    printf '  %d) %s\n' "$((index + 1))" "${TRAINING_DATA_DIRS[$index]}"
  done

  local choice
  while true; do
    read -r -p "Select training data directory [1-${#TRAINING_DATA_DIRS[@]}]: " choice
    if [[ "$choice" =~ ^[0-9]+$ ]] && (( choice >= 1 && choice <= ${#TRAINING_DATA_DIRS[@]} )); then
      SELECTED_DATA_DIR="${TRAINING_DATA_DIRS[$((choice - 1))]}"
      return
    fi
    echo "Please enter a number from 1 to ${#TRAINING_DATA_DIRS[@]}." >&2
  done
}

select_training_data_dir
DATA_DIR="$SELECTED_DATA_DIR"

if [[ ! -d "$DATA_DIR" ]]; then
  echo "ERROR: training data directory not found: $DATA_DIR" >&2
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

echo
echo "Selected training data directory: $DATA_DIR"
echo "Directory content:"
find "$DATA_DIR" -maxdepth 1 -mindepth 1 -printf '  %f\n' | sort
echo

if ! compgen -G "$DATA_DIR/training_data_*.json" >/dev/null; then
  echo "ERROR: no training_data_*.json files found in $DATA_DIR" >&2
  exit 1
fi

read -r -p "Use only this directory for training and continue? [y/N]: " confirm
case "$confirm" in
  [yY]|[yY][eE][sS]|[jJ]|[jJ][aA]) ;;
  *)
    echo "Training aborted."
    exit 0
    ;;
esac

echo "Python:        $PYTHON"

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
  echo "Installing missing Python training dependencies into: $PYTHON"
  "$PYTHON" -m pip install "${TRAINING_PIP_PACKAGES[@]}"
  check_training_dependencies
fi

tmp_config="$(mktemp)"
cleanup() {
  rm -f "$tmp_config"
}
trap cleanup EXIT

"$PYTHON" - "$BASE_CONFIG" "$PATHS_TEMPLATE" "$tmp_config" "$DATA_DIR" "$OUT_DIR" "$RUN_NAME" <<'PY'
import json
import sys
from pathlib import Path

import yaml

base_config, paths_template, output_config, data_dir, out_dir, run_name = sys.argv[1:]

with open(base_config, "r", encoding="utf-8") as handle:
    cfg = yaml.safe_load(handle)

with open(paths_template, "r", encoding="utf-8") as handle:
    rendered_paths = handle.read()

template_values = {
    "DATA_DIR": data_dir,
    "OUTPUT_MODEL": str(Path(out_dir) / f"onset_detector_{run_name}.onnx"),
    "OUTPUT_SCHEMA": str(Path(out_dir) / f"onset_detector_{run_name}.schema.json"),
    "OUTPUT_METRICS": str(Path(out_dir) / f"onset_detector_{run_name}.metrics.json"),
}

for key, value in template_values.items():
    rendered_paths = rendered_paths.replace(f"{{{{{key}}}}}", json.dumps(value))

paths_cfg = yaml.safe_load(rendered_paths)
cfg["paths"] = paths_cfg["paths"]

with open(output_config, "w", encoding="utf-8") as handle:
    yaml.safe_dump(cfg, handle, sort_keys=False)
PY

echo "Training data: $DATA_DIR"
echo "Run name:      $RUN_NAME"
echo "Outputs:       $OUT_DIR/onset_detector_${RUN_NAME}.{onnx,schema.json,metrics.json}"
echo

"$PYTHON" ml/train_onset_detector.py --config "$tmp_config"
