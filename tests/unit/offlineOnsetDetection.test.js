import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockModel = { session: {}, schema: {} };
const detectOnsetsOfflineXGBoost = vi.fn();
const loadDefaultXGBoostOnsetModel = vi.fn();

vi.mock('../../js/shared/audio/offlineOnsetDetectionXGBoost.js', () => ({
  detectOnsetsOfflineXGBoost,
  loadDefaultXGBoostOnsetModel,
}));

const { detectOnsetsOffline } = await import('../../js/shared/audio/offlineOnsetDetection.js');
const { GUITAR_ONSET_STRATEGY_KEYS } = await import('../../js/shared/audio/guitarOnsetStrategies.js');

const SR = 44100;

function silence(frames = 1) {
  return new Float32Array(frames * 4096);
}

describe('detectOnsetsOffline', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    detectOnsetsOfflineXGBoost.mockResolvedValue({ onsetsMs: [], onsetsSec: [] });
    loadDefaultXGBoostOnsetModel.mockResolvedValue(mockModel);
  });

  it('returns a Promise (is async)', () => {
    const result = detectOnsetsOffline(silence(), SR);
    expect(result).toBeInstanceOf(Promise);
    return result;
  });

  it('uses the default XGBoost model and detector', async () => {
    const samples = silence();
    await detectOnsetsOffline(samples, SR);

    expect(loadDefaultXGBoostOnsetModel).toHaveBeenCalledOnce();
    expect(detectOnsetsOfflineXGBoost).toHaveBeenCalledWith(samples, SR, mockModel, {
      threshold: undefined,
      refractoryMs: undefined,
      onsetStrategyKey: GUITAR_ONSET_STRATEGY_KEYS.SWEEP_STANDARD,
    });
  });

  it('maps removed old strategy keys to the XGBoost detector', async () => {
    await detectOnsetsOffline(silence(), SR, {
      strategyKey: 'guitar-onset-broadband-or',
      threshold: 0.4,
      refractoryMs: 80,
    });

    expect(detectOnsetsOfflineXGBoost).toHaveBeenCalledWith(expect.any(Float32Array), SR, mockModel, {
      threshold: 0.4,
      refractoryMs: 80,
      onsetStrategyKey: GUITAR_ONSET_STRATEGY_KEYS.SWEEP_STANDARD,
    });
  });
});
