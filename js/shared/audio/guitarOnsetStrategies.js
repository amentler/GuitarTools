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
  relativeReattackFactor: 3.233025,
  relativeReattackMinDelta: 0.019703,
  relativeFluxFactor: 1.4,
  spectralNoveltyRatio: 2.971316,
  spectralNoveltyMinBins: 27,
  cooldownFrames: 4,
  confirmedRmsFactor: 1.235449,
  confirmedRmsMinDelta: 0.003734,
  confirmedFluxFactor: 1.719335,
  confirmedMinFlux: 0.015141,
  confirmedMinBandRatio: 0.036178,
  confirmedSpectralNoveltyMinBins: 25,
  cooldownOverrideFactor: 4.86345,
  cooldownOverrideMinFlux: 0.0082,
  cooldownOverrideMinBandRatio: 0.080929,
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
