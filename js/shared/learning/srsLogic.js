export const SRS_WEIGHT_ON_CORRECT_FAST = 0.7;
export const SRS_WEIGHT_ON_CORRECT_SLOW = 0.9;
export const SRS_WEIGHT_ON_WRONG        = 1.5;
export const SRS_WEIGHT_MIN             = 1.0;
export const SRS_WEIGHT_MAX             = 8.0;
export const SRS_FAST_THRESHOLD_MS      = 3000;

const STORAGE_PREFIX = 'gt_srs_';

function loadWeights(storage, key) {
  try {
    const raw = storage?.getItem(key);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) return {};
    return parsed;
  } catch {
    return {};
  }
}

function clampWeight(w) {
  const n = typeof w === 'number' ? w : SRS_WEIGHT_MIN;
  return Math.max(SRS_WEIGHT_MIN, Math.min(SRS_WEIGHT_MAX, n));
}

export function createSrsStore(exerciseKey, { storage } = {}) {
  const _storage = storage ?? globalThis.localStorage;
  const storageKey = `${STORAGE_PREFIX}${exerciseKey}`;
  const weights = loadWeights(_storage, storageKey);

  function save() {
    try {
      _storage?.setItem(storageKey, JSON.stringify(weights));
    } catch { /* storage full */ }
  }

  return { weights, save, storageKey };
}

function getWeight(store, itemKey) {
  return clampWeight(store.weights[itemKey]);
}

export function pickNextItem(store, activeKeys) {
  if (!activeKeys || activeKeys.length === 0) return null;
  if (activeKeys.length === 1) return activeKeys[0];

  const total = activeKeys.reduce((sum, k) => sum + getWeight(store, k), 0);
  let r = Math.random() * total;
  for (const key of activeKeys) {
    r -= getWeight(store, key);
    if (r <= 0) return key;
  }
  return activeKeys[activeKeys.length - 1];
}

export function recordResult(store, itemKey, { correct, responseTimeMs = Infinity } = {}) {
  const w = getWeight(store, itemKey);
  const factor = correct
    ? (responseTimeMs < SRS_FAST_THRESHOLD_MS ? SRS_WEIGHT_ON_CORRECT_FAST : SRS_WEIGHT_ON_CORRECT_SLOW)
    : SRS_WEIGHT_ON_WRONG;
  store.weights[itemKey] = clampWeight(w * factor);
  store.save();
}

export function getWeights(store) {
  return { ...store.weights };
}
