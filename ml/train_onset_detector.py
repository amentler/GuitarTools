#!/usr/bin/env python3
"""
train_onset_detector.py

Trains an XGBoost onset detector from GuitarTools training data JSON files,
then exports the model to ONNX and saves a model_schema.json.

Usage:
    python train_onset_detector.py [--config training_config.yaml]

Dependencies:
    pip install xgboost scikit-learn onnxmltools onnx pyyaml numpy packaging
"""

import argparse
import json
import os
import sys
import uuid
import warnings
from copy import deepcopy
from datetime import datetime, timezone
from pathlib import Path

import numpy as np
import yaml

try:
    import xgboost as xgb
except ImportError:
    sys.exit("ERROR: xgboost is not installed. Run: pip install xgboost")

try:
    from packaging.version import Version
except ImportError:
    sys.exit("ERROR: packaging is not installed. Run: pip install packaging")

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


def resolve_refractory_ms(labels_cfg: dict) -> float:
    return float(labels_cfg.get(
        "refractory_ms",
        labels_cfg.get("onset_tolerance_ms", 100),
    ))


# ---------------------------------------------------------------------------
# Data loading
# ---------------------------------------------------------------------------

SUPPORTED_SCHEMA_VERSION = 1


def load_training_files(data_dir: str, feature_names: list[str], positive_window_ms: float):
    """
    Load all training JSON files from data_dir.
    Returns (file_features, file_labels, file_names, file_times_ms,
             file_onsets_ms, file_training_roles, audio_config_sample).

    file_features[i]      = np.ndarray of shape (n_frames_i, n_features)
    file_labels[i]        = np.ndarray of shape (n_frames_i,) with 0/1
    file_training_roles[i] = str | None  ("train", "test", "val", or None)
    """
    data_dir = Path(data_dir)
    json_files = sorted(data_dir.glob("training_data_*.json"))
    if not json_files:
        sys.exit(f"ERROR: No training_data_*.json files found in {data_dir}")

    file_features = []
    file_labels = []
    file_names = []
    file_times_ms = []
    file_onsets_ms = []
    file_training_roles = []
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
        times_ms = []
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
            times_ms.append(frame.get("t", 0) * 1000)

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

        # Training role (forced split assignment)
        raw_role = meta.get("trainingRole") or None
        training_role = raw_role if raw_role in ("train", "validation") else None

        file_features.append(X)
        file_labels.append(y)
        file_names.append(path.name)
        file_times_ms.append(np.array(times_ms, dtype=np.float32))
        file_onsets_ms.append([float(onset) for onset in onsets_ms])
        file_training_roles.append(training_role)
        role_hint = f" [{training_role}]" if training_role else ""
        print(
            f"  Loaded {path.name}{role_hint}: {len(frames)} frames, "
            f"{y.sum()} positives ({100 * y.mean():.1f}%)"
        )

    if n_skipped:
        print(f"  Skipped {n_skipped} file(s).")
    if not file_features:
        sys.exit("ERROR: No usable training files after filtering.")

    return file_features, file_labels, file_names, file_times_ms, file_onsets_ms, file_training_roles, audio_config_sample


# ---------------------------------------------------------------------------
# Train/test split by file
# ---------------------------------------------------------------------------

def split_by_file(
    file_features: list,
    file_labels: list,
    file_names: list,
    file_training_roles: list,
    validation_split: float,
    random_state: int,
):
    """
    Splits file-level. Files with a forced trainingRole ("train"/"validation")
    are always assigned to their designated split. Remaining files are split
    randomly according to validation_split.

    Returns (X_train, y_train, X_val, y_val, val_idx).
    """
    forced_train      = [i for i, r in enumerate(file_training_roles) if r == "train"]
    forced_validation = [i for i, r in enumerate(file_training_roles) if r == "validation"]
    random_files      = [i for i, r in enumerate(file_training_roles) if r not in ("train", "validation")]

    if forced_train or forced_validation:
        print(
            f"  Forced assignments: train={len(forced_train)}, "
            f"validation={len(forced_validation)}, random={len(random_files)}"
        )

    rng = np.random.RandomState(random_state)
    indices = rng.permutation(random_files)
    n = len(indices)

    n_val   = max(0, int(n * validation_split))
    n_train = n - n_val
    if n_train < 0:
        n_train = 0

    rand_train = list(indices[:n_train])
    rand_val   = list(indices[n_train:])

    train_idx = np.array(forced_train      + rand_train)
    val_idx   = np.array(forced_validation + rand_val)

    total_assigned = len(train_idx) + len(val_idx)
    if total_assigned < len(file_features):
        sys.exit(
            f"ERROR: Not enough files for split. Have {len(file_features)}, "
            f"assigned {total_assigned}. Add more training data or lower validation_split."
        )
    if len(train_idx) == 0:
        sys.exit(
            "ERROR: Training set is empty after forced assignments. "
            "Tag fewer files as 'validation' or add more training data."
        )

    def concat(idxs):
        if len(idxs) == 0:
            return np.empty((0, file_features[0].shape[1]), dtype=np.float32), np.empty(0, dtype=np.int32)
        X = np.concatenate([file_features[i] for i in idxs], axis=0)
        y = np.concatenate([file_labels[i]   for i in idxs], axis=0)
        return X, y

    X_train, y_train = concat(train_idx)
    X_val,   y_val   = concat(val_idx)

    print(
        f"  Split: train={len(train_idx)} files ({len(y_train)} frames), "
        f"validation={len(val_idx)} files ({len(y_val)} frames)"
    )
    return X_train, y_train, X_val, y_val, val_idx


