/**
 * Offline onset detection for uploaded/decoded audio buffers.
 */

import { computeDbSpectrum } from './dbSpectrum.js';
import { resolveGuitarOnsetStrategy } from './guitarOnsetStrategies.js';

const DEFAULT_FFT_SIZE = 4096;

function sliceFrame(samples, offset, fftSize) {
  const frame = new Float32Array(fftSize);
  frame.set(samples.slice(offset, Math.min(samples.length, offset + fftSize)));
  return frame;
}

/**
 * Runs a registered guitar onset strategy over a decoded mono sample buffer.
 *
 * @param {Float32Array} samples
 * @param {number} sampleRate
 * @param {{ strategyKey?: string, fftSize?: number, hopSize?: number }} [options]
 * @returns {{ onsetsMs: number[], onsetsSec: number[] }}
 */
export function detectOnsetsOffline(samples, sampleRate, options = {}) {
  const strategy = resolveGuitarOnsetStrategy(options.strategyKey);
  const fftSize = options.fftSize ?? DEFAULT_FFT_SIZE;
  const hopSize = options.hopSize ?? fftSize;
  const duration = samples.length / sampleRate;
  const frameCount = Math.max(1, Math.floor((samples.length - fftSize) / hopSize) + 1);
  let state = strategy.createState();
  const onsetsSec = [];

  for (let i = 0; i < frameCount; i++) {
    const offset = i * hopSize;
    const frame = sliceFrame(samples, offset, fftSize);
    const frequencyData = computeDbSpectrum(frame, fftSize);
    const result = strategy.update(state, { frequencyData, samples: frame, sampleRate });
    state = result.nextState;
    if (result.event === 'onset') {
      const tCenter = Math.min(duration, (offset + fftSize / 2) / sampleRate);
      onsetsSec.push(tCenter);
    }
  }

  return {
    onsetsSec,
    onsetsMs: onsetsSec.map(sec => Math.round(sec * 1000)),
  };
}
