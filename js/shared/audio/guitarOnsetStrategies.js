/**
 * guitarOnsetStrategies.js
 *
 * Registry of selectable onset-detection strategies for sheet-music reading.
 *
 * Each strategy wraps an onset-detection algorithm behind a uniform interface:
 *
 *   { key, label, description, createState, update }
 *
 * where:
 *   - createState() → initialState
 *   - update(state, { frequencyData, samples, rms? }, options?) → { nextState, event, ... }
 *     `event` is 'onset' or null (same contract as guitarOnsetDetector).
 *
 * XGBoost strategies can optionally carry `modelUrl`/`schemaUrl` fields that
 * point to a specific ONNX model file instead of the production default.
 *
 * The sweep-standard strategy remains available through
 * resolveGuitarOnsetBaseStrategy() as an internal feature source for the
 * XGBoost model.
 *
 * Dynamic strategies are loaded from models/strategies/registry.json via
 * loadGuitarOnsetStrategiesFromRegistry(). Until that resolves, the static
 * GUITAR_ONSET_STRATEGIES array acts as a fallback.
 */

import {
  createGuitarOnsetState,
  normalizeGuitarOnsetOptions,
  updateGuitarOnsetDetectorNormalized,
} from './guitarOnsetDetector.js';
import { ONSET_SWEEP_STANDARD_COOLDOWN_FRAMES } from './onsetPipelineConfig.js';

export const GUITAR_ONSET_STRATEGY_KEYS = {
  XGBOOST_ANDROID_FIREFOX: 'xgboost-android-firefox',
  SWEEP_STANDARD: 'guitar-onset-sweep-standard',
};

export const DEFAULT_GUITAR_ONSET_STRATEGY_KEY = GUITAR_ONSET_STRATEGY_KEYS.XGBOOST_ANDROID_FIREFOX;

export const SWEEP_STANDARD_GUITAR_ONSET_OPTIONS = Object.freeze({
  relativeReattackFactor: 4,
  relativeReattackMinDelta: 0.008546,
  relativeFluxFactor: 1.4,
  spectralNoveltyRatio: 1.5,
  spectralNoveltyMinBins: 36,
  cooldownFrames: ONSET_SWEEP_STANDARD_COOLDOWN_FRAMES,
  confirmedRmsFactor: 1.554447,
  confirmedRmsMinDelta: 0.005963,
  confirmedFluxFactor: 2.070733,
  confirmedMinFlux: 0.005171,
  confirmedMinBandRatio: 0.018637,
  confirmedSpectralNoveltyMinBins: 14,
  cooldownOverrideFactor: 5,
  cooldownOverrideMinFlux: 0.015508,
  cooldownOverrideMinBandRatio: 0.050004,
});

const SWEEP_STANDARD_NORMALIZED_OPTIONS = normalizeGuitarOnsetOptions(SWEEP_STANDARD_GUITAR_ONSET_OPTIONS);

function makeStrategyUpdate(baseNormalized, baseRaw) {
  return (state, input, options = {}) => {
    const normalizedOptions = options && Object.keys(options).length > 0
      ? normalizeGuitarOnsetOptions({ ...baseRaw, ...options })
      : baseNormalized;
    return updateGuitarOnsetDetectorNormalized(state, input, normalizedOptions);
  };
}

const SWEEP_STANDARD_BASE_STRATEGY = {
  key: GUITAR_ONSET_STRATEGY_KEYS.SWEEP_STANDARD,
  label: 'XGBoost Base Strategy',
  description: 'Interne Sweep-Feature-Basis fuer XGBoost. Nicht als eigener Detektor auswaehlbar.',
  createState: createGuitarOnsetState,
  update: makeStrategyUpdate(SWEEP_STANDARD_NORMALIZED_OPTIONS, SWEEP_STANDARD_GUITAR_ONSET_OPTIONS),
};

