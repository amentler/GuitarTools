import { describe, expect, it } from 'vitest';
import {
  DEFAULT_GUITAR_ONSET_STRATEGY_KEY,
  GUITAR_ONSET_STRATEGY_KEYS,
  GUITAR_ONSET_STRATEGIES,
  SWEEP_STANDARD_GUITAR_ONSET_OPTIONS,
  BROADBAND_OR_GUITAR_ONSET_OPTIONS,
  resolveGuitarOnsetStrategy,
  getGuitarOnsetStrategies,
} from '../../js/shared/audio/guitarOnsetStrategies.js';

describe('guitarOnsetStrategies', () => {
  it('exports at least one strategy', () => {
    expect(GUITAR_ONSET_STRATEGIES.length).toBeGreaterThan(0);
  });

  it('each strategy has required interface', () => {
    for (const strategy of GUITAR_ONSET_STRATEGIES) {
      expect(typeof strategy.key).toBe('string');
      expect(typeof strategy.label).toBe('string');
      expect(typeof strategy.description).toBe('string');
      expect(typeof strategy.createState).toBe('function');
      expect(typeof strategy.update).toBe('function');
    }
  });

  it('guitar-onset key is defined', () => {
    expect(GUITAR_ONSET_STRATEGY_KEYS.GUITAR_ONSET).toBe('guitar-onset');
    expect(GUITAR_ONSET_STRATEGY_KEYS.SWEEP_STANDARD).toBe('guitar-onset-sweep-standard');
    expect(DEFAULT_GUITAR_ONSET_STRATEGY_KEY).toBe(GUITAR_ONSET_STRATEGY_KEYS.SWEEP_STANDARD);
  });

  it('resolveGuitarOnsetStrategy returns default for unknown key', () => {
    const s = resolveGuitarOnsetStrategy('unknown-key');
    expect(s.key).toBe(GUITAR_ONSET_STRATEGY_KEYS.SWEEP_STANDARD);
  });

  it('resolveGuitarOnsetStrategy returns correct strategy by key', () => {
    const s = resolveGuitarOnsetStrategy(GUITAR_ONSET_STRATEGY_KEYS.GUITAR_ONSET);
    expect(s.key).toBe(GUITAR_ONSET_STRATEGY_KEYS.GUITAR_ONSET);

    const standard = resolveGuitarOnsetStrategy(GUITAR_ONSET_STRATEGY_KEYS.SWEEP_STANDARD);
    expect(standard.key).toBe(GUITAR_ONSET_STRATEGY_KEYS.SWEEP_STANDARD);
  });

  it('getGuitarOnsetStrategies returns same array as GUITAR_ONSET_STRATEGIES', () => {
    expect(getGuitarOnsetStrategies()).toBe(GUITAR_ONSET_STRATEGIES);
  });

  it('guitar-onset strategy createState returns a valid state object', () => {
    const strategy = resolveGuitarOnsetStrategy(GUITAR_ONSET_STRATEGY_KEYS.GUITAR_ONSET);
    const state = strategy.createState();
    expect(state).toBeDefined();
    expect(typeof state).toBe('object');
  });

  it('guitar-onset strategy update returns nextState and event', () => {
    const strategy = resolveGuitarOnsetStrategy(GUITAR_ONSET_STRATEGY_KEYS.SWEEP_STANDARD);
    const state = strategy.createState();
    const samples = new Float32Array(2048).fill(0.001);
    const frequencyData = new Float32Array(1024).fill(-100);
    const result = strategy.update(state, { samples, frequencyData });
    expect(result).toHaveProperty('nextState');
    expect(result.event === null || result.event === 'onset').toBe(true);
  });

  it('guitar-onset detects onset on strong RMS spike', () => {
    const strategy = resolveGuitarOnsetStrategy(GUITAR_ONSET_STRATEGY_KEYS.SWEEP_STANDARD);

    const makeSpectrum = (db, length = 1024) => new Float32Array(length).fill(db);
    const makeSamples = (rms, length = 2048) => new Float32Array(length).fill(rms);

    // quiet frame first
    let state = strategy.createState();
    ({ nextState: state } = strategy.update(state, {
      frequencyData: makeSpectrum(-100),
      samples: makeSamples(0.001),
    }));

    // strong broadband onset
    const freq = new Float32Array(1024);
    for (let i = 2; i < freq.length; i += 4) freq[i] = -20;
    freq.fill(-100, 0, 2);

    const result = strategy.update(state, {
      frequencyData: freq,
      samples: makeSamples(0.04),
    });
    expect(result.event).toBe('onset');
  });

  it('BROADBAND_OR key is defined', () => {
    expect(GUITAR_ONSET_STRATEGY_KEYS.BROADBAND_OR).toBe('guitar-onset-broadband-or');
  });

  it('broadband-OR strategy can be resolved by key', () => {
    const strategy = resolveGuitarOnsetStrategy(GUITAR_ONSET_STRATEGY_KEYS.BROADBAND_OR);
    expect(strategy.key).toBe(GUITAR_ONSET_STRATEGY_KEYS.BROADBAND_OR);
  });

  it('BROADBAND_OR_GUITAR_ONSET_OPTIONS has broadbandOrMinBins and disables relative attacks', () => {
    expect(typeof BROADBAND_OR_GUITAR_ONSET_OPTIONS.broadbandOrMinBins).toBe('number');
    expect(BROADBAND_OR_GUITAR_ONSET_OPTIONS.relativeReattackFactor == null).toBe(true);
    expect(BROADBAND_OR_GUITAR_ONSET_OPTIONS.relativeFluxFactor == null).toBe(true);
    expect(BROADBAND_OR_GUITAR_ONSET_OPTIONS.confirmedRmsFactor == null).toBe(true);
  });

  it('broadband-OR strategy detects onset on moderate broadband signal that fails sweep-standard broadbandAttack', () => {
    const strategy = resolveGuitarOnsetStrategy(GUITAR_ONSET_STRATEGY_KEYS.BROADBAND_OR);
    let state = strategy.createState();
    ({ nextState: state } = strategy.update(state, {
      frequencyData: new Float32Array(1024).fill(-100),
      samples: new Float32Array(2048).fill(0.001),
    }));

    // 50 bins at -6 dB: flux ≈ 0.025 >= minFlux but bandRatio ≈ 0.049 < minBandRatio
    // broadbandAttack (AND) would fail; broadbandOrAttack (OR) must fire
    const freq = new Float32Array(1024).fill(-100);
    for (let i = 2; i < 52; i++) freq[i] = -6;

    const result = strategy.update(state, {
      frequencyData: freq,
      samples: new Float32Array(2048).fill(0.01),
    });
    expect(result.event).toBe('onset');
  });

  it('sweep standard strategy applies the baked-in sweep options', () => {
    const strategy = resolveGuitarOnsetStrategy(GUITAR_ONSET_STRATEGY_KEYS.SWEEP_STANDARD);
    const state = strategy.createState();
    const samples = new Float32Array(2048).fill(0.001);
    const frequencyData = new Float32Array(1024).fill(-100);
    const result = strategy.update(state, { samples, frequencyData });

    expect(result.options.cooldownFrames).toBe(SWEEP_STANDARD_GUITAR_ONSET_OPTIONS.cooldownFrames);
    expect(result.options.confirmedRmsFactor).toBe(SWEEP_STANDARD_GUITAR_ONSET_OPTIONS.confirmedRmsFactor);
    expect(result.options.spectralNoveltyMinBins).toBe(SWEEP_STANDARD_GUITAR_ONSET_OPTIONS.spectralNoveltyMinBins);
  });
});