def concat_files(file_indices: np.ndarray, file_features: list, file_labels: list):
    """Concatenate features and labels for the given file indices."""
    if len(file_indices) == 0:
        return np.empty((0, file_features[0].shape[1]), dtype=np.float32), np.empty(0, dtype=np.int32)
    X = np.concatenate([file_features[i] for i in file_indices], axis=0)
    y = np.concatenate([file_labels[i]   for i in file_indices], axis=0)
    return X, y


def kfold_file_splits(
    file_training_roles: list,
    n_folds: int,
    random_state: int,
) -> list[tuple[np.ndarray, np.ndarray]]:
    """
    Creates k file-level splits for cross-validation.

    Files with forced roles are kept fixed:
    - forced 'train' files appear in every fold's train set
    - forced 'validation' files appear in every fold's val set
    Remaining files are shuffled and distributed evenly across k folds.

    Returns list of (train_file_indices, val_file_indices) tuples.
    """
    forced_train = [i for i, r in enumerate(file_training_roles) if r == "train"]
    forced_val   = [i for i, r in enumerate(file_training_roles) if r == "validation"]
    random_files = [i for i, r in enumerate(file_training_roles) if r not in ("train", "validation")]

    rng = np.random.RandomState(random_state)
    shuffled = rng.permutation(random_files).tolist()

    folds = []
    for k in range(n_folds):
        val_file_set  = set(shuffled[k::n_folds])
        val_indices   = sorted(val_file_set)
        train_indices = [i for i in shuffled if i not in val_file_set]
        folds.append((
            np.array(forced_train + train_indices),
            np.array(forced_val   + val_indices),
        ))
    return folds


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
    xgb_version = Version(xgb.__version__)
    requested_device = xgb_cfg.get("device", "cpu")
    tree_method = xgb_cfg.get("tree_method", "hist")

    if requested_device in ("cuda", "gpu") and xgb_version < Version("2.0.0") and tree_method == "hist":
        tree_method = "gpu_hist"

    use_cuda_device_param = requested_device in ("cuda", "gpu") and xgb_version >= Version("2.0.0")

    # scale_pos_weight
    spw = xgb_cfg.get("scale_pos_weight", "auto")
    if spw == "auto":
        n_neg = int((y_train == 0).sum())
        n_pos = int((y_train == 1).sum())
        spw = n_neg / max(n_pos, 1)
        spw *= float(xgb_cfg.get("scale_pos_weight_multiplier", 1.0))
        print(f"  scale_pos_weight (auto): {spw:.2f}")

    model_params = {
        "max_depth":           xgb_cfg.get("max_depth", 5),
        "min_child_weight":    xgb_cfg.get("min_child_weight", 5),
        "learning_rate":       xgb_cfg.get("learning_rate", 0.03),
        "n_estimators":        xgb_cfg.get("n_estimators", 300),
        "subsample":           xgb_cfg.get("subsample", 0.8),
        "colsample_bytree":    xgb_cfg.get("colsample_bytree", 0.8),
        "gamma":               xgb_cfg.get("gamma", 0.3),
        "reg_alpha":           xgb_cfg.get("reg_alpha", 0.05),
        "reg_lambda":          xgb_cfg.get("reg_lambda", 1.5),
        "scale_pos_weight":    spw,
        "max_delta_step":      xgb_cfg.get("max_delta_step", 0),
        "objective":           "binary:logistic",
        "eval_metric":         "aucpr",
        "random_state":        random_state,
        "n_jobs":              -1,
        "tree_method":         tree_method,
        "early_stopping_rounds": cfg.get("training", {}).get("early_stopping_rounds", 20),
        "verbosity":           1,
    }
    if use_cuda_device_param:
        model_params["device"] = "cuda"

    print(
        f"  XGBoost backend: version={xgb.__version__}, "
        f"tree_method={model_params['tree_method']}, "
        f"device={model_params.get('device', 'cpu')}"
    )

    model = xgb.XGBClassifier(**model_params)

    try:
        model.fit(
            X_train, y_train,
            eval_set=[(X_val, y_val)],
            verbose=False,
        )
    except xgb.core.XGBoostError as err:
        if requested_device not in ("cuda", "gpu") or not xgb_cfg.get("fallback_to_cpu", True):
            raise

        print(f"  GPU training failed, falling back to CPU: {err}")
        model_params.pop("device", None)
        model_params["tree_method"] = "hist"
        model = xgb.XGBClassifier(**model_params)
        model.fit(
            X_train, y_train,
            eval_set=[(X_val, y_val)],
            verbose=False,
        )

    print(f"  Best iteration: {model.best_iteration}")
    return model


