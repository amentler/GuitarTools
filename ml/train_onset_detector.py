#!/usr/bin/env python3
"""
train_onset_detector.py

Trains an XGBoost onset detector from GuitarTools training data JSON files,
then exports the model to ONNX and saves a model_schema.json.

Usage:
    python train_onset_detector.py [--config training_config.yaml]

Dependencies:
    pip install xgboost scikit-learn onnxmltools onnx pyyaml numpy
"""

import argparse
import json
import os
import sys
import uuid
import warnings
from datetime import datetime, timezone
from pathlib import Path

import numpy as np
import yaml

try:
    import xgboost as xgb
except ImportError:
    sys.exit("ERROR: xgboost is not installed. Run: pip install xgboost")

try:
    from sklearn.preprocessing import StandardScaler
    from sklearn.metrics import (
        precision_score,
        recall_score,
        f1_score,
        roc_auc_score,
        average_precision_score,
        confusion_matrix,
    )
except ImportError:
    sys.exit("ERROR: scikit-learn is not installed. Run: pip install scikit-learn")

try:
    import onnxmltools
    from onnxmltools.convert import convert_xgboost
    from onnxmltools.convert.common.data_types import FloatTensorType
    import onnx
except ImportError:
    sys.exit("ERROR: onnxmltools/onnx not installed. Run: pip install onnxmltools onnx")


# ---------------------------------------------------------------------------
# Config loading
# ---------------------------------------------------------------------------

def load_config(config_path: str) -> dict:
    with open(config_path, "r") as f:
        return yaml.safe_load(f)


# ---------------------------------------------------------------------------
# Data loading
# ---------------------------------------------------------------------------

SUPPORTED_SCHEMA_VERSION = 1


def load_training_files(data_dir: str, feature_names: list[str], positive_window_ms: float):
    """
    Load all training JSON files from data_dir.
    Returns (file_features, file_labels, file_names, audio_config_sample).

    file_features[i]  = np.ndarray of shape (n_frames_i, n_features)
    file_labels[i]    = np.ndarray of shape (n_frames_i,) with 0/1
    """
    data_dir = Path(data_dir)
    json_files = sorted(data_dir.glob("training_data_*.json"))
    if not json_files:
        sys.exit(f"ERROR: No training_data_*.json files found in {data_dir}")

    file_features = []
    file_labels = []
    file_names = []
    audio_config_sample = None
    n_skipped = 0

    for path in json_files:
        with open(path, "r") as f:
            data = json.load(f)

        # schema version check
        schema_version = data.get("schemaVersion")
        if schema_version != SUPPORTED_SCHEMA_VERSION:
            warnings.warn(
                f"[SKIP] {path.name}: unsupported schemaVersion={schema_version!r} "
                f"(expected {SUPPORTED_SCHEMA_VERSION})"
            )
            n_skipped += 1
            continue

        # annotations check
        onsets_ms = data.get("annotations", {}).get("onsetsMs")
        if not isinstance(onsets_ms, list) or len(onsets_ms) == 0:
            warnings.warn(f"[SKIP] {path.name}: no annotations.onsetsMs")
            n_skipped += 1
            continue

        meta = data.get("metadata", {})
        actual_fft = meta.get("fftSize")
        requested_fft = meta.get("requestedFftSize")
        collect_path = meta.get("collectFrameDataPath")

        if requested_fft and actual_fft and requested_fft != actual_fft:
            warnings.warn(f"[WARN] {path.name}: requestedFftSize={requested_fft} != actualFftSize={actual_fft}")
        if collect_path == "js-fft-fallback":
            warnings.warn(f"[WARN] {path.name}: used js-fft-fallback path (lower precision)")

        if audio_config_sample is None:
            audio_config_sample = {
                "sampleRate": meta.get("sampleRate"),
                "fftSize":    actual_fft,
                "hopSize":    meta.get("hopSize"),
            }
        else:
            # Warn on mismatch across files
            for key in ("sampleRate", "fftSize", "hopSize"):
                val = meta.get(key)
                ref = audio_config_sample.get(key)
                if val and ref and val != ref:
                    warnings.warn(f"[WARN] {path.name}: {key}={val} differs from reference {ref}")

        frames = data.get("frames", [])
        if not frames:
            warnings.warn(f"[SKIP] {path.name}: no frames")
            n_skipped += 1
            continue

        # Build feature matrix
        rows = []
        missing_features = set()
        for frame in frames:
            feats = frame.get("features", {})
            row = []
            for feat_name in feature_names:
                if feat_name not in feats:
                    missing_features.add(feat_name)
                    row.append(0.0)
                else:
                    row.append(float(feats[feat_name]))
            rows.append(row)

        if missing_features:
            sys.exit(
                f"ERROR: {path.name} is missing required features: "
                + ", ".join(sorted(missing_features))
            )

        # Build labels
        onsets_set = set(onsets_ms)
        labels = []
        for frame in frames:
            t_ms = frame.get("t", 0) * 1000  # frame.t is in seconds
            label = 0
            for onset in onsets_ms:
                if abs(t_ms - onset) <= positive_window_ms:
                    label = 1
                    break
            labels.append(label)

        X = np.array(rows, dtype=np.float32)
        y = np.array(labels, dtype=np.int32)

        file_features.append(X)
        file_labels.append(y)
        file_names.append(path.name)
        print(
            f"  Loaded {path.name}: {len(frames)} frames, "
            f"{y.sum()} positives ({100 * y.mean():.1f}%)"
        )

    if n_skipped:
        print(f"  Skipped {n_skipped} file(s).")
    if not file_features:
        sys.exit("ERROR: No usable training files after filtering.")

    return file_features, file_labels, file_names, audio_config_sample


