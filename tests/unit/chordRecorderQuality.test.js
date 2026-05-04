import { describe, it, expect } from 'vitest';
import {
  checkClipping,
  checkTooQuiet,
  checkTooShort,
  checkNoOnset,
  checkSilenceRatio,
  runQualityGates,
} from '../../js/tools/chordRecorder/chordRecorderQuality.js';

const SR = 44100;

function makeSamples(length, value = 0) {
  return new Float32Array(length).fill(value);
}

function makeSineWave(length, amplitude = 0.5) {
  const s = new Float32Array(length);
  for (let i = 0; i < length; i++) s[i] = amplitude * Math.sin((2 * Math.PI * 440 * i) / SR);
  return s;
}

function makeOnsetSamples(sampleRate, onsetOffsetSec = 0.5, amplitude = 0.5) {
  const total = sampleRate * 4;
  const s = new Float32Array(total).fill(0);
  const start = Math.floor(onsetOffsetSec * sampleRate);
  for (let i = start; i < total; i++) {
    s[i] = amplitude * Math.sin((2 * Math.PI * 440 * (i - start)) / sampleRate);
  }
  return s;
}

// ── checkClipping ─────────────────────────────────────────────────────────────

describe('checkClipping', () => {
  it('erkennt Clipping bei Peak > 0.95', () => {
    const s = makeSamples(1024, 0.3);
    s[500] = 0.96;
    expect(checkClipping(s)).toBe(true);
  });

  it('erkennt Clipping bei negativem Peak < -0.95', () => {
    const s = makeSamples(1024, 0.3);
    s[500] = -0.96;
    expect(checkClipping(s)).toBe(true);
  });

  it('kein Clipping bei Peak <= 0.95', () => {
    expect(checkClipping(makeSamples(1024, 0.5))).toBe(false);
  });

  it('kein Clipping bei Nullvektor', () => {
    expect(checkClipping(makeSamples(1024, 0))).toBe(false);
  });

  it('Grenzwert genau 0.95 → kein Clipping', () => {
    const s = makeSamples(1024, 0.0);
    s[0] = 0.95;
    expect(checkClipping(s)).toBe(false);
  });

  it('Grenzwert 0.951 → Clipping', () => {
    const s = makeSamples(1024, 0.0);
    s[0] = 0.951;
    expect(checkClipping(s)).toBe(true);
  });
});

// ── checkTooQuiet ─────────────────────────────────────────────────────────────

describe('checkTooQuiet', () => {
  it('zu leise wenn RMS < 0.01', () => {
    expect(checkTooQuiet(makeSamples(SR, 0.001))).toBe(true);
  });

  it('nicht zu leise wenn RMS >= 0.01', () => {
    expect(checkTooQuiet(makeSamples(SR, 0.1))).toBe(false);
  });

  it('Nullvektor → zu leise', () => {
    expect(checkTooQuiet(makeSamples(SR, 0))).toBe(true);
  });

  it('Sinuswelle mit Amplitude 0.5 → nicht zu leise', () => {
    expect(checkTooQuiet(makeSineWave(SR, 0.5))).toBe(false);
  });
});

// ── checkTooShort ─────────────────────────────────────────────────────────────

describe('checkTooShort', () => {
  it('zu kurz wenn < 1.5 Sekunden', () => {
    expect(checkTooShort(1.0)).toBe(true);
    expect(checkTooShort(1.49)).toBe(true);
  });

  it('nicht zu kurz bei >= 1.5 Sekunden', () => {
    expect(checkTooShort(1.5)).toBe(false);
    expect(checkTooShort(3.0)).toBe(false);
  });

  it('0 Sekunden → zu kurz', () => {
    expect(checkTooShort(0)).toBe(true);
  });
});

// ── checkNoOnset ──────────────────────────────────────────────────────────────

describe('checkNoOnset', () => {
  it('kein Onset bei komplettem Nullvektor', () => {
    expect(checkNoOnset(makeSamples(SR * 4, 0), SR)).toBe(true);
  });

  it('kein Onset bei sehr leisen Samples', () => {
    expect(checkNoOnset(makeSamples(SR * 4, 0.001), SR)).toBe(true);
  });

  it('Onset erkannt wenn Anschlag in den ersten 3 Sekunden', () => {
    expect(checkNoOnset(makeOnsetSamples(SR, 0.5, 0.5), SR)).toBe(false);
  });

  it('Onset erkannt am Anfang (0 ms)', () => {
    expect(checkNoOnset(makeOnsetSamples(SR, 0, 0.5), SR)).toBe(false);
  });

  it('kein Onset wenn Signal erst nach 3 Sekunden kommt', () => {
    const total = SR * 5;
    const s = new Float32Array(total).fill(0);
    const start = Math.floor(3.5 * SR);
    for (let i = start; i < total; i++) s[i] = 0.5;
    expect(checkNoOnset(s, SR)).toBe(true);
  });
});