# ---------------------------------------------------------------------------
# Tuning
# ---------------------------------------------------------------------------

def predict_probabilities(model: xgb.XGBClassifier, X: np.ndarray) -> np.ndarray:
    return model.predict_proba(X)[:, 1]


def safe_divide(numerator: float, denominator: float) -> float:
    return numerator / denominator if denominator else 0.0


def build_eval_files(
    indices: np.ndarray,
    file_features: list[np.ndarray],
    file_labels: list[np.ndarray],
    file_names: list[str],
    file_times_ms: list[np.ndarray],
    file_onsets_ms: list[list[float]],
) -> list[dict]:
    return [
        {
            "name": file_names[i],
            "X": file_features[i],
            "y": file_labels[i],
            "times_ms": file_times_ms[i],
            "onsets_ms": file_onsets_ms[i],
        }
        for i in indices
    ]


def predict_eval_files(model: xgb.XGBClassifier, eval_files: list[dict]) -> list[dict]:
    return [
        {
            **entry,
            "probabilities": predict_probabilities(model, entry["X"]),
        }
        for entry in eval_files
    ]


def apply_app_peak_picking(
    probabilities: np.ndarray,
    threshold: float,
    frame_ms: float,
    lookahead_frames: int,
    refractory_ms: float,
) -> list[float]:
    N = len(probabilities)
    lookahead = max(0, int(lookahead_frames))

    above = probabilities > threshold

    # Local maximum: p[i] strictly greater than all left neighbours,
    # greater-or-equal to all right neighbours (mirrors original loop condition).
    is_local_max = np.ones(N, dtype=bool)
    for delta in range(1, min(lookahead + 1, N)):
        is_local_max[delta:]    &= probabilities[delta:]    > probabilities[:N - delta]
        is_local_max[:N - delta] &= probabilities[:N - delta] >= probabilities[delta:]
    if lookahead > 0:
        is_local_max[:lookahead]    = False
        is_local_max[N - lookahead:] = False

    # Refractory filter is sequential by design; iterate only over the sparse
    # candidate set (peaks above threshold) instead of all frames.
    detected_ms = []
    last_onset_ms = -np.inf
    for idx in np.where(above & is_local_max)[0]:
        onset_ms = float(idx) * frame_ms
        if onset_ms - last_onset_ms >= refractory_ms:
            detected_ms.append(onset_ms)
            last_onset_ms = onset_ms

    return detected_ms


def match_detected_onsets(
    detected_ms: list[float],
    expected_ms: list[float],
    tolerance_ms: float,
) -> dict:
    matched_expected = [False] * len(expected_ms)
    true_positives = 0

    for detected in detected_ms:
        best_index = None
        best_distance = float("inf")
        for index, expected in enumerate(expected_ms):
            if matched_expected[index]:
                continue
            distance = abs(detected - expected)
            if distance <= tolerance_ms and distance < best_distance:
                best_index = index
                best_distance = distance
        if best_index is not None:
            matched_expected[best_index] = True
            true_positives += 1

    false_positives = len(detected_ms) - true_positives
    false_negatives = len(expected_ms) - true_positives
    precision = safe_divide(true_positives, true_positives + false_positives)
    recall = safe_divide(true_positives, true_positives + false_negatives)
    f1 = safe_divide(2 * precision * recall, precision + recall)
    return {
        "tp": true_positives,
        "fp": false_positives,
        "fn": false_negatives,
        "precision": precision,
        "recall": recall,
        "f1": f1,
    }


def evaluate_app_peak_picking(
    model: xgb.XGBClassifier,
    eval_files: list[dict],
    threshold: float,
    cfg: dict,
    audio_config: dict,
) -> dict:
    decision_cfg = cfg.get("decision", {})
    labels_cfg = cfg.get("labels", {})
    sample_rate = audio_config.get("sampleRate", 48000)
    hop_size = audio_config.get("hopSize", 256)
    frame_ms = (hop_size / sample_rate) * 1000
    lookahead_frames = int(decision_cfg.get("lookahead_frames", 1))
    refractory_ms = resolve_refractory_ms(labels_cfg)
    tolerance_ms = float(labels_cfg.get("onset_tolerance_ms", 30))

    totals = {
        "tp": 0,
        "fp": 0,
        "fn": 0,
    }
    per_file = []
    for entry in eval_files:
        probabilities = entry.get("probabilities")
        if probabilities is None:
            probabilities = predict_probabilities(model, entry["X"])
        detected_ms = apply_app_peak_picking(
            probabilities,
            threshold,
            frame_ms,
            lookahead_frames,
            refractory_ms,
        )
        counts = match_detected_onsets(detected_ms, entry["onsets_ms"], tolerance_ms)
        totals["tp"] += counts["tp"]
        totals["fp"] += counts["fp"]
        totals["fn"] += counts["fn"]
        per_file.append({
            "file": entry["name"],
            "expected": len(entry["onsets_ms"]),
            "detected": len(detected_ms),
            "tp": counts["tp"],
            "fp": counts["fp"],
            "fn": counts["fn"],
        })

    precision = safe_divide(totals["tp"], totals["tp"] + totals["fp"])
    recall = safe_divide(totals["tp"], totals["tp"] + totals["fn"])
    f1 = safe_divide(2 * precision * recall, precision + recall)
    return {
        "threshold": float(threshold),
        "lookahead_frames": lookahead_frames,
        "refractory_ms": refractory_ms,
        "tolerance_ms": tolerance_ms,
        "frame_ms": frame_ms,
        "confusion_matrix": {
            "true_positives": totals["tp"],
            "false_positives": totals["fp"],
            "false_negatives": totals["fn"],
            "true_negatives": None,
        },
        "precision": precision,
        "recall": recall,
        "f1": f1,
        "per_file": per_file,
    }