# ---------------------------------------------------------------------------
# Train/test split by file
# ---------------------------------------------------------------------------

def split_by_file(
    file_features: list,
    file_labels: list,
    file_names: list,
    test_split: float,
    val_split: float,
    random_state: int,
):
    """
    Splits file-level. Returns (X_train, y_train, X_val, y_val, X_test, y_test).
    split_mode: by_file — no frame-level random split.
    """
    rng = np.random.RandomState(random_state)
    n = len(file_features)
    indices = rng.permutation(n)

    n_test = max(1, int(n * test_split))
    n_val  = max(1, int(n * val_split))
    n_train = n - n_test - n_val

    if n_train <= 0:
        sys.exit(
            f"ERROR: Not enough files for split. Have {n}, need at least "
            f"{n_test + n_val + 1}. Add more training data or lower test/val split."
        )

    train_idx = indices[:n_train]
    val_idx   = indices[n_train:n_train + n_val]
    test_idx  = indices[n_train + n_val:]

    def concat(idxs):
        X = np.concatenate([file_features[i] for i in idxs], axis=0)
        y = np.concatenate([file_labels[i]   for i in idxs], axis=0)
        return X, y

    X_train, y_train = concat(train_idx)
    X_val,   y_val   = concat(val_idx)
    X_test,  y_test  = concat(test_idx)

    print(
        f"  Split: train={len(train_idx)} files ({len(y_train)} frames), "
        f"val={len(val_idx)} files ({len(y_val)} frames), "
        f"test={len(test_idx)} files ({len(y_test)} frames)"
    )
    return X_train, y_train, X_val, y_val, X_test, y_test


# ---------------------------------------------------------------------------
# Negative sampling
# ---------------------------------------------------------------------------

def apply_negative_sampling(
    X: np.ndarray,
    y: np.ndarray,
    ratio: float,
    random_state: int,
) -> tuple[np.ndarray, np.ndarray]:
    rng = np.random.RandomState(random_state)
    pos_idx = np.where(y == 1)[0]
    neg_idx = np.where(y == 0)[0]

    n_pos = len(pos_idx)
    n_neg_target = int(n_pos * ratio)
    if n_neg_target < len(neg_idx):
        neg_idx = rng.choice(neg_idx, n_neg_target, replace=False)

    keep = np.concatenate([pos_idx, neg_idx])
    keep.sort()
    print(
        f"  After negative sampling: {n_pos} positives, "
        f"{len(neg_idx)} negatives (ratio {len(neg_idx) / max(n_pos, 1):.1f}x)"
    )
    return X[keep], y[keep]


# ---------------------------------------------------------------------------
# Training
# ---------------------------------------------------------------------------

