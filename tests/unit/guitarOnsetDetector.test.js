import { describe, expect, it } from 'vitest';
import {
  createGuitarOnsetState,
  DEFAULT_GUITAR_ONSET_OPTIONS,
  updateGuitarOnsetDetector,
} from '../../js/shared/audio/guitarOnsetDetector.js';

function samples(rms, length = 2048) {
  const buffer = new Float32Array(length);
  buffer.fill(rms);
  return buffer;
}

function spectrum(db, length = 1024) {
  const data = new Float32Array(length);
  data.fill(db);
  return data;
}

function mixedSpectrum(baseDb, boostedDb, boostedEvery = 4, length = 1024) {
  const data = spectrum(baseDb, length);
  for (let i = 2; i < data.length; i += boostedEvery) {
    data[i] = boostedDb;
  }
  return data;
}

describe('guitarOnsetDetector', () => {
  it('exposes the current detector defaults as a central options object', () => {
    expect(DEFAULT_GUITAR_ONSET_OPTIONS.minRms).toBe(0.005);
    expect(DEFAULT_GUITAR_ONSET_OPTIONS.cooldownFrames).toBe(3);
    expect(DEFAULT_GUITAR_ONSET_OPTIONS.relativeReattackFactor).toBe(4);
    expect(DEFAULT_GUITAR_ONSET_OPTIONS.relativeFluxFactor).toBe(1.4);
    expect(DEFAULT_GUITAR_ONSET_OPTIONS.spectralNoveltyMinBins).toBe(34);
    expect(DEFAULT_GUITAR_ONSET_OPTIONS.confirmedRmsFactor).toBe(1.420684);
    expect(DEFAULT_GUITAR_ONSET_OPTIONS.confirmedFluxFactor).toBe(2.097673);
  });

  it('detects a broadband spectral attack independently of pitch', () => {
    let state = createGuitarOnsetState();
    ({ nextState: state } = updateGuitarOnsetDetector(state, {
      frequencyData: spectrum(-100),
      samples: samples(0.001),
    }));

    const result = updateGuitarOnsetDetector(state, {
      frequencyData: mixedSpectrum(-100, -20),
      samples: samples(0.04),
    });

    expect(result.event).toBe('onset');
    expect(result.broadbandFlux).toBeGreaterThan(0);
    expect(result.bandRatio).toBeGreaterThan(0.075);
  });

  it('does not retrigger on a steady sustained spectrum', () => {
    let state = createGuitarOnsetState();
    ({ nextState: state } = updateGuitarOnsetDetector(state, {
      frequencyData: spectrum(-100),
      samples: samples(0.001),
    }));
    ({ nextState: state } = updateGuitarOnsetDetector(state, {
      frequencyData: mixedSpectrum(-100, -20),
      samples: samples(0.04),
    }));

    for (let i = 0; i < 12; i++) {
      const result = updateGuitarOnsetDetector(state, {
        frequencyData: mixedSpectrum(-100, -20),
        samples: samples(0.035),
      });
      state = result.nextState;
      expect(result.event).toBeNull();
    }
  });

  it('detects a real-guitar style RMS attack when spectral energy is sparse', () => {
    let state = createGuitarOnsetState();
    ({ nextState: state } = updateGuitarOnsetDetector(state, {
      frequencyData: spectrum(-120),
      samples: samples(0.0002),
    }));

    const sparseAttack = spectrum(-120);
    for (const bin of [10, 21, 43, 86, 172, 344, 688]) {
      sparseAttack[bin] = -42;
    }

    const result = updateGuitarOnsetDetector(state, {
      frequencyData: sparseAttack,
      samples: samples(0.08),
    });

    expect(result.event).toBe('onset');
    expect(result.activeBandRatio).toBeGreaterThan(0);
  });

  it('ignores narrow-band changes that are not guitar-like broadband attacks', () => {
    let state = createGuitarOnsetState();
    ({ nextState: state } = updateGuitarOnsetDetector(state, {
      frequencyData: spectrum(-100),
      samples: samples(0.001),
    }));

    const narrow = spectrum(-100);
    narrow[120] = -12;
    narrow[121] = -12;

    const result = updateGuitarOnsetDetector(state, {
      frequencyData: narrow,
      samples: samples(0.04),
    });

    expect(result.event).toBeNull();
    expect(result.bandRatio).toBeLessThan(0.075);
  });

  it('detects a re-attack after cooldown while the previous note is still ringing', () => {
    let state = createGuitarOnsetState();
    ({ nextState: state } = updateGuitarOnsetDetector(state, {
      frequencyData: spectrum(-100),
      samples: samples(0.001),
    }));
    ({ nextState: state } = updateGuitarOnsetDetector(state, {
      frequencyData: mixedSpectrum(-100, -24),
      samples: samples(0.03),
    }));

    for (let i = 0; i < 4; i++) {
      ({ nextState: state } = updateGuitarOnsetDetector(state, {
        frequencyData: mixedSpectrum(-100, -28),
        samples: samples(0.022),
      }));
    }

    const reattack = updateGuitarOnsetDetector(state, {
      frequencyData: mixedSpectrum(-100, -14),
      samples: samples(0.045),
    });

    expect(reattack.event).toBe('onset');
  });

  it('can enable relative RMS re-attack detection with detector options', () => {
    let state = createGuitarOnsetState();
    const opts = {
      relativeReattackFactor: 1.6,
      relativeReattackMinDelta: 0.01,
    };
    ({ nextState: state } = updateGuitarOnsetDetector(state, {
      frequencyData: mixedSpectrum(-100, -24),
      samples: samples(0.03),
    }, opts));

    for (let i = 0; i < 4; i++) {
      ({ nextState: state } = updateGuitarOnsetDetector(state, {
        frequencyData: mixedSpectrum(-100, -24),
        samples: samples(0.025),
      }, opts));
    }

    const result = updateGuitarOnsetDetector(state, {
      frequencyData: mixedSpectrum(-100, -24),
      samples: samples(0.052),
    }, opts);

    expect(result.relativeRmsAttack).toBe(true);
    expect(result.event).toBe('onset');
  });

  it('confirms a weak RMS re-attack when spectral flux rises at the same time', () => {
    let state = createGuitarOnsetState();
    const opts = {
      minFlux: 0.5,
      minBandRatio: 0.5,
      rmsSpikeFactor: 10,
      spectralNoveltyRatio: 1.5,
      relativeReattackFactor: 10,
      relativeFluxFactor: 10,
      confirmedRmsFactor: 1.2,
      confirmedRmsMinDelta: 0.004,
      confirmedFluxFactor: 1.05,
      confirmedMinFlux: 0.003,
      confirmedMinBandRatio: 0.02,
      confirmedSpectralNoveltyMinBins: 2,
    };

    ({ nextState: state } = updateGuitarOnsetDetector(state, {
      frequencyData: spectrum(-100),
      samples: samples(0.001),
    }, opts));
    ({ nextState: state } = updateGuitarOnsetDetector(state, {
      frequencyData: mixedSpectrum(-100, -28, 8),
      samples: samples(0.03),
    }, opts));

    for (let i = 0; i < 3; i++) {
      ({ nextState: state } = updateGuitarOnsetDetector(state, {
        frequencyData: mixedSpectrum(-100, -28, 8),
        samples: samples(0.024),
      }, opts));
    }

    const result = updateGuitarOnsetDetector(state, {
      frequencyData: mixedSpectrum(-100, -22, 8),
      samples: samples(0.036),
    }, opts);

    expect(result.confirmedWeakRmsFluxAttack).toBe(true);
    expect(result.broadbandFlux).toBeLessThan(opts.minFlux);
    expect(result.relativeRmsAttack).toBe(false);
    expect(result.relativeSpectralAttack).toBe(false);
    expect(result.event).toBe('onset');
  });

  it('broadband-OR attack fires when flux exceeds minFlux with other attacks disabled', () => {
    let state = createGuitarOnsetState();
    ({ nextState: state } = updateGuitarOnsetDetector(state, {
      frequencyData: spectrum(-100),
      samples: samples(0.001),
    }));

    // 50 consecutive bins at -6 dB → flux ≈ 0.025 >= 0.018, bandRatio ≈ 0.049 < 0.075
    // broadbandAttack (AND) fails because bandRatio < minBandRatio
    const moderateFewBins = spectrum(-100);
    for (let i = 2; i < 52; i++) moderateFewBins[i] = -6;

    const opts = {
      broadbandOrMinBins: 5,
      rmsSpikeFactor: Infinity,
      rmsMinDelta: Infinity,
      relativeReattackFactor: null,
      relativeFluxFactor: null,
      confirmedRmsFactor: null,
    };

    const result = updateGuitarOnsetDetector(state, {
      frequencyData: moderateFewBins,
      samples: samples(0.01),
    }, opts);

    expect(result.broadbandOrAttack).toBe(true);
    expect(result.event).toBe('onset');
  });

  it('broadband-OR attack does not fire when broadbandOrMinBins is not set', () => {
    let state = createGuitarOnsetState();
    ({ nextState: state } = updateGuitarOnsetDetector(state, {
      frequencyData: spectrum(-100),
      samples: samples(0.001),
    }));

    const moderateFewBins = spectrum(-100);
    for (let i = 2; i < 52; i++) moderateFewBins[i] = -6;

    // Same signal, all history/spike attacks disabled, but no broadbandOrMinBins
    const opts = {
      rmsSpikeFactor: Infinity,
      rmsMinDelta: Infinity,
      relativeReattackFactor: null,
      relativeFluxFactor: null,
      confirmedRmsFactor: null,
    };

    const result = updateGuitarOnsetDetector(state, {
      frequencyData: moderateFewBins,
      samples: samples(0.01),
    }, opts);

    expect(result.broadbandOrAttack).toBe(false);
    expect(result.event).toBeNull();
  });

  it('can override cooldown for a strong configured re-attack', () => {
    let state = createGuitarOnsetState();
    const opts = {
      cooldownFrames: 8,
      cooldownOverrideFactor: 1.7,
      cooldownOverrideMinFlux: 0.004,
      cooldownOverrideMinBandRatio: 0.02,
      relativeReattackFactor: 1.7,
      relativeReattackMinDelta: 0.012,
    };
    ({ nextState: state } = updateGuitarOnsetDetector(state, {
      frequencyData: spectrum(-100),
      samples: samples(0.001),
    }, opts));
    ({ nextState: state } = updateGuitarOnsetDetector(state, {
      frequencyData: mixedSpectrum(-100, -28),
      samples: samples(0.03),
    }, opts));

    const result = updateGuitarOnsetDetector(state, {
      frequencyData: mixedSpectrum(-100, -12),
      samples: samples(0.06),
    }, opts);

    expect(result.cooldownOverrideAttack).toBe(true);
    expect(result.event).toBe('onset');
  });
});
