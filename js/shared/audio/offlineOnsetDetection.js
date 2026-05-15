import { collectFrameData } from './collectFrameData.js';
import { resolveGuitarOnsetStrategy } from './guitarOnsetStrategies.js';
import { ONSET_FFT_SIZE, ONSET_HOP_DIVISOR } from './onsetPipelineConfig.js';

/**
 * Runs a registered guitar onset strategy over a decoded mono sample buffer.
 * Uses the same FFT pipeline as the live analysis (OfflineAudioContext + AnalyserNode
 * when available, computeDbSpectrum as fallback).
 *
 * @param {Float32Array} samples
 * @param {number} sampleRate
 * @param {{ strategyKey?: string, fftSize?: number, hopSize?: number }} [options]
 * @returns {Promise<{ onsetsMs: number[], onsetsSec: number[] }>}
 */
export async function detectOnsetsOffline(samples, sampleRate, options = {}) {
  const strategy = resolveGuitarOnsetStrategy(options.strategyKey);
  const fftSize = options.fftSize ?? ONSET_FFT_SIZE;
  const hopSize = options.hopSize ?? Math.round(fftSize / ONSET_HOP_DIVISOR);
  const duration = samples.length / sampleRate;

  const frameInputs = await collectFrameData(samples, sampleRate, fftSize, hopSize);

  let state = strategy.createState();
  const onsetsSec = [];

  for (let i = 0; i < frameInputs.length; i++) {
    const { samples: frame, frequencyData } = frameInputs[i];
    const result = strategy.update(state, { frequencyData, samples: frame, sampleRate });
    state = result.nextState;
    if (result.event === 'onset') {
      const offset = i * hopSize;
      const tEnd = Math.min(duration, (offset + fftSize) / sampleRate);
      onsetsSec.push(tEnd);
    }
  }

  return {
    onsetsSec,
    onsetsMs: onsetsSec.map(sec => Math.round(sec * 1000)),
  };
}