// ── checkSilenceRatio ─────────────────────────────────────────────────────────

describe('checkSilenceRatio', () => {
  it('hohe Silence-Ratio bei fast komplett stillen Samples', () => {
    const s = new Float32Array(SR * 3).fill(0);
    // Nur 10 % der Samples laut machen
    for (let i = 0; i < Math.floor(s.length * 0.1); i++) s[i] = 0.5;
    expect(checkSilenceRatio(s)).toBe(true);
  });

  it('keine hohe Silence-Ratio bei überwiegend lautem Signal', () => {
    expect(checkSilenceRatio(makeSamples(SR * 3, 0.5))).toBe(false);
  });

  it('Nullvektor → hohe Silence-Ratio', () => {
    expect(checkSilenceRatio(makeSamples(SR, 0))).toBe(true);
  });

  it('Sinuswelle mit Amplitude 0.5 → keine hohe Silence-Ratio', () => {
    expect(checkSilenceRatio(makeSineWave(SR * 2, 0.5))).toBe(false);
  });
});

// ── runQualityGates ───────────────────────────────────────────────────────────

describe('runQualityGates', () => {
  it('sauber aufgenommene Sinuswelle → passed: true, keine Fehler', () => {
    const samples = makeOnsetSamples(SR, 0.2, 0.5);
    const result = runQualityGates(samples, SR, 3.0);
    expect(result.passed).toBe(true);
    expect(result.failReasons).toEqual([]);
  });

  it('Clipping → passed: false, failReasons enthält "clipping"', () => {
    const s = makeOnsetSamples(SR, 0.2, 0.5);
    s[SR] = 0.99;
    const result = runQualityGates(s, SR, 3.0);
    expect(result.passed).toBe(false);
    expect(result.failReasons).toContain('clipping');
  });

  it('zu leise → passed: false, failReasons enthält "tooQuiet"', () => {
    const result = runQualityGates(makeSamples(SR * 3, 0.001), SR, 3.0);
    expect(result.passed).toBe(false);
    expect(result.failReasons).toContain('tooQuiet');
  });

  it('zu kurz → passed: false, failReasons enthält "tooShort"', () => {
    const result = runQualityGates(makeOnsetSamples(SR, 0.1, 0.5), SR, 1.0);
    expect(result.passed).toBe(false);
    expect(result.failReasons).toContain('tooShort');
  });

  it('kein Onset → passed: false, failReasons enthält "noOnset"', () => {
    const result = runQualityGates(makeSamples(SR * 3, 0.001), SR, 3.0);
    expect(result.passed).toBe(false);
    expect(result.failReasons).toContain('noOnset');
  });

  it('hohe Silence-Ratio → warnReasons enthält "highSilenceRatio", passed bleibt true wenn sonst ok', () => {
    // Onset zu Beginn, dann schnell leise
    const s = new Float32Array(SR * 3).fill(0);
    const onsetLen = Math.floor(0.1 * SR);
    for (let i = 0; i < onsetLen; i++) s[i] = 0.5;
    const result = runQualityGates(s, SR, 3.0);
    expect(result.warnReasons).toContain('highSilenceRatio');
  });

  it('mehrere FAIL-Gates gleichzeitig', () => {
    const s = makeSamples(SR * 3, 0.0);
    s[0] = 0.96;
    const result = runQualityGates(s, SR, 1.0);
    expect(result.passed).toBe(false);
    expect(result.failReasons).toContain('clipping');
    expect(result.failReasons).toContain('tooShort');
  });

  it('Ergebnis hat immer passed, failReasons und warnReasons', () => {
    const result = runQualityGates(makeSamples(1024, 0), SR, 0.1);
    expect(result).toHaveProperty('passed');
    expect(result).toHaveProperty('failReasons');
    expect(result).toHaveProperty('warnReasons');
    expect(Array.isArray(result.failReasons)).toBe(true);
    expect(Array.isArray(result.warnReasons)).toBe(true);
  });
});
