import { describe, expect, it } from 'vitest';
import {
  DEFAULT_GUITAR_ONSET_STRATEGY_KEY,
  GUITAR_ONSET_STRATEGY_KEYS,
  GUITAR_ONSET_STRATEGIES,
  SWEEP_STANDARD_GUITAR_ONSET_OPTIONS,
  getGuitarOnsetStrategies,
  resolveGuitarOnsetBaseStrategy,
  resolveGuitarOnsetStrategy,
} from '../../js/shared/audio/guitarOnsetStrategies.js';

describe('guitarOnsetStrategies', () => {
  it('only exposes the default XGBoost detector as selectable strategy', () => {
    expect(GUITAR_ONSET_STRATEGIES.map(strategy => strategy.key)).toEqual([
      GUITAR_ONSET_STRATEGY_KEYS.XGBOOST_ANDROID_FIREFOX,
    ]);
    expect(getGuitarOnsetStrategies()).toBe(GUITAR_ONSET_STRATEGIES);
  });

  it('defines XGBoost as the default onset strategy', () => {
    expect(GUITAR_ONSET_STRATEGY_KEYS.XGBOOST_ANDROID_FIREFOX).toBe('xgboost-android-firefox');
    expect(DEFAULT_GUITAR_ONSET_STRATEGY_KEY).toBe(GUITAR_ONSET_STRATEGY_KEYS.XGBOOST_ANDROID_FIREFOX);
  });

  it('resolves unknown or old detector keys to the XGBoost strategy', () => {
    expect(resolveGuitarOnsetStrategy('unknown-key').key).toBe(GUITAR_ONSET_STRATEGY_KEYS.XGBOOST_ANDROID_FIREFOX);
    expect(resolveGuitarOnsetStrategy('guitar-onset').key).toBe(GUITAR_ONSET_STRATEGY_KEYS.XGBOOST_ANDROID_FIREFOX);
    expect(resolveGuitarOnsetStrategy('guitar-onset-broadband-or').key)
      .toBe(GUITAR_ONSET_STRATEGY_KEYS.XGBOOST_ANDROID_FIREFOX);
    expect(resolveGuitarOnsetStrategy('guitar-onset-legacy-bandpass').key)
      .toBe(GUITAR_ONSET_STRATEGY_KEYS.XGBOOST_ANDROID_FIREFOX);
  });

  it('keeps the sweep-standard base strategy internal for XGBoost feature extraction', () => {
    const baseStrategy = resolveGuitarOnsetBaseStrategy(GUITAR_ONSET_STRATEGY_KEYS.SWEEP_STANDARD);
    const state = baseStrategy.createState();
    const samples = new Float32Array(2048).fill(0.001);
    const frequencyData = new Float32Array(1024).fill(-100);
    const result = baseStrategy.update(state, { samples, frequencyData });

    expect(baseStrategy.key).toBe(GUITAR_ONSET_STRATEGY_KEYS.SWEEP_STANDARD);
    expect(result).toHaveProperty('nextState');
    expect(result.options.cooldownFrames).toBe(SWEEP_STANDARD_GUITAR_ONSET_OPTIONS.cooldownFrames);
    expect(result.options.confirmedRmsFactor).toBe(SWEEP_STANDARD_GUITAR_ONSET_OPTIONS.confirmedRmsFactor);
    expect(result.options.spectralNoveltyMinBins).toBe(SWEEP_STANDARD_GUITAR_ONSET_OPTIONS.spectralNoveltyMinBins);
  });
});