def score_peak_threshold(
    model: xgb.XGBClassifier,
    eval_files: list[dict],
    threshold: float,
    cfg: dict,
    audio_config: dict,
    beta: float,
) -> dict:
    metrics = evaluate_app_peak_picking(model, eval_files, threshold, cfg, audio_config)
    precision = metrics["precision"]
    recall = metrics["recall"]
    beta_sq = beta * beta
    f_beta = safe_divide((1 + beta_sq) * precision * recall, (beta_sq * precision) + recall)
    return {
        "threshold": float(threshold),
        "precision": precision,
        "recall": recall,
        "f_beta": f_beta,
        "tp": metrics["confusion_matrix"]["true_positives"],
        "fp": metrics["confusion_matrix"]["false_positives"],
        "fn": metrics["confusion_matrix"]["false_negatives"],
    }


def score_threshold(y_true: np.ndarray, y_prob: np.ndarray, threshold: float, beta: float) -> dict:
    y_pred = (y_prob >= threshold).astype(int)
    tp = int(((y_true == 1) & (y_pred == 1)).sum())
    fp = int(((y_true == 0) & (y_pred == 1)).sum())
    fn = int(((y_true == 1) & (y_pred == 0)).sum())
    precision = safe_divide(tp, tp + fp)
    recall = safe_divide(tp, tp + fn)
    beta_sq = beta * beta
    f_beta = safe_divide((1 + beta_sq) * precision * recall, (beta_sq * precision) + recall)
    return {
        "threshold": float(threshold),
        "precision": precision,
        "recall": recall,
        "f_beta": f_beta,
        "tp": tp,
        "fp": fp,
        "fn": fn,
    }


def recall_priority_rank(row: dict) -> tuple:
    return (
        row["recall"],
        row["precision"],
        row["f_beta"],
        row["threshold"],
    )


def select_threshold(y_true: np.ndarray, y_prob: np.ndarray, cfg: dict) -> dict:
    decision_cfg = cfg.get("decision", {})
    selection_cfg = decision_cfg.get("threshold_selection", {})
    configured_threshold = float(decision_cfg.get("probability_threshold", 0.5))
    beta = float(selection_cfg.get("beta", 2.0))
    target_recall = float(selection_cfg.get("target_recall", 0.98))
    min_precision = float(selection_cfg.get("min_precision", 0.5))

    if not selection_cfg.get("enabled", False):
        result = score_threshold(y_true, y_prob, configured_threshold, beta)
        result["mode"] = "configured"
        result["target_recall"] = target_recall
        result["min_precision"] = min_precision
        return result

    candidates = np.unique(np.concatenate((
        np.linspace(0.001, 0.999, 999),
        y_prob,
    )))
    scored = [score_threshold(y_true, y_prob, threshold, beta) for threshold in candidates]

    recall_ok = [
        row for row in scored
        if row["recall"] >= target_recall and row["precision"] >= min_precision
    ]
    if recall_ok:
        best = max(recall_ok, key=recall_priority_rank)
        mode = "target_recall"
    else:
        precision_ok = [row for row in scored if row["precision"] >= min_precision]
        pool = precision_ok or scored
        best = max(pool, key=recall_priority_rank)
        mode = "recall_priority"

    best = dict(best)
    best["mode"] = mode
    best["target_recall"] = target_recall
    best["min_precision"] = min_precision
    return best


