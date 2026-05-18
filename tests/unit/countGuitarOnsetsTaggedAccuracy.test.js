import { describe, expect, it } from 'vitest';
import {
  GUITAR_ONSET_STRATEGY_KEYS,
  resolveGuitarOnsetStrategy,
} from '../../js/shared/audio/guitarOnsetStrategies.js';

describe('countGuitarOnsets – getaggte Onset-Genauigkeit', () => {
  it('leitet entfernte alte Onset-Strategie-Keys auf XGBoost um', () => {
    expect(resolveGuitarOnsetStrategy('guitar-onset-broadband-or').key)
      .toBe(GUITAR_ONSET_STRATEGY_KEYS.XGBOOST_ANDROID_FIREFOX);
  });
});
