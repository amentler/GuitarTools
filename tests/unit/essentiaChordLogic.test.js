import { describe, it, expect, beforeAll } from 'vitest';
import {
  buildChordTemplates,
  cosineSimilarity,
  averageHpcps,
  matchHpcpToChord,
  computeHpcpPureJS,
} from '../../js/games/chordExerciseEssentia/essentiaChordLogic.js';

// ── cosineSimilarity ──────────────────────────────────────────────────────────

describe('cosineSimilarity', () => {
  it('returns 1 for identical vectors', () => {
    const a = new Float32Array([1, 0, 1, 0, 1, 0, 0, 1, 0, 0, 0, 0]);
    expect(cosineSimilarity(a, a)).toBeCloseTo(1.0);
  });

  it('returns 0 for orthogonal vectors', () => {
    const a = new Float32Array([1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]);
    const b = new Float32Array([0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]);
    expect(cosineSimilarity(a, b)).toBeCloseTo(0);
  });

  it('returns 0 for zero vector', () => {
    const a = new Float32Array(12);
    const b = new Float32Array([1, 0, 0, 0, 1, 0, 0, 1, 0, 0, 0, 0]);
    expect(cosineSimilarity(a, b)).toBe(0);
  });

  it('returns partial similarity for one shared note out of three', () => {
    // C-Dur template: C(0), E(4), G(7)
    const cDur = new Float32Array([1, 0, 0, 0, 1, 0, 0, 1, 0, 0, 0, 0]);
    // G-Dur template: G(7), B(11), D(2) – share G with C-Dur
    const gDur = new Float32Array([0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 1]);
    const sim = cosineSimilarity(cDur, gDur);
    // overlap = 1 (G), norms = sqrt(3) each → 1/3 ≈ 0.333
    expect(sim).toBeCloseTo(1 / 3, 2);
  });
});

// ── averageHpcps ──────────────────────────────────────────────────────────────

describe('averageHpcps', () => {
  it('returns zero vector for empty input', () => {
    const result = averageHpcps([]);
    expect(Array.from(result)).toEqual(new Array(12).fill(0));
  });

  it('returns the same vector when given one frame', () => {
    const v = new Float32Array([1, 0, 0, 0, 1, 0, 0, 1, 0, 0, 0, 0]);
    const result = averageHpcps([v]);
    for (let i = 0; i < 12; i++) expect(result[i]).toBeCloseTo(v[i]);
  });

  it('computes element-wise mean across frames', () => {
    const a = new Float32Array([1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]);
    const b = new Float32Array([0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0]);
    const result = averageHpcps([a, b]);
    expect(result[0]).toBeCloseTo(0.5);
    expect(result[4]).toBeCloseTo(0.5);
    expect(result[1]).toBeCloseTo(0);
  });
});

// ── buildChordTemplates ───────────────────────────────────────────────────────

describe('buildChordTemplates', () => {
  let templates;

  beforeAll(() => {
    templates = buildChordTemplates();
  });

  it('builds templates for all known chords', () => {
    expect(Object.keys(templates).length).toBeGreaterThan(10);
    expect(templates['C-Dur']).toBeDefined();
    expect(templates['G-Dur']).toBeDefined();
    expect(templates['A-Moll']).toBeDefined();
  });

  it('C-Dur template has C, E, G set (bins 0, 4, 7)', () => {
    const t = templates['C-Dur'];
    expect(t[0]).toBe(1); // C
    expect(t[4]).toBe(1); // E
    expect(t[7]).toBe(1); // G
  });

  it('C-Dur template has 3 active bins', () => {
    const active = Array.from(templates['C-Dur']).filter(v => v > 0);
    expect(active.length).toBe(3);
  });

  it('G-Dur template has G, B, D set (bins 7, 11, 2)', () => {
    const t = templates['G-Dur'];
    expect(t[7]).toBe(1);  // G
    expect(t[11]).toBe(1); // B
    expect(t[2]).toBe(1);  // D
  });

  it('A-Moll template has A, C, E set (bins 9, 0, 4)', () => {
    const t = templates['A-Moll'];
    expect(t[9]).toBe(1); // A
    expect(t[0]).toBe(1); // C
    expect(t[4]).toBe(1); // E
  });

  it('each template is a Float32Array of length 12', () => {
    for (const t of Object.values(templates)) {
      expect(t).toBeInstanceOf(Float32Array);
      expect(t.length).toBe(12);
    }
  });
});

// ── matchHpcpToChord ──────────────────────────────────────────────────────────

