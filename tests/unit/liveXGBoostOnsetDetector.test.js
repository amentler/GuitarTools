import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  createLiveXGBoostOnsetState,
  updateLiveXGBoostOnsetDetector,
} from '../../js/shared/audio/liveXGBoostOnsetDetector.js';

const FEATURE_ORDER = [
  'rms.current',
  'broadbandFlux.current',
  'mfcc_00.current',
];

function createModel(probabilities) {
  let index = 0;
  return {
    schema: {
      inputName: 'input',
      outputName: 'probabilities',
      featureOrder: FEATURE_ORDER,
      audioConfig: {
        sampleRate: 48000,
        fftSize: 1024,
        hopSize: 256,
        logCompression: 1000,
      },
      decision: {
        probabilityThreshold: 0.85,
        refractoryMs: 30,
        lookaheadFrames: 1,
      },
      normalization: { enabled: false },
    },
    session: {
      inputNames: ['input'],
      run: vi.fn(async () => {
        const p = probabilities[Math.min(index, probabilities.length - 1)];
        index++;
        return {
          probabilities: { data: new Float32Array([1 - p, p]) },
        };
      }),
    },
  };
}

describe('liveXGBoostOnsetDetector', () => {
  beforeEach(() => {
    vi.stubGlobal('ort', {
      Tensor: class Tensor {
        constructor(type, data, dims) {
          this.type = type;
          this.data = data;
          this.dims = dims;
        }
      },
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('uses one-frame lookahead before emitting a live onset', async () => {
    const model = createModel([0.95, 0.1]);
    const state = await createLiveXGBoostOnsetState({ model });
    const samples = new Float32Array(1024);
    const frequencyData = new Float32Array(512).fill(-120);

    const first = await updateLiveXGBoostOnsetDetector(state, {
      samples,
      frequencyData,
      sampleRate: 48000,
    });
    expect(first.event).toBeNull();

    const second = await updateLiveXGBoostOnsetDetector(state, {
      samples,
      frequencyData,
      sampleRate: 48000,
    });
    expect(second.event).toBe('onset');
    expect(second.eventTimeMs).toBe(0);
    expect(second.averageElapsedMs).toBeGreaterThanOrEqual(0);
    expect(model.session.run).toHaveBeenCalledTimes(2);
  });
});
