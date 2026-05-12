/**
 * guitarOnsetStrategies.js
 *
 * Registry of onset-detection strategies for the sheet-music reading exercise.
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
 * Usage:
 *   import { resolveGuitarOnsetStrategy } from './guitarOnsetStrategies.js';
 *   const strategy = resolveGuitarOnsetStrategy('guitar-onset');
 *   let state = strategy.createState();
 *   const { nextState, event } = strategy.update(state, { frequencyData, samples });
 *   state = nextState;
 */

import {
  createGuitarOnsetState,
  updateGuitarOnsetDetector,
} from './guitarOnsetDetector.js';

export const GUITAR_ONSET_STRATEGY_KEYS = {
  SWEEP_STANDARD: 'guitar-onset-sweep-standard',
  GUITAR_ONSET: 'guitar-onset',
};

export const DEFAULT_GUITAR_ONSET_STRATEGY_KEY = GUITAR_ONSET_STRATEGY_KEYS.SWEEP_STANDARD;

export const SWEEP_STANDARD_GUITAR_ONSET_OPTIONS = Object.freeze({
  relativeReattackFactor: 4,
  relativeReattackMinDelta: 0.008546,
  relativeFluxFactor: 1.4,
  spectralNoveltyRatio: 1.5,
  spectralNoveltyMinBins: 36,
  cooldownFrames: 4,
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

function updateGuitarOnsetDetectorWithOptions(baseOptions) {
  return (state, input, options = {}) => updateGuitarOnsetDetector(state, input, {
    ...baseOptions,
    ...options,
  });
}

export const GUITAR_ONSET_STRATEGIES = [
  {
    key: GUITAR_ONSET_STRATEGY_KEYS.SWEEP_STANDARD,
    label: 'Guitar Onset Detector (Sweep Standard)',
    description: 'Sweep-optimierte Standard-Erkennung mit RMS/Flux-Reattack-Bestaetigung.',
    createState: createGuitarOnsetState,
    update: updateGuitarOnsetDetectorWithOptions(SWEEP_STANDARD_GUITAR_ONSET_OPTIONS),
  },
  {
    key: GUITAR_ONSET_STRATEGY_KEYS.GUITAR_ONSET,
    label: 'Guitar Onset Detector (Legacy)',
    description: 'Bisherige Breitband-Spektralfluss + RMS-Spike-Erkennung fuer Gitarren-Anschlaege.',
    createState: createGuitarOnsetState,
    update: updateGuitarOnsetDetector,
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
 * Returns all registered onset strategies.
 * @returns {object[]}
 */
export function getGuitarOnsetStrategies() {
  return GUITAR_ONSET_STRATEGIES;
}
