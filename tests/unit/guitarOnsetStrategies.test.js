import { describe, expect, it } from 'vitest';
import {
  GUITAR_ONSET_STRATEGY_KEYS,
  GUITAR_ONSET_STRATEGIES,
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
  });

  it('resolveGuitarOnsetStrategy returns default for unknown key', () => {
    const s = resolveGuitarOnsetStrategy('unknown-key');
    expect(s.key).toBe(GUITAR_ONSET_STRATEGY_KEYS.GUITAR_ONSET);
  });

  it('resolveGuitarOnsetStrategy returns correct strategy by key', () => {
    const s = resolveGuitarOnsetStrategy(GUITAR_ONSET_STRATEGY_KEYS.GUITAR_ONSET);
    expect(s.key).toBe(GUITAR_ONSET_STRATEGY_KEYS.GUITAR_ONSET);
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
    const strategy = resolveGuitarOnsetStrategy(GUITAR_ONSET_STRATEGY_KEYS.GUITAR_ONSET);
    const state = strategy.createState();
    const samples = new Float32Array(2048).fill(0.001);
    const frequencyData = new Float32Array(1024).fill(-100);
    const result = strategy.update(state, { samples, frequencyData });
    expect(result).toHaveProperty('nextState');
    expect(result.event === null || result.event === 'onset').toBe(true);
  });

  it('guitar-onset detects onset on strong RMS spike', () => {
    const strategy = resolveGuitarOnsetStrategy(GUITAR_ONSET_STRATEGY_KEYS.GUITAR_ONSET);

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
});
