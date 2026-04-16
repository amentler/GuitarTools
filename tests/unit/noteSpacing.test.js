/**
 * Regression test: all bars must have the same beat step width.
 *
 * Bar 0 is rendered wider than bars 1–3 because it contains the clef and
 * time signature. If calcBeatX uses each bar's own note area independently,
 * bar 0 gets a larger step (note spacing) than bars 1–3. This test catches
 * that regression and must be RED before the fix, GREEN after.
 */
import { describe, it, expect } from 'vitest';
import { calcBeatX } from '../../js/games/sheetMusicReading/playbackBar.js';

// Realistic staveLayout as VexFlow currently produces for a 640-wide canvas:
// FIRST_BAR_W=256, clef+timesig ≈ 90px → bar 0 note area = 166px
// REST_BAR_W=128,  small margin  ≈ 10px → bars 1–3 note area = 118px
const UNEQUAL_LAYOUT = [
  { noteStartX: 90,  noteEndX: 256 }, // note area 166 px  ← wider
  { noteStartX: 266, noteEndX: 384 }, // note area 118 px
  { noteStartX: 394, noteEndX: 512 }, // note area 118 px
  { noteStartX: 522, noteEndX: 640 }, // note area 118 px
];

describe('Note spacing – equal beat step width across all bars', () => {
  it('bar 0 and bar 1 have the same beat step width (4/4)', () => {
    const step0 = calcBeatX(UNEQUAL_LAYOUT, 0, 1, 4) - calcBeatX(UNEQUAL_LAYOUT, 0, 0, 4);
    const step1 = calcBeatX(UNEQUAL_LAYOUT, 1, 1, 4) - calcBeatX(UNEQUAL_LAYOUT, 1, 0, 4);
    // RED before fix: step0 = 166/4 = 41.5 px, step1 = 118/4 = 29.5 px → unequal
    expect(step0).toBeCloseTo(step1, 0);
  });

  it('all four bars have the same beat step width (4/4)', () => {
    const steps = [0, 1, 2, 3].map(bar =>
      calcBeatX(UNEQUAL_LAYOUT, bar, 1, 4) - calcBeatX(UNEQUAL_LAYOUT, bar, 0, 4),
    );
    for (let i = 1; i < steps.length; i++) {
      expect(steps[i]).toBeCloseTo(steps[0], 0);
    }
  });

  it('bar 0 and bar 1 have the same beat step width (3/4)', () => {
    const step0 = calcBeatX(UNEQUAL_LAYOUT, 0, 1, 3) - calcBeatX(UNEQUAL_LAYOUT, 0, 0, 3);
    const step1 = calcBeatX(UNEQUAL_LAYOUT, 1, 1, 3) - calcBeatX(UNEQUAL_LAYOUT, 1, 0, 3);
    expect(step0).toBeCloseTo(step1, 0);
  });
});
