import { describe, it, expect } from 'vitest';
import { EndlessBarGenerator, NOTES } from '../../js/games/sheetMusicReading/sheetMusicLogic.js';

// Minimal note pool for deterministic testing
const POOL_3 = [
  { name: 'E', octave: 2, vfKey: 'e/3', string: 6, fret: 0 },
  { name: 'A', octave: 2, vfKey: 'a/3', string: 5, fret: 0 },
  { name: 'D', octave: 3, vfKey: 'd/4', string: 4, fret: 0 },
];

describe('EndlessBarGenerator – structure', () => {
  it('nextBatch(4) returns 4 bars', () => {
    const gen = new EndlessBarGenerator(4, NOTES);
    expect(gen.nextBatch(4)).toHaveLength(4);
  });

  it('each bar has beatsPerBar notes', () => {
    const gen = new EndlessBarGenerator(3, NOTES);
    const bars = gen.nextBatch(4);
    for (const bar of bars) expect(bar).toHaveLength(3);
  });

  it('beatsPerBar=6 produces 6-note bars', () => {
    const gen = new EndlessBarGenerator(6, NOTES);
    const bars = gen.nextBatch(2);
    for (const bar of bars) expect(bar).toHaveLength(6);
  });

  it('notes come from the supplied notesPool', () => {
    const gen = new EndlessBarGenerator(4, POOL_3);
    const bars = gen.nextBatch(4);
    for (const bar of bars) {
      for (const note of bar) expect(POOL_3).toContain(note);
    }
  });

  it('notes have required shape (name, vfKey, string, fret)', () => {
    const gen = new EndlessBarGenerator(4, NOTES);
    const bars = gen.nextBatch(4);
    for (const bar of bars) {
      for (const note of bar) {
        expect(note).toHaveProperty('name');
        expect(note).toHaveProperty('vfKey');
        expect(note).toHaveProperty('string');
        expect(note).toHaveProperty('fret');
      }
    }
  });
});

describe('EndlessBarGenerator – melodic continuity', () => {
  it('consecutive notes stay within ±2 steps of the pool', () => {
    const gen = new EndlessBarGenerator(4, NOTES);
    const bars = gen.nextBatch(8);
    const flat = bars.flat();
    for (let i = 1; i < flat.length; i++) {
      const a = NOTES.indexOf(flat[i - 1]);
      const b = NOTES.indexOf(flat[i]);
      expect(Math.abs(a - b)).toBeLessThanOrEqual(2);
    }
  });

  it('maintains continuity across batch boundaries', () => {
    const gen = new EndlessBarGenerator(4, NOTES);
    const batch1 = gen.nextBatch(4);
    const batch2 = gen.nextBatch(4);
    const lastNote  = batch1.at(-1).at(-1);
    const firstNote = batch2[0][0];
    const a = NOTES.indexOf(lastNote);
    const b = NOTES.indexOf(firstNote);
    expect(Math.abs(a - b)).toBeLessThanOrEqual(2);
  });
});

describe('EndlessBarGenerator – pool and settings updates', () => {
  it('setNotesPool restricts notes to new pool', () => {
    const gen = new EndlessBarGenerator(4, NOTES);
    gen.setNotesPool(POOL_3);
    const bars = gen.nextBatch(4);
    for (const bar of bars) {
      for (const note of bar) expect(POOL_3).toContain(note);
    }
  });

  it('setBeatsPerBar changes bar length on next batch', () => {
    const gen = new EndlessBarGenerator(4, NOTES);
    gen.setBeatsPerBar(2);
    const bars = gen.nextBatch(4);
    for (const bar of bars) expect(bar).toHaveLength(2);
  });

  it('reset() causes next batch to start a fresh sequence', () => {
    const gen = new EndlessBarGenerator(4, NOTES);
    gen.nextBatch(10);
    gen.reset();
    // After reset, _idx is -1; first call re-initializes mid-range
    // Just verify it doesn't throw and returns correct structure
    const bars = gen.nextBatch(4);
    expect(bars).toHaveLength(4);
    for (const bar of bars) expect(bar).toHaveLength(4);
  });

  it('falls back to NOTES when pool is empty', () => {
    const gen = new EndlessBarGenerator(4, []);
    const bars = gen.nextBatch(4);
    expect(bars).toHaveLength(4);
    for (const bar of bars) {
      for (const note of bar) expect(NOTES).toContain(note);
    }
  });

  it('generates 100 bars in under 100 ms', () => {
    const gen = new EndlessBarGenerator(4, NOTES);
    const t0 = Date.now();
    gen.nextBatch(100);
    expect(Date.now() - t0).toBeLessThan(100);
  });
});
