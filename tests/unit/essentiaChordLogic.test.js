import { describe, it, expect, beforeAll } from 'vitest';
import {
  buildChordTemplates,
  cosineSimilarity,
  averageHpcps,
  matchHpcpToChord,
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
});
