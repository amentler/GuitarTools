import { describe, it, expect } from 'vitest';
import {
  NOTES,
  getTimeSignatureConfig,
  validateTimeSignature,
  generateBars,
} from '../../js/games/sheetMusicReading/sheetMusicLogic.js';

// ── getTimeSignatureConfig ────────────────────────────────────────────────────

describe('getTimeSignatureConfig', () => {
  it('returns correct config for 4/4', () => {
    expect(getTimeSignatureConfig('4/4')).toEqual({
      beatsPerBar: 4,
      noteDuration: 'q',
      vfTimeSig: '4/4',
    });
  });

  it('returns correct config for 3/4', () => {
    expect(getTimeSignatureConfig('3/4')).toEqual({
      beatsPerBar: 3,
      noteDuration: 'q',
      vfTimeSig: '3/4',
    });
  });

  it('returns correct config for 2/4', () => {
    expect(getTimeSignatureConfig('2/4')).toEqual({
      beatsPerBar: 2,
      noteDuration: 'q',
      vfTimeSig: '2/4',
    });
  });

  it('returns correct config for 3/8 (eighth notes, 3 beats)', () => {
    expect(getTimeSignatureConfig('3/8')).toEqual({
      beatsPerBar: 3,
      noteDuration: 'e',
      vfTimeSig: '3/8',
    });
  });

  it('returns correct config for 6/8 (eighth notes, 6 beats)', () => {
    expect(getTimeSignatureConfig('6/8')).toEqual({
      beatsPerBar: 6,
      noteDuration: 'e',
      vfTimeSig: '6/8',
    });
  });

  it('returns null for unsupported time signature 5/4', () => {
    expect(getTimeSignatureConfig('5/4')).toBeNull();
  });

  it('returns null for unsupported time signature 7/8', () => {
    expect(getTimeSignatureConfig('7/8')).toBeNull();
  });

  it('returns null for empty string', () => {
    expect(getTimeSignatureConfig('')).toBeNull();
  });

  it('returns null for null input', () => {
    expect(getTimeSignatureConfig(null)).toBeNull();
  });

  it('returns null for undefined input', () => {
    expect(getTimeSignatureConfig(undefined)).toBeNull();
  });

  it('all 5 supported signatures have valid structure', () => {
    const sigs = ['2/4', '3/4', '4/4', '3/8', '6/8'];
    for (const sig of sigs) {
      const config = getTimeSignatureConfig(sig);
      expect(config).not.toBeNull();
      expect(typeof config.beatsPerBar).toBe('number');
      expect(config.beatsPerBar).toBeGreaterThanOrEqual(2);
      expect(['q', 'e', 'h']).toContain(config.noteDuration);
      expect(config.vfTimeSig).toBe(sig);
    }
  });

  it('quarter-note signatures use noteDuration q', () => {
    expect(getTimeSignatureConfig('2/4').noteDuration).toBe('q');
    expect(getTimeSignatureConfig('3/4').noteDuration).toBe('q');
    expect(getTimeSignatureConfig('4/4').noteDuration).toBe('q');
  });

  it('eighth-note signatures use noteDuration e', () => {
    expect(getTimeSignatureConfig('3/8').noteDuration).toBe('e');
    expect(getTimeSignatureConfig('6/8').noteDuration).toBe('e');
  });
});

// ── validateTimeSignature ─────────────────────────────────────────────────────

describe('validateTimeSignature', () => {
  it('returns true for all 5 supported signatures', () => {
    for (const sig of ['2/4', '3/4', '4/4', '3/8', '6/8']) {
      expect(validateTimeSignature(sig)).toBe(true);
    }
  });

  it('returns false for 5/4 (not supported)', () => {
    expect(validateTimeSignature('5/4')).toBe(false);
  });

  it('returns false for 7/8 (not supported)', () => {
    expect(validateTimeSignature('7/8')).toBe(false);
  });

  it('returns false for 1/4 (not supported)', () => {
    expect(validateTimeSignature('1/4')).toBe(false);
  });

  it('returns false for empty string', () => {
    expect(validateTimeSignature('')).toBe(false);
  });

  it('returns false for null', () => {
    expect(validateTimeSignature(null)).toBe(false);
  });

  it('returns false for undefined', () => {
    expect(validateTimeSignature(undefined)).toBe(false);
  });

  it('returns false for numeric input', () => {
    expect(validateTimeSignature(4)).toBe(false);
  });
});

// ── generateBars with time signature configs ──────────────────────────────────

describe('generateBars with time signature configs', () => {
  it('generates correct number of beats per bar for 3/4', () => {
    const config = getTimeSignatureConfig('3/4');
    const bars = generateBars(4, config.beatsPerBar);
    expect(bars).toHaveLength(4);
    for (const bar of bars) {
      expect(bar).toHaveLength(3);
    }
  });

  it('generates correct number of beats per bar for 2/4', () => {
    const config = getTimeSignatureConfig('2/4');
    const bars = generateBars(6, config.beatsPerBar);
    expect(bars).toHaveLength(6);
    for (const bar of bars) {
      expect(bar).toHaveLength(2);
    }
  });

  it('generates correct number of beats per bar for 6/8', () => {
    const config = getTimeSignatureConfig('6/8');
    const bars = generateBars(2, config.beatsPerBar);
    expect(bars).toHaveLength(2);
    for (const bar of bars) {
      expect(bar).toHaveLength(6);
    }
  });

  it('generates correct number of beats per bar for 3/8', () => {
    const config = getTimeSignatureConfig('3/8');
    const bars = generateBars(4, config.beatsPerBar);
    for (const bar of bars) {
      expect(bar).toHaveLength(3);
    }
  });

  it('all generated notes are valid for non-default time signatures', () => {
    const config = getTimeSignatureConfig('6/8');
    const bars = generateBars(4, config.beatsPerBar);
    const validNotes = new Set(NOTES);
    for (const bar of bars) {
      for (const note of bar) {
        expect(validNotes.has(note)).toBe(true);
      }
    }
  });
});
