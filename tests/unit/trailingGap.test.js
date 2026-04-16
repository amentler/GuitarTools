/**
 * Trailing-gap regression tests.
 *
 * "Trailing gap" = space between the last note and the following barline.
 * Bar 0 was wider than necessary (256 px), leaving ~48 px of dead space
 * after the last note before the barline; bars 1–3 had zero trailing gap.
 *
 * Fix: calcFirstBarWidth(tsw, restBarW, marginW) = tsw + (restBarW - marginW)
 * so bar 0's note area exactly equals the note area of bars 1–3.
 */
import { describe, it, expect } from 'vitest';
import { calcFirstBarWidth } from '../../js/games/sheetMusicReading/sheetMusicLogic.js';

const REST_BAR_W = 128; // Math.floor((640 - 256) / 3)
const TSW        = 90;  // clef + time-sig width measured from VexFlow
const MARGIN     = 10;  // small leading margin in non-decorated bars

describe('Trailing gap – bar 0 must not have more dead space than bars 1–3', () => {
  it('calcFirstBarWidth produces equal note areas for bar 0 and bars 1–3', () => {
    const firstBarW = calcFirstBarWidth(TSW, REST_BAR_W, MARGIN);
    const avail0 = firstBarW - TSW;      // note area of bar 0
    const avail1 = REST_BAR_W - MARGIN;  // note area of bars 1–3
    expect(avail0).toBe(avail1);
  });

  it('calcFirstBarWidth returns tsw + restBarW - marginW', () => {
    expect(calcFirstBarWidth(90, 128, 10)).toBe(208);
  });

  it('works with different parameter values', () => {
    // tsw=100, restBarW=150, marginW=15 → firstBarW=235, avail=135 on both sides
    const w = calcFirstBarWidth(100, 150, 15);
    expect(w - 100).toBe(150 - 15);
  });
});
