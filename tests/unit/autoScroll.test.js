import { describe, it, expect } from 'vitest';
import { calcScrollTarget } from '../../js/games/sheetMusicReading/sheetMusicLogic.js';

// rowDisplayHeight=300 (e.g. 800px-wide container, 240/640 aspect = 300px per row)
// viewportHeight=540 (e.g. 60vh of a 900px screen)

describe('calcScrollTarget', () => {
  const ROW_H  = 300;
  const VPH    = 540;

  it('row 0 always returns 0 (cannot scroll above top)', () => {
    expect(calcScrollTarget(0, ROW_H, VPH)).toBe(0);
  });

  it('row 1 → rowTop=300, scrollTarget = 300 - 540*0.33 ≈ 122', () => {
    const result = calcScrollTarget(1, ROW_H, VPH);
    expect(result).toBeCloseTo(300 - VPH * 0.33, 0);
    expect(result).toBeGreaterThan(0);
  });

  it('returns 0 when calculated target is negative (early rows)', () => {
    // rowTop=300, viewportHeight=1000 → 300 - 330 = -30 → clamp to 0
    expect(calcScrollTarget(1, ROW_H, 1000)).toBe(0);
  });

  it('larger rowIndex gives larger scroll target', () => {
    const t2 = calcScrollTarget(2, ROW_H, VPH);
    const t5 = calcScrollTarget(5, ROW_H, VPH);
    expect(t5).toBeGreaterThan(t2);
  });

  it('scales linearly with rowDisplayHeight', () => {
    const t1 = calcScrollTarget(3, 200, VPH);
    const t2 = calcScrollTarget(3, 400, VPH);
    expect(t2).toBeGreaterThan(t1);
  });

  it('custom targetFraction=0.5 keeps row at mid-viewport', () => {
    const result = calcScrollTarget(4, ROW_H, VPH, 0.5);
    expect(result).toBeCloseTo(4 * ROW_H - VPH * 0.5, 0);
  });

  it('targetFraction=0 places row at the very top', () => {
    const result = calcScrollTarget(3, ROW_H, VPH, 0);
    expect(result).toBe(3 * ROW_H);
  });
});
