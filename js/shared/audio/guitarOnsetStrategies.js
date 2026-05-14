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
  normalizeGuitarOnsetOptions,
  updateGuitarOnsetDetector,
  updateGuitarOnsetDetectorNormalized,
} from './guitarOnsetDetector.js';
import { applyGuitarBandpass } from './guitarPitchDetection.js';

export const GUITAR_ONSET_STRATEGY_KEYS = {
  SWEEP_STANDARD: 'guitar-onset-sweep-standard',
  GUITAR_ONSET: 'guitar-onset',
  BROADBAND_OR: 'guitar-onset-broadband-or',
  LEGACY_BANDPASS: 'guitar-onset-legacy-bandpass',
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

const SWEEP_STANDARD_NORMALIZED_OPTIONS = normalizeGuitarOnsetOptions(SWEEP_STANDARD_GUITAR_ONSET_OPTIONS);

export const BROADBAND_OR_GUITAR_ONSET_OPTIONS = Object.freeze({
  broadbandOrMinBins: 10,
  cooldownFrames: 3,
  relativeReattackFactor: null,
  relativeFluxFactor: null,
  confirmedRmsFactor: null,
  cooldownOverrideFactor: null,
});

const BROADBAND_OR_NORMALIZED_OPTIONS = normalizeGuitarOnsetOptions(BROADBAND_OR_GUITAR_ONSET_OPTIONS);

function makeStrategyUpdate(baseNormalized, baseRaw) {
  return (state, input, options = {}) => {
    const normalizedOptions = options && Object.keys(options).length > 0
      ? normalizeGuitarOnsetOptions({ ...baseRaw, ...options })
      : baseNormalized;
    return updateGuitarOnsetDetectorNormalized(state, input, normalizedOptions);
  };
}

export const GUITAR_ONSET_STRATEGIES = [
  {
    key: GUITAR_ONSET_STRATEGY_KEYS.SWEEP_STANDARD,
    label: 'Guitar Onset Detector (Sweep Standard)',
    description: 'Sweep-optimierte Standard-Erkennung mit RMS/Flux-Reattack-Bestaetigung.',
    createState: createGuitarOnsetState,
    update: makeStrategyUpdate(SWEEP_STANDARD_NORMALIZED_OPTIONS, SWEEP_STANDARD_GUITAR_ONSET_OPTIONS),
  },
  {
    key: GUITAR_ONSET_STRATEGY_KEYS.GUITAR_ONSET,
    label: 'Guitar Onset Detector (Legacy)',
    description: 'Bisherige Breitband-Spektralfluss + RMS-Spike-Erkennung fuer Gitarren-Anschlaege.',
    createState: createGuitarOnsetState,
    update: updateGuitarOnsetDetector,
  },
  {
    key: GUITAR_ONSET_STRATEGY_KEYS.BROADBAND_OR,
    label: 'Guitar Onset Detector (Broadband OR)',
    description: 'Feuert wenn Flux ODER BandRatio ODER SpectralNoveltyBins einen Schwellenwert überschreiten. Geeignet für schnelle Notenfolgen und Wiederholungen.',
    createState: createGuitarOnsetState,
    update: makeStrategyUpdate(BROADBAND_OR_NORMALIZED_OPTIONS, BROADBAND_OR_GUITAR_ONSET_OPTIONS),
  },
  {
    key: GUITAR_ONSET_STRATEGY_KEYS.LEGACY_BANDPASS,
    label: 'Guitar Onset Detector (Legacy + Bandpass)',
    description: 'Legacy-Erkennung mit Bandpass-Filter (150–450 Hz) vor der RMS-Berechnung. Fokussiert auf den Attack-Bereich, reduziert Tieffrequenz-Rumpeln der Sympathiesaiten.',
    createState: createGuitarOnsetState,
    update: (state, { frequencyData, samples, rms, sampleRate = 44100 }, options = {}) => {
      const filteredSamples = samples ? applyGuitarBandpass(samples, sampleRate, 150, 450) : null;
      return updateGuitarOnsetDetector(state, { frequencyData, samples: filteredSamples, rms }, options);
    },
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
