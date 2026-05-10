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
    expect(DEFAULT_GUITAR_ONSET_OPTIONS.cooldownFrames).toBe(4);
    expect(DEFAULT_GUITAR_ONSET_OPTIONS.relativeReattackFactor).toBe(Number.POSITIVE_INFINITY);
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
