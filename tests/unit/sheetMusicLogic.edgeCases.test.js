import { describe, it, expect } from 'vitest';
import {
  NOTES,
  generateBars,
  getFilteredNotes,
  EndlessBarGenerator,
  calcScrollTarget,
} from '../../js/games/sheetMusicReading/sheetMusicLogic.js';

// ── generateBars – edge cases ──────────────────────────────────────────────────

describe('generateBars – edge cases', () => {
  it('single-note pool: every note is that note', () => {
    const single = [NOTES[5]];
    const bars   = generateBars(2, 4, single);
    for (const bar of bars) {
      for (const note of bar) expect(note).toBe(single[0]);
    }
  });

  it('two-note pool: only those two notes appear', () => {
    const two  = [NOTES[0], NOTES[1]];
    const bars = generateBars(4, 4, two);
    const set  = new Set(two);
    for (const bar of bars) {
      for (const note of bar) expect(set.has(note)).toBe(true);
    }
  });

  it('empty pool falls back to NOTES', () => {
    const bars = generateBars(2, 4, []);
    const set  = new Set(NOTES);
    for (const bar of bars) {
      for (const note of bar) expect(set.has(note)).toBe(true);
    }
  });

  it('generates correct bar count and beat count for large request', () => {
    const bars = generateBars(8, 6, NOTES);
    expect(bars).toHaveLength(8);
    for (const bar of bars) expect(bar).toHaveLength(6);
  });
});

// ── getFilteredNotes – edge cases ──────────────────────────────────────────────

describe('getFilteredNotes – edge cases', () => {
  it('returns empty array when no strings are active', () => {
    expect(getFilteredNotes(3, [])).toHaveLength(0);
  });

  it('fret 0 only returns open strings', () => {
    const notes = getFilteredNotes(0, [0, 1, 2, 3, 4, 5]);
    expect(notes.length).toBeGreaterThan(0);
    for (const n of notes) expect(n.fret).toBe(0);
  });

  it('single string + fret 0 returns at most one note', () => {
    // String 0 = low E (guitar string 6), open = E2
    const notes = getFilteredNotes(0, [0]);
    expect(notes).toHaveLength(1);
    expect(notes[0].name).toBe('E');
  });

  it('all strings + maxFret 3 returns all 17 NOTES', () => {
    expect(getFilteredNotes(3, [0, 1, 2, 3, 4, 5])).toHaveLength(17);
  });
});

// ── EndlessBarGenerator – edge cases ──────────────────────────────────────────

describe('EndlessBarGenerator – edge cases', () => {
  it('single-note pool does not crash', () => {
    const gen  = new EndlessBarGenerator(4, [NOTES[0]]);
    const bars = gen.nextBatch(4);
    expect(bars).toHaveLength(4);
    for (const bar of bars) {
      expect(bar).toHaveLength(4);
      for (const note of bar) expect(note).toBe(NOTES[0]);
    }
  });

  it('empty pool falls back to full NOTES without crashing', () => {
    const gen  = new EndlessBarGenerator(4, []);
    const bars = gen.nextBatch(2);
    expect(bars).toHaveLength(2);
  });

  it('successive nextBatch calls accumulate more bars', () => {
    const gen = new EndlessBarGenerator(4, NOTES);
    const b1  = gen.nextBatch(4);
    const b2  = gen.nextBatch(4);
    expect(b1).toHaveLength(4);
    expect(b2).toHaveLength(4);
  });
});

// ── calcScrollTarget – edge cases ─────────────────────────────────────────────

describe('calcScrollTarget – edge cases', () => {
  it('never returns a negative value', () => {
    for (let row = 0; row <= 10; row++) {
      expect(calcScrollTarget(row, 300, 1000)).toBeGreaterThanOrEqual(0);
    }
  });

  it('increases monotonically with rowIndex', () => {
    const values = [2, 3, 5, 8, 13].map(r => calcScrollTarget(r, 300, 540));
    for (let i = 1; i < values.length; i++) {
      expect(values[i]).toBeGreaterThan(values[i - 1]);
    }
  });

  it('very large rowIndex does not overflow', () => {
    expect(() => calcScrollTarget(10000, 300, 540)).not.toThrow();
    expect(calcScrollTarget(10000, 300, 540)).toBeGreaterThan(0);
  });
});
