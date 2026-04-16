import { describe, it, expect } from 'vitest';
import { calcBeatX } from '../../js/games/sheetMusicReading/playbackBar.js';

// Synthetic stave layout for 4 bars in a 640-wide viewBox.
// Bar 0 is wider (clef + time sig); bars 1–3 are equal width.
// VW=640, FIRST_BAR_W=256, REST_BAR_W=128
// Bar 0 note area: noteStartX≈90 (after clef+timesig), noteEndX=256
// Bar 1 note area: noteStartX≈266 (bar x + small offset), noteEndX=384
// Bar 2 note area: noteStartX≈394, noteEndX=512
// Bar 3 note area: noteStartX≈522, noteEndX=640
const LAYOUT = [
  { noteStartX: 90,  noteEndX: 256 },
  { noteStartX: 266, noteEndX: 384 },
  { noteStartX: 394, noteEndX: 512 },
  { noteStartX: 522, noteEndX: 640 },
];

// ── calcBeatX – basic 4/4 ─────────────────────────────────────────────────────

describe('calcBeatX – 4/4 time', () => {
  it('returns noteStartX for beat 0 of any bar', () => {
    expect(calcBeatX(LAYOUT, 0, 0, 4)).toBeCloseTo(90);
    expect(calcBeatX(LAYOUT, 1, 0, 4)).toBeCloseTo(266);
    expect(calcBeatX(LAYOUT, 2, 0, 4)).toBeCloseTo(394);
    expect(calcBeatX(LAYOUT, 3, 0, 4)).toBeCloseTo(522);
  });

  it('returns noteEndX minus one step for last beat (beat beatsPerBar-1)', () => {
    // beat 3 of 4 = 3/4 of note area, not at noteEndX
    const x = calcBeatX(LAYOUT, 0, 3, 4);
    expect(x).toBeCloseTo(90 + (3 / 4) * (256 - 90));
  });

  it('calculates correct x for beat 2 of bar 1', () => {
    // noteStartX=266, noteEndX=384, noteAreaW=118, beat 2 of 4: 2/4 * 118 = 59
    expect(calcBeatX(LAYOUT, 1, 2, 4)).toBeCloseTo(266 + (2 / 4) * 118);
  });

  it('calculates correct x for beat 1 of bar 0', () => {
    expect(calcBeatX(LAYOUT, 0, 1, 4)).toBeCloseTo(90 + (1 / 4) * 166);
  });

  it('x increases monotonically from beat 0 to beat 3 within the same bar', () => {
    const xs = [0, 1, 2, 3].map(beat => calcBeatX(LAYOUT, 0, beat, 4));
    for (let i = 1; i < xs.length; i++) {
      expect(xs[i]).toBeGreaterThan(xs[i - 1]);
    }
  });
});

// ── calcBeatX – 3/4 ──────────────────────────────────────────────────────────

describe('calcBeatX – 3/4 time', () => {
  it('beat 0 still returns noteStartX', () => {
    expect(calcBeatX(LAYOUT, 0, 0, 3)).toBeCloseTo(90);
  });

  it('beat 1 of 3 is at 1/3 of note area', () => {
    expect(calcBeatX(LAYOUT, 0, 1, 3)).toBeCloseTo(90 + (1 / 3) * 166);
  });

  it('beat 2 of 3 is at 2/3 of note area', () => {
    expect(calcBeatX(LAYOUT, 0, 2, 3)).toBeCloseTo(90 + (2 / 3) * 166);
  });

  it('positions are evenly spaced for bar 1', () => {
    const step = (384 - 266) / 3;
    expect(calcBeatX(LAYOUT, 1, 0, 3)).toBeCloseTo(266);
    expect(calcBeatX(LAYOUT, 1, 1, 3)).toBeCloseTo(266 + step);
    expect(calcBeatX(LAYOUT, 1, 2, 3)).toBeCloseTo(266 + 2 * step);
  });
});

// ── calcBeatX – 6/8 ──────────────────────────────────────────────────────────

describe('calcBeatX – 6/8 time', () => {
  it('beat 0 of 6 returns noteStartX', () => {
    expect(calcBeatX(LAYOUT, 0, 0, 6)).toBeCloseTo(90);
  });

  it('beat 3 of 6 (halfway) returns midpoint of note area', () => {
    // 3/6 = 0.5 of note area
    expect(calcBeatX(LAYOUT, 0, 3, 6)).toBeCloseTo(90 + 0.5 * 166);
  });

  it('beat 5 of 6 is 5/6 of the way across', () => {
    expect(calcBeatX(LAYOUT, 1, 5, 6)).toBeCloseTo(266 + (5 / 6) * 118);
  });

  it('all 6 beat positions are strictly increasing', () => {
    const xs = [0, 1, 2, 3, 4, 5].map(b => calcBeatX(LAYOUT, 0, b, 6));
    for (let i = 1; i < xs.length; i++) {
      expect(xs[i]).toBeGreaterThan(xs[i - 1]);
    }
  });
});

// ── calcBeatX – bar boundary & edge cases ────────────────────────────────────

describe('calcBeatX – boundary and edge cases', () => {
  it('returns null for barIndex out of range', () => {
    expect(calcBeatX(LAYOUT, 4, 0, 4)).toBeNull();
    expect(calcBeatX(LAYOUT, -1, 0, 4)).toBeNull();
  });

  it('returns null for null staveLayout', () => {
    expect(calcBeatX(null, 0, 0, 4)).toBeNull();
  });

  it('returns null for empty staveLayout', () => {
    expect(calcBeatX([], 0, 0, 4)).toBeNull();
  });

  it('handles single-bar layout', () => {
    const single = [{ noteStartX: 90, noteEndX: 640 }];
    expect(calcBeatX(single, 0, 0, 4)).toBeCloseTo(90);
    expect(calcBeatX(single, 0, 2, 4)).toBeCloseTo(90 + 0.5 * 550);
  });

  it('x stays within the note area of the bar', () => {
    for (let barIndex = 0; barIndex < LAYOUT.length; barIndex++) {
      const { noteStartX, noteEndX } = LAYOUT[barIndex];
      for (let beat = 0; beat < 4; beat++) {
        const x = calcBeatX(LAYOUT, barIndex, beat, 4);
        expect(x).toBeGreaterThanOrEqual(noteStartX);
        expect(x).toBeLessThan(noteEndX);
      }
    }
  });

  it('x values do not jump across bar boundaries between last beat of bar N and first beat of bar N+1', () => {
    // Last beat of bar 0 should be less than first beat of bar 1
    const lastBeatBar0  = calcBeatX(LAYOUT, 0, 3, 4);
    const firstBeatBar1 = calcBeatX(LAYOUT, 1, 0, 4);
    expect(lastBeatBar0).toBeLessThan(firstBeatBar1);
  });

  it('beat 0 position is always the noteStartX of the bar', () => {
    for (let i = 0; i < LAYOUT.length; i++) {
      expect(calcBeatX(LAYOUT, i, 0, 4)).toBeCloseTo(LAYOUT[i].noteStartX);
    }
  });
});
