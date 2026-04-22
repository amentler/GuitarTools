import { readWavFile } from './wavDecoder.js';

const FFT_SIZE = 4096;
const ANALYSIS_FRAMES = 6;
const SILENCE_DB = -200;

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

function computeDbSpectrum(samples, fftSize = FFT_SIZE) {
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

function buildFrequencyFrames(samples) {
  const totalWindow = FFT_SIZE * ANALYSIS_FRAMES;
  const centerStart = Math.max(0, Math.floor((samples.length - totalWindow) / 2));
  const frames = [];

  for (let i = 0; i < ANALYSIS_FRAMES; i++) {
    const start = Math.min(centerStart + i * FFT_SIZE, Math.max(0, samples.length - FFT_SIZE));
    const frame = samples.slice(start, start + FFT_SIZE);
    frames.push(computeDbSpectrum(frame, FFT_SIZE));
  }

  return frames;
}

export function installEssentiaDetectionHarness(wavPath) {
  const { samples, sampleRate } = readWavFile(wavPath);
  const frequencyFrames = buildFrequencyFrames(samples);
  const stream = {
    getTracks() {
      return [{ stop() {} }];
    },
  };

  let nextFrame = 0;

  const analyser = {
    fftSize: FFT_SIZE,
    get frequencyBinCount() {
      return this.fftSize / 2;
    },
    getFloatTimeDomainData(buffer) {
      buffer.fill(0.05);
    },
    getFloatFrequencyData(buffer) {
      const frame = frequencyFrames[Math.min(nextFrame, frequencyFrames.length - 1)];
      nextFrame += 1;
      buffer.set(frame.subarray(0, buffer.length));
    },
  };

  class FakeAudioContext {
    constructor() {
      this.state = 'running';
      this.sampleRate = sampleRate;
    }

    async resume() {}

    async close() {}

    createAnalyser() {
      return analyser;
    }

    createMediaStreamSource() {
      return {
        connect() {
          return analyser;
        },
      };
    }
  }

  Object.defineProperty(globalThis, 'navigator', {
    configurable: true,
    value: {
      mediaDevices: {
        async getUserMedia() {
          return stream;
        },
      },
    },
  });

  globalThis.AudioContext = FakeAudioContext;
  if (typeof window !== 'undefined') {
    window.AudioContext = FakeAudioContext;
  }
}