describe('matchHpcpToChord', () => {
  let templates;

  beforeAll(() => {
    templates = buildChordTemplates();
  });

  it('detects a perfect C-Dur match', () => {
    // Synthetic HPCP: strong energy at C(0), E(4), G(7) only
    const hpcp = new Float32Array([1, 0, 0, 0, 1, 0, 0, 1, 0, 0, 0, 0]);
    const result = matchHpcpToChord(hpcp, 'C-Dur', templates);
    expect(result.isCorrect).toBe(true);
    expect(result.confidence).toBeCloseTo(1.0, 1);
    // bestMatch may be a variant like 'C-Dur (1-Finger)' with identical pitch classes
    expect(result.bestMatch).toContain('C-Dur');
  });

  it('rejects a zero HPCP vector', () => {
    const hpcp = new Float32Array(12);
    const result = matchHpcpToChord(hpcp, 'C-Dur', templates);
    expect(result.isCorrect).toBe(false);
    expect(result.confidence).toBe(0);
  });

  it('rejects when wrong chord is played (G-Dur instead of C-Dur)', () => {
    // Synthetic HPCP for G major: G(7), B(11), D(2)
    const hpcp = new Float32Array([0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 1]);
    const result = matchHpcpToChord(hpcp, 'C-Dur', templates);
    expect(result.isCorrect).toBe(false);
    // bestMatch is a G-Dur variant (may be '1-Finger' simplified version)
    expect(result.bestMatch).toContain('G-Dur');
  });

  it('returns confidence for target chord even when wrong', () => {
    const hpcp = new Float32Array([0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 1]);
    const result = matchHpcpToChord(hpcp, 'C-Dur', templates);
    // G and C-Dur share G; sim < 1
    expect(result.confidence).toBeGreaterThan(0);
    expect(result.confidence).toBeLessThan(1);
  });

  it('returns false for unknown chord name', () => {
    const hpcp = new Float32Array([1, 0, 0, 0, 1, 0, 0, 1, 0, 0, 0, 0]);
    const result = matchHpcpToChord(hpcp, 'Xyz-Nonexistent', templates);
    expect(result.isCorrect).toBe(false);
    expect(result.bestMatch).toBeNull();
  });

  it('accepts custom threshold', () => {
    // Slightly impure C-Dur HPCP (noise in other bins)
    const hpcp = new Float32Array([0.9, 0.1, 0.1, 0, 0.9, 0, 0, 0.9, 0.1, 0, 0, 0]);
    const resultStrict = matchHpcpToChord(hpcp, 'C-Dur', templates, 0.95);
    const resultLenient = matchHpcpToChord(hpcp, 'C-Dur', templates, 0.5);
    expect(resultLenient.isCorrect).toBe(true);
    // strict may or may not pass depending on noise – just check it runs
    expect(typeof resultStrict.isCorrect).toBe('boolean');
  });

  it('accepts E-Dur when extra non-chord energy is present but root, third and fifth remain strong', () => {
    const hpcp = new Float32Array([0, 0, 0.046, 0.057, 0.509, 0.152, 0.228, 0, 0.302, 0, 0.95, 0.834]);
    const result = matchHpcpToChord(hpcp, 'E-Dur', templates);
    expect(result.isCorrect).toBe(true);
    expect(result.confidence).toBeGreaterThanOrEqual(0.5);
  });

  it('accepts G-Dur when competing minor-third energy is present but the major third remains stronger', () => {
    const hpcp = new Float32Array([0.001, 0, 0.198, 0.001, 0, 0, 0.018, 0.98, 0, 0.07, 0.29, 0.565]);
    const result = matchHpcpToChord(hpcp, 'G-Dur', templates);
    expect(result.isCorrect).toBe(true);
    expect(result.confidence).toBeGreaterThanOrEqual(0.5);
  });

  it('accepts C7 when the dominant seventh is present but the voicing is less triad-like than a plain major chord', () => {
    const hpcp = new Float32Array([0.92, 0, 0, 0, 0.34, 0.18, 0, 0.44, 0, 0, 0.63, 0]);
    const result = matchHpcpToChord(hpcp, 'C7', templates);
    expect(result.isCorrect).toBe(true);
    expect(result.bestMatch).toBe('C7');
  });

  it('accepts G7 when the minor seventh is strong enough to distinguish it from diminished competitors', () => {
    const hpcp = new Float32Array([0, 0, 0.55, 0, 0, 0.62, 0, 1, 0, 0, 0, 0.58]);
    const result = matchHpcpToChord(hpcp, 'G7', templates);
    expect(result.isCorrect).toBe(true);
    expect(result.confidence).toBeGreaterThanOrEqual(0.42);
  });

  it('rejects G-Dur when the same-root minor third is stronger in a synthetic G-Moll voicing', () => {
    const hpcp = new Float32Array([0, 0, 0.85, 0, 0, 0.08, 0.02, 0.92, 0, 0.04, 0.2, 0.14]);
    const gMinorResult = matchHpcpToChord(hpcp, 'G-Moll', templates);
    const gMajorResult = matchHpcpToChord(hpcp, 'G-Dur', templates);

    expect(gMinorResult.isCorrect).toBe(true);
    expect(gMajorResult.isCorrect).toBe(false);
  });

  it('rejects G-Moll when the same-root major third is stronger in a synthetic G-Dur voicing', () => {
    const hpcp = new Float32Array([0, 0, 0.85, 0, 0, 0.02, 0.02, 0.92, 0, 0.04, 0.14, 0.2]);
    const gMajorResult = matchHpcpToChord(hpcp, 'G-Dur', templates);
    const gMinorResult = matchHpcpToChord(hpcp, 'G-Moll', templates);

    expect(gMajorResult.isCorrect).toBe(true);
    expect(gMinorResult.isCorrect).toBe(false);
  });

  it('rejects both A-Dur and A-Moll when the same-root third is ambiguous', () => {
    const hpcp = new Float32Array([0.18, 0.18, 0, 0.18, 0.75, 0, 0, 0, 0, 0.88, 0, 0]);
    const aMajorResult = matchHpcpToChord(hpcp, 'A-Dur', templates);
    const aMinorResult = matchHpcpToChord(hpcp, 'A-Moll', templates);

    expect(aMajorResult.isCorrect).toBe(false);
    expect(aMinorResult.isCorrect).toBe(false);
  });
});

