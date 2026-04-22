import { readWavFile } from './wavDecoder.js';
import {
  CHORD_HPCP_FFT_SIZE,
  buildFrequencyFrames,
} from './chordHpcpExtraction.js';

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
    fftSize: CHORD_HPCP_FFT_SIZE,
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