def select_peak_threshold(
    model: xgb.XGBClassifier,
    eval_files: list[dict],
    cfg: dict,
    audio_config: dict,
) -> dict:
    decision_cfg = cfg.get("decision", {})
    selection_cfg = decision_cfg.get("threshold_selection", {})
    configured_threshold = float(decision_cfg.get("probability_threshold", 0.5))
    beta = float(selection_cfg.get("beta", 2.0))
    target_recall = float(selection_cfg.get("target_recall", 0.98))
    min_precision = float(selection_cfg.get("min_precision", 0.5))

    if not selection_cfg.get("enabled", False):
        result = score_peak_threshold(model, eval_files, configured_threshold, cfg, audio_config, beta)
        result["mode"] = "configured"
        result["target_recall"] = target_recall
        result["min_precision"] = min_precision
        return result

    eval_files_with_probabilities = predict_eval_files(model, eval_files)
    candidates = np.linspace(0.001, 0.999, int(selection_cfg.get("steps", 999)))
    scored = [
        score_peak_threshold(model, eval_files_with_probabilities, threshold, cfg, audio_config, beta)
        for threshold in candidates
    ]

    recall_ok = [
        row for row in scored
        if row["recall"] >= target_recall and row["precision"] >= min_precision
    ]
    if recall_ok:
        best = max(recall_ok, key=recall_priority_rank)
        mode = "target_recall_peak_picking"
    else:
        precision_ok = [row for row in scored if row["precision"] >= min_precision]
        pool = precision_ok or scored
        best = max(pool, key=recall_priority_rank)
        mode = "recall_priority_peak_picking"

    best = dict(best)
    best["mode"] = mode
    best["target_recall"] = target_recall
    best["min_precision"] = min_precision
    return best


def generate_tuning_candidates(cfg: dict, random_state: int) -> list[dict]:
    tuning_cfg = cfg.get("training", {}).get("hyperparameter_tuning", {})
    if not tuning_cfg.get("enabled", False):
        return []

    xgb_cfg = cfg.get("xgboost", {})
    sampling_cfg = cfg.get("sampling", {})
    decision_cfg = cfg.get("decision", {})
    n_iter = int(tuning_cfg.get("n_iter", 8))
    rng = np.random.RandomState(random_state)
    xgb_search_space = {
        "max_depth": tuning_cfg.get("max_depth", [4, 5, 6, 7]),
        "min_child_weight": tuning_cfg.get("min_child_weight", [3, 5, 7]),
        "learning_rate": tuning_cfg.get("learning_rate", [0.02, 0.03, 0.05]),
        "n_estimators": tuning_cfg.get("n_estimators", [200, 300, 450]),
        "subsample": tuning_cfg.get("subsample", [0.75, 0.85, 0.95]),
        "colsample_bytree": tuning_cfg.get("colsample_bytree", [0.75, 0.85, 0.95]),
        "gamma": tuning_cfg.get("gamma", [0.1, 0.3, 0.6]),
        "reg_alpha": tuning_cfg.get("reg_alpha", [0.0, 0.05, 0.15]),
        "reg_lambda": tuning_cfg.get("reg_lambda", [1.0, 1.5, 2.5]),
        "scale_pos_weight_multiplier": tuning_cfg.get("scale_pos_weight_multiplier", [0.5, 0.75, 1.0, 1.25]),
        "max_delta_step": tuning_cfg.get("max_delta_step", [0, 1, 3]),
    }
    sampling_search_space = {
        "negative_sampling_ratio": tuning_cfg.get("negative_sampling_ratio", [5.0, 10.0, 15.0]),
    }
    decision_search_space = {
        "lookahead_frames": tuning_cfg.get("lookahead_frames", [2, 3, 4, 5]),
    }
    search_space = {**xgb_search_space, **sampling_search_space, **decision_search_space}

    base = {
        key: xgb_cfg.get(key)
        for key in xgb_search_space
        if key in xgb_cfg
    }
    base.update({
        key: sampling_cfg.get(key)
        for key in sampling_search_space
        if key in sampling_cfg
    })
    base.update({
        key: decision_cfg.get(key)
        for key in decision_search_space
        if key in decision_cfg
    })
    candidates = [base]
    seen = {tuple(sorted(base.items()))}

    for ratio in sampling_search_space["negative_sampling_ratio"]:
        candidate = {**base, "negative_sampling_ratio": ratio}
        signature = tuple(sorted(candidate.items()))
        if signature in seen:
            continue
        seen.add(signature)
        candidates.append(candidate)
        if len(candidates) >= n_iter:
            return candidates[:n_iter]

    attempts = 0
    while len(candidates) < n_iter and attempts < n_iter * 20:
        attempts += 1
        candidate = {key: values[int(rng.randint(0, len(values)))] for key, values in search_space.items()}
        signature = tuple(sorted(candidate.items()))
        if signature in seen:
            continue
        seen.add(signature)
        candidates.append(candidate)
    return candidates[:n_iter]


