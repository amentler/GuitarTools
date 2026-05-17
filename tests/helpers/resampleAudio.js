/**
 * Linear interpolation resampler for offline audio processing.
 * Used by SFP scripts to match browser behaviour: AudioContext resamples
 * to the device sample rate (48000 Hz) before any analysis.
 */

/**
 * Resamples a mono Float32Array from one sample rate to another using
 * linear interpolation.
 *
 * @param {Float32Array} samples  Input samples
 * @param {number} fromRate       Source sample rate (e.g. 44100)
 * @param {number} toRate         Target sample rate (e.g. 48000)
 * @returns {Float32Array}        Resampled samples at toRate
 */
export function resampleLinear(samples, fromRate, toRate) {
  if (fromRate === toRate) return samples;
  const ratio = fromRate / toRate;
  const newLength = Math.round(samples.length / ratio);
  const out = new Float32Array(newLength);
  const last = samples.length - 1;
  for (let i = 0; i < newLength; i++) {
    const srcPos = i * ratio;
    const srcIdx = Math.floor(srcPos);
    const frac = srcPos - srcIdx;
    const a = samples[Math.min(srcIdx, last)];
    const b = samples[Math.min(srcIdx + 1, last)];
    out[i] = a + frac * (b - a);
  }
  return out;
}