def train_model(
    X_train, y_train,
    X_val, y_val,
    cfg: dict,
    feature_names: list[str],
    random_state: int,
) -> xgb.XGBClassifier:
    xgb_cfg = cfg.get("xgboost", {})

    # scale_pos_weight
    spw = xgb_cfg.get("scale_pos_weight", "auto")
    if spw == "auto":
        n_neg = int((y_train == 0).sum())
        n_pos = int((y_train == 1).sum())
        spw = n_neg / max(n_pos, 1)
        print(f"  scale_pos_weight (auto): {spw:.2f}")

    model = xgb.XGBClassifier(
        max_depth=           xgb_cfg.get("max_depth", 5),
        min_child_weight=    xgb_cfg.get("min_child_weight", 5),
        learning_rate=       xgb_cfg.get("learning_rate", 0.03),
        n_estimators=        xgb_cfg.get("n_estimators", 300),
        subsample=           xgb_cfg.get("subsample", 0.8),
        colsample_bytree=    xgb_cfg.get("colsample_bytree", 0.8),
        gamma=               xgb_cfg.get("gamma", 0.3),
        reg_alpha=           xgb_cfg.get("reg_alpha", 0.05),
        reg_lambda=          xgb_cfg.get("reg_lambda", 1.5),
        scale_pos_weight=    spw,
        objective=           "binary:logistic",
        eval_metric=         "aucpr",
        random_state=        random_state,
        n_jobs=              -1,
        tree_method=         "hist",
        early_stopping_rounds= cfg.get("training", {}).get("early_stopping_rounds", 20),
        verbosity=           1,
    )

    model.fit(
        X_train, y_train,
        eval_set=[(X_val, y_val)],
        verbose=False,
    )
    print(f"  Best iteration: {model.best_iteration}")
    return model


# ---------------------------------------------------------------------------
# Metrics
# ---------------------------------------------------------------------------

def compute_metrics(model, X_test, y_test, threshold: float = 0.5) -> dict:
    y_prob = model.predict_proba(X_test)[:, 1]
    y_pred = (y_prob >= threshold).astype(int)

    prec  = precision_score(y_test, y_pred, zero_division=0)
    rec   = recall_score(y_test, y_pred, zero_division=0)
    f1    = f1_score(y_test, y_pred, zero_division=0)
    roc   = roc_auc_score(y_test, y_prob) if y_test.sum() > 0 else 0.0
    pr    = average_precision_score(y_test, y_prob) if y_test.sum() > 0 else 0.0
    cm    = confusion_matrix(y_test, y_pred).tolist()

    metrics = {
        "threshold":   threshold,
        "precision":   round(prec, 4),
        "recall":      round(rec, 4),
        "f1":          round(f1, 4),
        "roc_auc":     round(roc, 4),
        "pr_auc":      round(pr, 4),
        "confusion_matrix": cm,
        "test_positives":   int(y_test.sum()),
        "test_negatives":   int((y_test == 0).sum()),
    }
    print(
        f"\n  Test metrics (threshold={threshold}):\n"
        f"    Precision={prec:.4f}  Recall={rec:.4f}  F1={f1:.4f}\n"
        f"    ROC-AUC={roc:.4f}  PR-AUC={pr:.4f}\n"
        f"    Confusion Matrix: {cm}"
    )
    return metrics


# ---------------------------------------------------------------------------
# ONNX export
# ---------------------------------------------------------------------------

def export_onnx(model: xgb.XGBClassifier, n_features: int, output_path: str) -> str:
    """Export model to ONNX and return the detected output name."""
    os.makedirs(os.path.dirname(output_path) or ".", exist_ok=True)
    onnx_model = convert_xgboost(
        model,
        initial_types=[("input", FloatTensorType([None, n_features]))],
    )
    onnxmltools.utils.save_model(onnx_model, output_path)

    # Detect output name
    loaded = onnx.load(output_path)
    output_name = loaded.graph.output[0].name
    print(f"  ONNX model saved: {output_path}")
    print(f"  Detected output name: {output_name!r}")
    return output_name


# ---------------------------------------------------------------------------
# Schema export
# ---------------------------------------------------------------------------