def tune_hyperparameters(
    X_train_full: np.ndarray,
    y_train_full: np.ndarray,
    X_val: np.ndarray,
    y_val: np.ndarray,
    val_idx: np.ndarray,
    file_features: list[np.ndarray],
    file_labels: list[np.ndarray],
    file_names: list[str],
    file_times_ms: list[np.ndarray],
    file_onsets_ms: list[list[float]],
    val_files: list[dict],
    cfg: dict,
    audio_config: dict,
    feature_names: list[str],
    random_state: int,
    normalize: bool,
    kfolds: list[tuple[np.ndarray, np.ndarray]] | None = None,
) -> tuple[xgb.XGBClassifier | None, dict, StandardScaler | None]:
    candidates = generate_tuning_candidates(cfg, random_state)
    if not candidates:
        return None, {}, None

    n_folds = len(kfolds) if kfolds else 0
    mode_label = f"{n_folds}-fold CV" if kfolds else "single val split"
    print(f"\n--- Hyperparameter tuning ({len(candidates)} candidate(s), {mode_label}) ---")
    best_model = None
    best_result = None
    best_scaler = None
    best_val_files = val_files

    for index, candidate in enumerate(candidates, start=1):
        trial_cfg = deepcopy(cfg)
        xgb_keys = set(trial_cfg.get("xgboost", {}).keys())
        trial_cfg.setdefault("xgboost", {}).update({
            key: value for key, value in candidate.items()
            if key in xgb_keys
        })
        if "negative_sampling_ratio" in candidate:
            trial_cfg.setdefault("sampling", {})["negative_sampling_ratio"] = candidate["negative_sampling_ratio"]
        if "lookahead_frames" in candidate:
            trial_cfg.setdefault("decision", {})["lookahead_frames"] = candidate["lookahead_frames"]

        sampling_ratio = trial_cfg.get("sampling", {}).get("negative_sampling_ratio", 5.0)
        print(f"  Candidate {index}/{len(candidates)}: {candidate}")

        if kfolds:
            # k-fold cross-validation scoring: average f_beta across folds
            fold_scores = []
            for fold_i, (fold_train_idx, fold_val_idx) in enumerate(kfolds):
                X_fold_train, y_fold_train = concat_files(fold_train_idx, file_features, file_labels)
                X_fold_val,   y_fold_val   = concat_files(fold_val_idx,   file_features, file_labels)

                X_fold_train, y_fold_train = apply_negative_sampling(
                    X_fold_train, y_fold_train, sampling_ratio, random_state
                )
                fold_scaler = None
                fold_file_features = file_features
                if normalize:
                    fold_scaler = StandardScaler()
                    X_fold_train = fold_scaler.fit_transform(X_fold_train)
                    X_fold_val   = fold_scaler.transform(X_fold_val)
                    fold_file_features = [fold_scaler.transform(X) for X in file_features]

                fold_val_files = build_eval_files(
                    fold_val_idx, fold_file_features, file_labels, file_names,
                    file_times_ms, file_onsets_ms,
                )
                fold_model = train_model(
                    X_fold_train, y_fold_train, X_fold_val, y_fold_val,
                    trial_cfg, feature_names, random_state
                )
                fold_thresh = select_peak_threshold(fold_model, fold_val_files, trial_cfg, audio_config)
                fold_scores.append(fold_thresh["f_beta"])
                print(
                    f"    Fold {fold_i + 1}/{n_folds}: "
                    f"threshold={fold_thresh['threshold']:.4f} "
                    f"P={fold_thresh['precision']:.4f} R={fold_thresh['recall']:.4f} "
                    f"f_beta={fold_thresh['f_beta']:.4f}"
                )

            avg_f_beta = float(np.mean(fold_scores))
            print(f"    CV mean f_beta={avg_f_beta:.4f} (folds: {[round(s, 4) for s in fold_scores]})")

            # Re-train on the full training set with these params for the final model
            X_tr, y_tr = apply_negative_sampling(X_train_full, y_train_full, sampling_ratio, random_state)
            scaler = None
            trial_X_val = X_val
            trial_file_features = file_features
            if normalize:
                scaler = StandardScaler()
                X_tr = scaler.fit_transform(X_tr)
                trial_X_val = scaler.transform(X_val)
                trial_file_features = [scaler.transform(X) for X in file_features]

            trial_val_files = build_eval_files(
                val_idx, trial_file_features, file_labels, file_names,
                file_times_ms, file_onsets_ms,
            )
            model = train_model(X_tr, y_tr, trial_X_val, y_val, trial_cfg, feature_names, random_state)
            threshold_result = select_peak_threshold(model, trial_val_files, trial_cfg, audio_config)
            result = {
                "params": candidate,
                "threshold": round(float(threshold_result["threshold"]), 6),
                "precision": threshold_result["precision"],
                "recall": threshold_result["recall"],
                "f_beta": avg_f_beta,  # CV score for ranking
                "mode": threshold_result["mode"],
            }
        else:
            # Single val split (original behaviour)
            X_train, y_train = apply_negative_sampling(X_train_full, y_train_full, sampling_ratio, random_state)
            scaler = None
            trial_X_val = X_val
            trial_file_features = file_features
            if normalize:
                scaler = StandardScaler()
                X_train = scaler.fit_transform(X_train)
                trial_X_val = scaler.transform(X_val)
                trial_file_features = [scaler.transform(X) for X in file_features]

            trial_val_files = build_eval_files(
                val_idx, trial_file_features, file_labels, file_names,
                file_times_ms, file_onsets_ms,
            )
            model = train_model(X_train, y_train, trial_X_val, y_val, trial_cfg, feature_names, random_state)
            threshold_result = select_peak_threshold(model, trial_val_files, trial_cfg, audio_config)
            result = {
                "params": candidate,
                "threshold": round(float(threshold_result["threshold"]), 6),
                "precision": threshold_result["precision"],
                "recall": threshold_result["recall"],
                "f_beta": threshold_result["f_beta"],
                "mode": threshold_result["mode"],
            }
            print(
                "    Validation: "
                f"threshold={result['threshold']:.6f} "
                f"peak_precision={result['precision']:.4f} "
                f"peak_recall={result['recall']:.4f} "
                f"f_beta={result['f_beta']:.4f}"
            )

        rank = recall_priority_rank(result)
        if best_result is None or rank > best_result["rank"]:
            best_model = model
            best_scaler = scaler
            best_val_files = trial_val_files
            best_result = {
                **result,
                "rank": rank,
            }

    cfg.setdefault("xgboost", {}).update({
        key: value for key, value in best_result["params"].items()
        if key in cfg.get("xgboost", {})
    })
    if "negative_sampling_ratio" in best_result["params"]:
        cfg.setdefault("sampling", {})["negative_sampling_ratio"] = best_result["params"]["negative_sampling_ratio"]
    if "lookahead_frames" in best_result["params"]:
        cfg.setdefault("decision", {})["lookahead_frames"] = best_result["params"]["lookahead_frames"]
    val_files[:] = best_val_files
    best_result.pop("rank", None)
    print(f"  Selected hyperparameters: {best_result}")
    return best_model, best_result, best_scaler


