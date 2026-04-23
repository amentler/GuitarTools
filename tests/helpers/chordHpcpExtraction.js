import { readWavFile } from './wavDecoder.js';
import {
  detectEssentiaPeaks,
  normalizeFrequencyDataToPeak,
  normalizePeakMagnitudes,
} from '../../js/games/chordExerciseEssentia/essentiaChordDetection.js';
import {
  averageHpcps,
  computeHpcpPureJS,
} from '../../js/games/chordExerciseEssentia/essentiaChordLogic.js';

export const CHORD_HPCP_FFT_SIZE = 4096;
export const CHORD_HPCP_ANALYSIS_FRAMES = 6;
export const CHORD_HPCP_ATTACK_SETTLE_MS = 150;
export const CHORD_HPCP_FRAME_INTERVAL_MS = 80;
const SILENCE_DB = -200;
const HPCP_REFERENCE_HZ = 261.626;
const RMS_SPIKE_FACTOR = 3;
const GUITAR_MIN_RMS = 0.008;
const ONSET_PEAK_RATIO = 0.08;

function fftInPlace(re, im) {
  const n = re.length;
  let j = 0;

  for (let i = 1; i < n; i++) {
    let bit = n >> 1;
    for (; j & bit; bit >>= 1) j ^= bit;
    j ^= bit;
    if (i < j) {
      let tmp = re[i];
      re[i] = re[j];
      re[j] = tmp;
      tmp = im[i];
      im[i] = im[j];
      im[j] = tmp;
    }
  }

  for (let len = 2; len <= n; len <<= 1) {
    const ang = -2 * Math.PI / len;
    const wRe = Math.cos(ang);
    const wIm = Math.sin(ang);

    for (let i = 0; i < n; i += len) {
      let curRe = 1;
      let curIm = 0;
      const half = len >> 1;

      for (let k = 0; k < half; k++) {
        const uRe = re[i + k];
        const uIm = im[i + k];
        const vRe = re[i + k + half] * curRe - im[i + k + half] * curIm;
        const vIm = re[i + k + half] * curIm + im[i + k + half] * curRe;

        re[i + k] = uRe + vRe;
        im[i + k] = uIm + vIm;
        re[i + k + half] = uRe - vRe;
        im[i + k + half] = uIm - vIm;

        const nextRe = curRe * wRe - curIm * wIm;
        curIm = curRe * wIm + curIm * wRe;
        curRe = nextRe;
      }
    }
  }
}

export function computeDbSpectrum(samples, fftSize = CHORD_HPCP_FFT_SIZE) {
  const re = new Float64Array(fftSize);
  const im = new Float64Array(fftSize);
  const n = Math.min(samples.length, fftSize);

  for (let i = 0; i < n; i++) {
    const window = 0.5 * (1 - Math.cos((2 * Math.PI * i) / (fftSize - 1)));
    re[i] = samples[i] * window;
  }

  fftInPlace(re, im);

  const bins = fftSize >> 1;
  const norm = fftSize >> 1;
  const spectrum = new Float32Array(bins);

  for (let i = 0; i < bins; i++) {
    const mag = Math.sqrt(re[i] * re[i] + im[i] * im[i]) / norm;
    spectrum[i] = mag > 1e-9 ? 20 * Math.log10(mag) : SILENCE_DB;
  }

  return spectrum;
}

function computeRms(samples, start = 0, size = samples.length) {
  let sum = 0;
  const end = Math.min(samples.length, start + size);
  for (let i = start; i < end; i++) sum += samples[i] * samples[i];
  return Math.sqrt(sum / Math.max(1, end - start));
}

export function findStrumOnsetSample(samples, sampleRate, fftSize = CHORD_HPCP_FFT_SIZE) {
  let peak = 0;
  for (const sample of samples) peak = Math.max(peak, Math.abs(sample));
  const threshold = Math.max(RMS_SPIKE_FACTOR * GUITAR_MIN_RMS, peak * ONSET_PEAK_RATIO);
  const hopSize = Math.max(1, Math.floor(sampleRate * 0.05));

  for (let start = 0; start < samples.length; start += hopSize) {
    if (computeRms(samples, start, fftSize) > threshold) return start;
  }

  return 0;
}

export function buildFrequencyFrames(samples, fftSize = CHORD_HPCP_FFT_SIZE, frameCount = CHORD_HPCP_ANALYSIS_FRAMES, sampleRate = 44100) {
  const onsetStart = findStrumOnsetSample(samples, sampleRate, fftSize);
  const attackSettleSamples = Math.floor(sampleRate * CHORD_HPCP_ATTACK_SETTLE_MS / 1000);
  const frameIntervalSamples = Math.floor(sampleRate * CHORD_HPCP_FRAME_INTERVAL_MS / 1000);
  const firstFrameStart = Math.min(
    Math.max(0, onsetStart + attackSettleSamples),
    Math.max(0, samples.length - fftSize),
  );
  const frames = [];

  for (let i = 0; i < frameCount; i++) {
    const start = Math.min(firstFrameStart + i * frameIntervalSamples, Math.max(0, samples.length - fftSize));
    const frame = samples.slice(start, start + fftSize);
    frames.push(computeDbSpectrum(frame, fftSize));
  }

  return frames;
}

export function extractHpcpAnalysisFromSamples(samples, sampleRate) {
  const frames = buildFrequencyFrames(samples, CHORD_HPCP_FFT_SIZE, CHORD_HPCP_ANALYSIS_FRAMES, sampleRate);
  const hpcpFrames = frames.map(frame => {
    const { peakFreqs, peakMags } = detectEssentiaPeaks(normalizeFrequencyDataToPeak(frame), sampleRate);
    return computeHpcpPureJS(peakFreqs, normalizePeakMagnitudes(peakMags), HPCP_REFERENCE_HZ);
  });

  return {
    hpcpFrames,
    averageHpcp: averageHpcps(hpcpFrames),
  };
}

export function extractHpcpAnalysisFromWav(wavPath) {
  const { samples, sampleRate } = readWavFile(wavPath);
  const analysis = extractHpcpAnalysisFromSamples(samples, sampleRate);
  return {
    sampleRate,
    ...analysis,
  };
}