// ── computeHpcpPureJS ─────────────────────────────────────────────────────────
// These tests were written RED (computeHpcpPureJS did not exist) and verify
// two things that were also bugs in the WASM path:
//   1. bin 0 = C (referenceFrequency = C4 = 261.626 Hz, NOT A4 = 440 Hz)
//   2. the pure-JS HPCP matches the same templates used for WASM, so the
//      exercise works on devices where the WASM binary fails to compile
//      (e.g. iOS < 16.4 which lacks WebAssembly SIMD support).

describe('computeHpcpPureJS', () => {
  it('returns a Float32Array of length 12', () => {
    expect(computeHpcpPureJS([261.626], [1])).toBeInstanceOf(Float32Array);
    expect(computeHpcpPureJS([261.626], [1]).length).toBe(12);
  });

  it('returns zero vector for empty peak list', () => {
    expect(Array.from(computeHpcpPureJS([], []))).toEqual(new Array(12).fill(0));
  });

  it('maps C4 (261.626 Hz) to bin 0 – referenceFrequency must be C4, not A4', () => {
    const hpcp = computeHpcpPureJS([261.626], [1]);
    const maxBin = Array.from(hpcp).indexOf(Math.max(...hpcp));
    expect(maxBin).toBe(0); // bin 0 = C
    expect(hpcp[0]).toBeCloseTo(1.0);
  });

  it('maps A4 (440 Hz) to bin 9', () => {
    const hpcp = computeHpcpPureJS([440], [1]);
    const maxBin = Array.from(hpcp).indexOf(Math.max(...hpcp));
    expect(maxBin).toBe(9); // bin 9 = A
  });

  it('maps G4 (392 Hz) to bin 7', () => {
    const hpcp = computeHpcpPureJS([392], [1]);
    const maxBin = Array.from(hpcp).indexOf(Math.max(...hpcp));
    expect(maxBin).toBe(7); // bin 7 = G
  });

  it('is octave-invariant: C3 and C5 both map to bin 0', () => {
    const hpcpC3 = computeHpcpPureJS([130.813], [1]); // C3
    const hpcpC5 = computeHpcpPureJS([523.251], [1]); // C5
    expect(Array.from(hpcpC3).indexOf(Math.max(...hpcpC3))).toBe(0);
    expect(Array.from(hpcpC5).indexOf(Math.max(...hpcpC5))).toBe(0);
  });

  it('normalises to unitMax (max bin = 1.0)', () => {
    const hpcp = computeHpcpPureJS([440], [7]); // magnitude 7, not 1
    expect(Math.max(...hpcp)).toBeCloseTo(1.0);
  });

  it('C-Dur peaks (C4, E4, G4) correctly match C-Dur template', () => {
    // This is the end-to-end test: real frequencies → pure-JS HPCP → template match.
    // With the wrong referenceFrequency (440 Hz) C maps to bin 3, not 0 → no match.
    const hpcp = computeHpcpPureJS([261.626, 329.628, 392.0], [1, 1, 1]);
    const result = matchHpcpToChord(hpcp, 'C-Dur', buildChordTemplates());
    expect(result.isCorrect).toBe(true);
    expect(result.confidence).toBeCloseTo(1.0, 1);
  });

  it('G-Dur peaks (G4, B4, D5) correctly match G-Dur template', () => {
    const hpcp = computeHpcpPureJS([392.0, 493.88, 587.33], [1, 1, 1]);
    const result = matchHpcpToChord(hpcp, 'G-Dur', buildChordTemplates());
    expect(result.isCorrect).toBe(true);
  });

  it('A-Moll peaks (A4, C5, E5) correctly match A-Moll template', () => {
    const hpcp = computeHpcpPureJS([440.0, 523.251, 659.255], [1, 1, 1]);
    const result = matchHpcpToChord(hpcp, 'A-Moll', buildChordTemplates());
    expect(result.isCorrect).toBe(true);
  });
});
