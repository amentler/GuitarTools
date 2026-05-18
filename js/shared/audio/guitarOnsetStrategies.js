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
 * The app exposes XGBoost as the only selectable detector. The sweep-standard
 * strategy remains available through resolveGuitarOnsetBaseStrategy() as an
 * internal feature source for the XGBoost model.
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
 * @param {string} [key]
 * @returns {object} strategy object
 */
export function resolveGuitarOnsetStrategy(key) {
  return GUITAR_ONSET_STRATEGIES.find(s => s.key === key)
    ?? GUITAR_ONSET_STRATEGIES.find(s => s.key === DEFAULT_GUITAR_ONSET_STRATEGY_KEY)
    ?? GUITAR_ONSET_STRATEGIES[0];
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
 * Returns all registered onset strategies.
 * @returns {object[]}
 */
export function getGuitarOnsetStrategies() {
  return GUITAR_ONSET_STRATEGIES;
}
