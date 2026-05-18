import { resolveGuitarOnsetStrategy } from './guitarOnsetStrategies.js';
import {
  detectOnsetsOfflineXGBoost,
  loadDefaultXGBoostOnsetModel,
} from './offlineOnsetDetectionXGBoost.js';

/**
 * Runs the default XGBoost guitar onset detector over a decoded mono sample buffer.
 *
 * @param {Float32Array} samples
 * @param {number} sampleRate
 * @param {{ strategyKey?: string, fftSize?: number, hopSize?: number }} [options]
 * @returns {Promise<{ onsetsMs: number[], onsetsSec: number[] }>}
 */
export async function detectOnsetsOffline(samples, sampleRate, options = {}) {
  const strategy = resolveGuitarOnsetStrategy(options.strategyKey);
  const model = await loadDefaultXGBoostOnsetModel();
  return detectOnsetsOfflineXGBoost(samples, sampleRate, model, {
    threshold: options.threshold,
    refractoryMs: options.refractoryMs,
    onsetStrategyKey: strategy.baseStrategyKey,
  });
}