export const GUITAR_ONSET_STRATEGIES = [
  {
    key: GUITAR_ONSET_STRATEGY_KEYS.XGBOOST_ANDROID_FIREFOX,
    label: 'XGBoost Android Firefox',
    description: 'Offline-ONNX-Onset-Erkennung mit Android-Firefox-Modell, Peak-Picking und konservativer Schwelle.',
    offlineDetector: 'xgboost',
    baseStrategyKey: GUITAR_ONSET_STRATEGY_KEYS.SWEEP_STANDARD,
    createState: createGuitarOnsetState,
    update: makeStrategyUpdate(SWEEP_STANDARD_NORMALIZED_OPTIONS, SWEEP_STANDARD_GUITAR_ONSET_OPTIONS),
  },
];

/**
 * Returns the onset strategy for the given key, falling back to the default.
 * Searches registry-loaded strategies first (if loaded), then the static array.
 * @param {string} [key]
 * @returns {object} strategy object
 */
export function resolveGuitarOnsetStrategy(key) {
  const all = getGuitarOnsetStrategies();
  return all.find(s => s.key === key)
    ?? all.find(s => s.key === DEFAULT_GUITAR_ONSET_STRATEGY_KEY)
    ?? all[0];
}

/**
 * Returns the internal onset strategy used for XGBoost context features.
 * These base strategies are not user-selectable detectors.
 * @param {string} [key]
 * @returns {object} strategy object
 */
export function resolveGuitarOnsetBaseStrategy(key) {
  if (key === GUITAR_ONSET_STRATEGY_KEYS.SWEEP_STANDARD) return SWEEP_STANDARD_BASE_STRATEGY;
  return SWEEP_STANDARD_BASE_STRATEGY;
}

/**
 * Returns all currently registered onset strategies.
 * If the registry has been loaded, returns registry strategies (which replace
 * the static fallback). Otherwise returns the static GUITAR_ONSET_STRATEGIES.
 * @returns {object[]}
 */
export function getGuitarOnsetStrategies() {
  if (_registryStrategies !== null && _registryStrategies.length > 0) {
    return _registryStrategies;
  }
  return GUITAR_ONSET_STRATEGIES;
}

const REGISTRY_URL = new URL('../../../models/strategies/registry.json', import.meta.url).href;
const MODELS_BASE_URL = new URL('../../../models/', import.meta.url).href;

/** Cached result of the last successful registry load (null = not yet loaded). */
let _registryStrategies = null;
/** In-flight or completed promise for the registry fetch. */
let _registryPromise = null;

/**
 * Loads strategies from models/strategies/registry.json.
 *
 * - Returns registry strategies on success (up to 7 entries, newest first).
 * - Falls back silently to [] on 404 (no registry yet).
 * - Falls back silently to [] on any network/parse error (logs a warning).
 * - Caches the promise; subsequent calls return the same promise.
 *
 * After this resolves, getGuitarOnsetStrategies() and resolveGuitarOnsetStrategy()
 * automatically use the registry strategies instead of the static fallback.
 *
 * @returns {Promise<object[]>} Array of strategy objects built from the registry.
 */
export function loadGuitarOnsetStrategiesFromRegistry() {
  if (_registryPromise) return _registryPromise;
  _registryPromise = _fetchRegistry();
  return _registryPromise;
}

async function _fetchRegistry() {
  try {
    const res = await fetch(REGISTRY_URL, { cache: 'no-store' });
    if (!res.ok) {
      _registryStrategies = [];
      return [];
    }
    const registry = await res.json();
    const entries = Array.isArray(registry.strategies) ? registry.strategies : [];
    _registryStrategies = entries.map(entry => _buildStrategyFromEntry(entry));
    return _registryStrategies;
  } catch (err) {
    console.warn('[guitarOnsetStrategies] registry load failed, using static fallback:', err);
    _registryStrategies = [];
    return [];
  }
}

function _buildStrategyFromEntry(entry) {
  return {
    key: entry.key,
    label: entry.label,
    description: entry.description,
    offlineDetector: 'xgboost',
    baseStrategyKey: GUITAR_ONSET_STRATEGY_KEYS.SWEEP_STANDARD,
    modelUrl: new URL(entry.modelFile, MODELS_BASE_URL).href,
    schemaUrl: new URL(entry.schemaFile, MODELS_BASE_URL).href,
    createState: createGuitarOnsetState,
    update: makeStrategyUpdate(SWEEP_STANDARD_NORMALIZED_OPTIONS, SWEEP_STANDARD_GUITAR_ONSET_OPTIONS),
  };
}
