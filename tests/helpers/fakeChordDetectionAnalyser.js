import path from 'path';
import { fileURLToPath } from 'url';
import { readWavFile } from './wavDecoder.js';
import { computeDbSpectrum } from './chordHpcpExtraction.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CHORD_FIXTURES_DIR = path.join(__dirname, '../fixtures/chords');
const DEFAULT_FFT_SIZE = 4096;

function clampStart(start, samples, fftSize) {
  return Math.min(Math.max(0, start), Math.max(0, samples.length - fftSize));
}

export class FakeChordDetectionAnalyser {
  constructor(samples, sampleRate, fftSize = DEFAULT_FFT_SIZE) {
    this.samples = samples;
    this.sampleRate = sampleRate;
    this._fftSize = fftSize;
    this.frequencyBinCount = fftSize / 2;
    this.currentSample = 0;
  }

  get fftSize() {
    return this._fftSize;
  }

  set fftSize(value) {
    this._fftSize = value;
    this.frequencyBinCount = value / 2;
  }

  advanceTime(ms) {
    const sampleDelta = Math.max(0, Math.floor(this.sampleRate * ms / 1000));
    this.currentSample = Math.min(this.samples.length, this.currentSample + sampleDelta);
  }

  getFloatTimeDomainData(buffer) {
    buffer.fill(0);
    const start = clampStart(this.currentSample, this.samples, buffer.length);
    const frame = this.samples.subarray(start, start + buffer.length);
    buffer.set(frame, 0);
  }

  getFloatFrequencyData(buffer) {
    const start = clampStart(this.currentSample, this.samples, this.fftSize);
    const frame = this.samples.subarray(start, start + this.fftSize);
    const spectrum = computeDbSpectrum(frame, this.fftSize);
    buffer.set(spectrum.subarray(0, buffer.length), 0);
  }
}

export function createFakeChordDetectionAnalyserFromWav(relativeWavFile, fftSize = DEFAULT_FFT_SIZE) {
  const { samples, sampleRate } = readWavFile(path.join(CHORD_FIXTURES_DIR, relativeWavFile));
  return new FakeChordDetectionAnalyser(samples, sampleRate, fftSize);
}

export function createAdvancingWait(analyser) {
  return async function advancingWait(ms) {
    analyser.advanceTime(ms);
  };
}
