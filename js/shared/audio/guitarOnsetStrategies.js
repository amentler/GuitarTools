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
  GUITAR_ONSET: 'guitar-onset',
};

export const GUITAR_ONSET_STRATEGIES = [
  {
    key: GUITAR_ONSET_STRATEGY_KEYS.GUITAR_ONSET,
    label: 'Guitar Onset Detector',
    description: 'Breitband-Spektralfluss + RMS-Spike-Erkennung für Gitarren-Anschläge.',
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
  return GUITAR_ONSET_STRATEGIES.find(s => s.key === key) ?? GUITAR_ONSET_STRATEGIES[0];
}

/**
 * Returns all registered onset strategies.
 * @returns {object[]}
 */
export function getGuitarOnsetStrategies() {
  return GUITAR_ONSET_STRATEGIES;
}
