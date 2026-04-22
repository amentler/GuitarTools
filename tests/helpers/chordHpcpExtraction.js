import { readWavFile } from './wavDecoder.js';
import { detectEssentiaPeaks } from '../../js/games/chordExerciseEssentia/essentiaChordDetection.js';
import {
  averageHpcps,
  computeHpcpPureJS,
} from '../../js/games/chordExerciseEssentia/essentiaChordLogic.js';

export const CHORD_HPCP_FFT_SIZE = 4096;
export const CHORD_HPCP_ANALYSIS_FRAMES = 6;
const SILENCE_DB = -200;
const HPCP_REFERENCE_HZ = 261.626;

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

function computeDbSpectrum(samples, fftSize = CHORD_HPCP_FFT_SIZE) {
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

export function buildFrequencyFrames(samples, fftSize = CHORD_HPCP_FFT_SIZE, frameCount = CHORD_HPCP_ANALYSIS_FRAMES) {
  const totalWindow = fftSize * frameCount;
  const centerStart = Math.max(0, Math.floor((samples.length - totalWindow) / 2));
  const frames = [];

  for (let i = 0; i < frameCount; i++) {
    const start = Math.min(centerStart + i * fftSize, Math.max(0, samples.length - fftSize));
    const frame = samples.slice(start, start + fftSize);
    frames.push(computeDbSpectrum(frame, fftSize));
  }

  return frames;
}

export function extractHpcpAnalysisFromSamples(samples, sampleRate) {
  const frames = buildFrequencyFrames(samples);
  const hpcpFrames = frames.map(frame => {
    const { peakFreqs, peakMags } = detectEssentiaPeaks(frame, sampleRate);
    return computeHpcpPureJS(peakFreqs, peakMags, HPCP_REFERENCE_HZ);
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