def save_schema(
    output_path: str,
    feature_order: list[str],
    audio_config: dict,
    output_name: str,
    metrics: dict,
    training_files: list[str],
    scaler: "StandardScaler | None",
    cfg: dict,
):
    model_id = f"onset_xgb_{datetime.now().strftime('%Y_%m_%d')}_{uuid.uuid4().hex[:6]}"

    normalization = {"enabled": False}
    if scaler is not None:
        normalization = {
            "enabled": True,
            "type":    "standard",
            "mean":    {feat: round(float(m), 8) for feat, m in zip(feature_order, scaler.mean_)},
            "std":     {feat: round(float(s), 8) for feat, s in zip(feature_order, scaler.scale_)},
        }

    schema = {
        "schemaVersion": "1.0",
        "modelId":       model_id,
        "modelType":     "xgboost_onnx",
        "trainedOn":     datetime.now(timezone.utc).isoformat(),
        "trainingDataFiles": training_files,
        "audioConfig": {
            "sampleRate":      audio_config.get("sampleRate", 48000),
            "fftSize":         audio_config.get("fftSize", 1024),
            "hopSize":         audio_config.get("hopSize", 256),
            "windowFunction":  "blackman-harris",
            "logCompression":  1000,
        },
        "inputName":    "input",
        "outputName":   output_name,
        "featureOrder": feature_order,
        "normalization": normalization,
        "missingValue": 0.0,
        "decision": {
            "probabilityThreshold": 0.5,
            "refractoryMs":         cfg.get("labels", {}).get("onset_tolerance_ms", 100),
            "lookaheadFrames":      1,
        },
        "metrics": metrics,
    }

    os.makedirs(os.path.dirname(output_path) or ".", exist_ok=True)
    with open(output_path, "w") as f:
        json.dump(schema, f, indent=2)
    print(f"  Schema saved: {output_path}")


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def main():
    parser = argparse.ArgumentParser(description="Train XGBoost onset detector")
    parser.add_argument("--config", default="training_config.yaml")
    args = parser.parse_args()

    print(f"\n=== train_onset_detector.py ===")
    print(f"Config: {args.config}\n")
    cfg = load_config(args.config)

    feature_names   = cfg["features"]["enabled"]
    positive_window = cfg["labels"]["positive_window_ms"]
    training_cfg    = cfg.get("training", {})
    paths_cfg       = cfg.get("paths", {})
    sampling_cfg    = cfg.get("sampling", {})

    random_state   = training_cfg.get("random_state", 42)
    test_split     = training_cfg.get("test_split", 0.2)
    val_split      = training_cfg.get("validation_split", 0.1)
    normalize      = training_cfg.get("normalize_features", True)
    neg_ratio      = sampling_cfg.get("negative_sampling_ratio", 5.0)
    data_dir       = paths_cfg.get("training_data_dir", "./training_data")
    output_model   = paths_cfg.get("output_model",   "./models/onset_detector.onnx")
    output_schema  = paths_cfg.get("output_schema",  "./models/onset_detector.schema.json")
    output_metrics = paths_cfg.get("output_metrics", "./models/onset_detector.metrics.json")

    # Load data
    print("--- Loading training data ---")
    file_features, file_labels, file_names, audio_config = load_training_files(
        data_dir, feature_names, positive_window
    )

    # Split
    print("\n--- Splitting by file ---")
    X_train, y_train, X_val, y_val, X_test, y_test = split_by_file(
        file_features, file_labels, file_names, test_split, val_split, random_state
    )

    # Negative sampling on train set only
    print("\n--- Negative sampling (train set) ---")
    X_train, y_train = apply_negative_sampling(X_train, y_train, neg_ratio, random_state)

    # Optional normalization
    scaler = None
    if normalize:
        print("\n--- Normalizing features (StandardScaler) ---")
        scaler = StandardScaler()
        X_train = scaler.fit_transform(X_train)
        X_val   = scaler.transform(X_val)
        X_test  = scaler.transform(X_test)

    # Train
    print("\n--- Training XGBoost ---")
    model = train_model(X_train, y_train, X_val, y_val, cfg, feature_names, random_state)

    # Metrics
    print("\n--- Evaluating on test set ---")
    metrics = compute_metrics(model, X_test, y_test)

    # ONNX export
    print("\n--- Exporting ONNX ---")
    output_name = export_onnx(model, len(feature_names), output_model)

    # Save metrics JSON
    os.makedirs(os.path.dirname(output_metrics) or ".", exist_ok=True)
    with open(output_metrics, "w") as f:
        json.dump(metrics, f, indent=2)
    print(f"  Metrics saved: {output_metrics}")

    # Save schema
    print("\n--- Saving schema ---")
    save_schema(
        output_schema,
        feature_order=feature_names,
        audio_config=audio_config or {},
        output_name=output_name,
        metrics=metrics,
        training_files=file_names,
        scaler=scaler,
        cfg=cfg,
    )

    print("\n=== Done! ===\n")


if __name__ == "__main__":
    main()
