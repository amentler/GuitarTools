"""Tests for the vectorized apply_app_peak_picking."""

import numpy as np
import pytest
from train_onset_detector import apply_app_peak_picking


def _reference(probabilities, threshold, frame_ms, lookahead_frames, refractory_ms):
    """Original sequential implementation kept as ground truth."""
    detected_ms = []
    last_onset_ms = -float("inf")
    lookahead = max(0, int(lookahead_frames))
    for frame_index in range(lookahead, len(probabilities) - lookahead):
        probability = float(probabilities[frame_index])
        if probability <= threshold:
            continue
        is_max = True
        for delta in range(1, lookahead + 1):
            if probabilities[frame_index - delta] >= probability or probabilities[frame_index + delta] > probability:
                is_max = False
                break
        if not is_max:
            continue
        onset_ms = frame_index * frame_ms
        if onset_ms - last_onset_ms < refractory_ms:
            continue
        last_onset_ms = onset_ms
        detected_ms.append(onset_ms)
    return detected_ms


def _call(probs, threshold=0.5, frame_ms=5.0, lookahead=2, refractory=80.0):
    p = np.array(probs, dtype=float)
    return apply_app_peak_picking(p, threshold, frame_ms, lookahead, refractory)


def _ref(probs, threshold=0.5, frame_ms=5.0, lookahead=2, refractory=80.0):
    p = np.array(probs, dtype=float)
    return _reference(p, threshold, frame_ms, lookahead, refractory)


# --- basic cases ---

def test_single_clear_peak():
    probs = [0.1, 0.2, 0.9, 0.2, 0.1]
    assert _call(probs) == _ref(probs)
    assert len(_call(probs)) == 1


def test_below_threshold_ignored():
    probs = [0.1, 0.4, 0.4, 0.4, 0.1]
    assert _call(probs) == []


def test_two_peaks_within_refractory_only_first_kept():
    # peaks at frame 2 (10ms) and frame 5 (25ms), refractory=80ms → only first
    probs = [0.1, 0.2, 0.9, 0.2, 0.1, 0.9, 0.2, 0.1]
    result = _call(probs, refractory=80.0, frame_ms=5.0)
    assert len(result) == 1
    assert result == _ref(probs, refractory=80.0, frame_ms=5.0)


def test_two_peaks_outside_refractory_both_kept():
    # peaks at frame 2 (10ms) and frame 10 (50ms), refractory=30ms → both kept
    probs = [0.1, 0.2, 0.9, 0.2, 0.1, 0.1, 0.1, 0.1, 0.2, 0.9, 0.2, 0.1]
    result = _call(probs, refractory=30.0, frame_ms=5.0)
    assert len(result) == 2
    assert result == _ref(probs, refractory=30.0, frame_ms=5.0)


def test_not_a_local_max_left_neighbour_equal():
    # left neighbour equals peak → not a max (original condition: >= means not max)
    probs = [0.1, 0.9, 0.9, 0.2, 0.1]
    assert _call(probs) == _ref(probs)


def test_right_neighbour_strictly_greater_not_max():
    probs = [0.1, 0.2, 0.7, 0.9, 0.1, 0.1]
    assert _call(probs) == _ref(probs)


# --- edge cases ---

def test_lookahead_zero():
    # With lookahead=0 every above-threshold frame is a candidate (only refractory applies)
    probs = [0.6, 0.7, 0.8, 0.6, 0.5]
    assert _call(probs, lookahead=0) == _ref(probs, lookahead=0)


def test_empty_array():
    assert _call([], lookahead=0) == []


def test_all_zeros():
    assert _call([0.0] * 10) == []


def test_all_ones():
    # All above threshold but only the first qualifies as local max with refractory
    probs = [1.0] * 20
    result = _call(probs, threshold=0.5, frame_ms=5.0, refractory=80.0)
    assert result == _ref(probs, threshold=0.5, frame_ms=5.0, refractory=80.0)


def test_single_element():
    # With lookahead=2, range is empty → no detections
    assert _call([0.9], lookahead=2) == []


def test_lookahead_larger_than_array():
    probs = [0.1, 0.9, 0.1]
    assert _call(probs, lookahead=5) == _ref(probs, lookahead=5)


# --- parity against reference on random inputs ---

@pytest.mark.parametrize("seed", range(20))
def test_parity_random(seed):
    rng = np.random.RandomState(seed)
    n = rng.randint(20, 200)
    probs = rng.rand(n)
    threshold = rng.uniform(0.3, 0.7)
    frame_ms = rng.uniform(3.0, 10.0)
    lookahead = int(rng.randint(0, 8))
    refractory = rng.uniform(20.0, 150.0)

    result = apply_app_peak_picking(probs, threshold, frame_ms, lookahead, refractory)
    expected = _reference(probs, threshold, frame_ms, lookahead, refractory)
    assert result == expected, (
        f"seed={seed}, n={n}, threshold={threshold:.3f}, "
        f"lookahead={lookahead}, refractory={refractory:.1f}"
    )