# ---------------------------------------------------------------------------
# Metrics
# ---------------------------------------------------------------------------

def summarize_probabilities(y_prob: np.ndarray) -> dict:
    percentiles = np.percentile(y_prob, [50, 75, 90, 95, 99, 100])
    return {
        "min": round(float(np.min(y_prob)), 6),
        "p50": round(float(percentiles[0]), 6),
        "p75": round(float(percentiles[1]), 6),
        "p90": round(float(percentiles[2]), 6),
        "p95": round(float(percentiles[3]), 6),
        "p99": round(float(percentiles[4]), 6),
        "max": round(float(percentiles[5]), 6),
    }


def compute_metrics(
    model,
    X_val,
    y_val,
    val_files: list[dict],
    cfg: dict,
    audio_config: dict,
    threshold: float = 0.5,
    threshold_selection: dict | None = None,
) -> dict:
    y_prob = predict_probabilities(model, X_val)
    y_pred = (y_prob >= threshold).astype(int)
    peak_metrics = evaluate_app_peak_picking(model, val_files, threshold, cfg, audio_config)

    prec  = precision_score(y_val, y_pred, zero_division=0)
    rec   = recall_score(y_val, y_pred, zero_division=0)
    f1    = f1_score(y_val, y_pred, zero_division=0)
    roc   = roc_auc_score(y_val, y_prob) if y_val.sum() > 0 else 0.0
    pr    = average_precision_score(y_val, y_prob) if y_val.sum() > 0 else 0.0
    cm    = confusion_matrix(y_val, y_pred).tolist()

    metrics = {
        "threshold":   round(float(threshold), 6),
        "precision":   round(prec, 4),
        "recall":      round(rec, 4),
        "f1":          round(f1, 4),
        "roc_auc":     round(roc, 4),
        "pr_auc":      round(pr, 4),
        "confusion_matrix": cm,
        "validation_positives":   int(y_val.sum()),
        "validation_negatives":   int((y_val == 0).sum()),
        "probability_summary": summarize_probabilities(y_prob),
        "peak_picking": {
            **peak_metrics,
            "precision": round(float(peak_metrics["precision"]), 4),
            "recall": round(float(peak_metrics["recall"]), 4),
            "f1": round(float(peak_metrics["f1"]), 4),
            "threshold": round(float(peak_metrics["threshold"]), 6),
            "frame_ms": round(float(peak_metrics["frame_ms"]), 4),
        },
    }
    if threshold_selection:
        metrics["threshold_selection"] = threshold_selection
    print(
        f"\n  Validation metrics after app peak picking (threshold={threshold}):\n"
        f"    Precision={peak_metrics['precision']:.4f}  Recall={peak_metrics['recall']:.4f} "
        f"F1={peak_metrics['f1']:.4f}\n"
        f"    Confusion Matrix: {peak_metrics['confusion_matrix']}\n"
        f"    Frame diagnostics: Precision={prec:.4f} Recall={rec:.4f} F1={f1:.4f} "
        f"ROC-AUC={roc:.4f} PR-AUC={pr:.4f}\n"
        f"    Probability summary: {metrics['probability_summary']}"
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
    output_names = [output.name for output in loaded.graph.output]
    output_name = "probabilities" if "probabilities" in output_names else output_names[0]
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
    decision_cfg = cfg.get("decision", {})
    selection_cfg = decision_cfg.get("threshold_selection", {})
    decision_threshold = metrics.get("threshold", decision_cfg.get("probability_threshold", 0.5)) \
        if selection_cfg.get("enabled", False) \
        else decision_cfg.get("probability_threshold", metrics.get("threshold", 0.5))

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
            "probabilityThreshold": decision_threshold,
            "refractoryMs":         resolve_refractory_ms(cfg.get("labels", {})),
            "lookaheadFrames":      decision_cfg.get("lookahead_frames", 1),
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
    decision_cfg    = cfg.get("decision", {})

    random_state      = training_cfg.get("random_state", 42)
    validation_split  = training_cfg.get("validation_split", 0.2)
    normalize         = training_cfg.get("normalize_features", True)
    neg_ratio      = sampling_cfg.get("negative_sampling_ratio", 5.0)
    data_dir       = paths_cfg.get("training_data_dir", "./training_data")
    output_model   = paths_cfg.get("output_model",   "./models/onset_detector.onnx")
    output_schema  = paths_cfg.get("output_schema",  "./models/onset_detector.schema.json")
    output_metrics = paths_cfg.get("output_metrics", "./models/onset_detector.metrics.json")
    configured_threshold = decision_cfg.get("probability_threshold", 0.5)

    # Load data
    print("--- Loading training data ---")
    file_features, file_labels, file_names, file_times_ms, file_onsets_ms, file_training_roles, audio_config = load_training_files(
        data_dir, feature_names, positive_window
    )

    # Split (also used for final threshold selection and metrics after tuning)
    print("\n--- Splitting by file ---")
    X_train, y_train, X_val, y_val, val_idx = split_by_file(
        file_features, file_labels, file_names, file_training_roles, validation_split, random_state
    )

    # Optional k-fold splits for hyperparameter scoring
    cv_cfg = training_cfg.get("cross_validation", {})
    kfolds = None
    if cv_cfg.get("enabled", False):
        n_folds = int(cv_cfg.get("n_folds", 5))
        print(f"\n--- Preparing {n_folds}-fold cross-validation ---")
        kfolds = kfold_file_splits(file_training_roles, n_folds, random_state)
        print(f"  Created {len(kfolds)} folds from {len(file_features)} files")

    val_files = []
    scaler = None
    tuned_model, tuning_result, tuned_scaler = tune_hyperparameters(
        X_train,
        y_train,
        X_val,
        y_val,
        val_idx,
        file_features,
        file_labels,
        file_names,
        file_times_ms,
        file_onsets_ms,
        val_files,
        cfg,
        audio_config or {},
        feature_names,
        random_state,
        normalize,
        kfolds=kfolds,
    )

    if tuned_model is None:
        # Negative sampling on train set only
        print("\n--- Negative sampling (train set) ---")
        X_train, y_train = apply_negative_sampling(X_train, y_train, neg_ratio, random_state)

        # Optional normalization
        if normalize:
            print("\n--- Normalizing features (StandardScaler) ---")
            scaler = StandardScaler()
            X_train = scaler.fit_transform(X_train)
            X_val   = scaler.transform(X_val)
            file_features_for_eval = [scaler.transform(X) for X in file_features]
        else:
            file_features_for_eval = file_features

        val_files = build_eval_files(
            val_idx,
            file_features_for_eval,
            file_labels,
            file_names,
            file_times_ms,
            file_onsets_ms,
        )
        print("\n--- Training XGBoost ---")
        model = train_model(X_train, y_train, X_val, y_val, cfg, feature_names, random_state)
    else:
        model = tuned_model
        scaler = tuned_scaler
        if scaler is not None:
            X_val = scaler.transform(X_val)
            file_features_for_eval = [scaler.transform(X) for X in file_features]
        else:
            file_features_for_eval = file_features

    print("\n--- Selecting threshold on validation set after app peak picking ---")
    threshold_selection = select_peak_threshold(model, val_files, cfg, audio_config or {})
    threshold = threshold_selection["threshold"]
    threshold_selection = {
        "mode": threshold_selection["mode"],
        "configured_threshold": round(float(configured_threshold), 6),
        "selected_threshold": round(float(threshold), 6),
        "validation_peak_precision": round(float(threshold_selection["precision"]), 4),
        "validation_peak_recall": round(float(threshold_selection["recall"]), 4),
        "validation_peak_f_beta": round(float(threshold_selection["f_beta"]), 4),
        "validation_peak_tp": int(threshold_selection["tp"]),
        "validation_peak_fp": int(threshold_selection["fp"]),
        "validation_peak_fn": int(threshold_selection["fn"]),
        "target_recall": round(float(threshold_selection["target_recall"]), 4),
        "min_precision": round(float(threshold_selection["min_precision"]), 4),
    }
    if tuning_result:
        threshold_selection["hyperparameter_tuning"] = tuning_result
    print(f"  Threshold selection: {threshold_selection}")

    # Metrics on validation set
    print("\n--- Evaluating on validation set ---")
    metrics = compute_metrics(model, X_val, y_val, val_files, cfg, audio_config or {}, threshold, threshold_selection)

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
