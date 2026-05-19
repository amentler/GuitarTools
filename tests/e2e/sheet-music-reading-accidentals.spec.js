import { test, expect } from '@playwright/test';

/**
 * E2E test for accidentals (sharps / flats) in the sheet-music-reading exercise.
 *
 * Verifies that when a bar containing a note with a sharp (#) accidental is
 * rendered, VexFlow actually draws an accidental symbol in the SVG output.
 *
 * The test injects a single bar containing F#3 (vfKey 'f#/3') via the
 * __GT_SHEET_MUSIC_READING_BARS__ hook and then checks the rendered SVG for
 * an element that VexFlow adds exclusively for accidentals.
 */

test.describe('Sheet Music Reading – Accidentals rendering', () => {
  test('renders a sharp accidental symbol for a note with vfKey f#/3', async ({ page }) => {
    // Inject one bar with a single F# note so the score is deterministic.
    await page.addInitScript(() => {
      window.__GT_SHEET_MUSIC_READING_BARS__ = [[
        { name: 'F#', octave: 2, vfKey: 'f#/3', string: 6, fret: 2 },
      ]];
    });

    await page.goto('/pages/sheet-music-reading/index.html');

    // Wait for VexFlow to render the score.
    const svg = page.locator('#score-container svg').first();
    await expect(svg).toBeVisible();

    // VexFlow renders accidentals as <path> elements inside <g> containers
    // that have a data-name or class attribute containing "accidental".
    // Check both the data-name attribute pattern VexFlow 4.x uses and the
    // class-based pattern as a fallback.
    const accidentalByDataName = svg.locator('[data-name*="accidental"]');
    const accidentalByClass    = svg.locator('.vf-accidental');

    const countByDataName = await accidentalByDataName.count();
    const countByClass    = await accidentalByClass.count();

    expect(
      countByDataName + countByClass,
      'Expected at least one VexFlow accidental element in the SVG when rendering f#/3'
    ).toBeGreaterThan(0);
  });

  test('renders a flat accidental symbol for a note with vfKey bb/3', async ({ page }) => {
    await page.addInitScript(() => {
      window.__GT_SHEET_MUSIC_READING_BARS__ = [[
        { name: 'Bb', octave: 2, vfKey: 'bb/3', string: 5, fret: 1 },
      ]];
    });

    await page.goto('/pages/sheet-music-reading/index.html');

    const svg = page.locator('#score-container svg').first();
    await expect(svg).toBeVisible();

    const accidentalByDataName = svg.locator('[data-name*="accidental"]');
    const accidentalByClass    = svg.locator('.vf-accidental');

    const countByDataName = await accidentalByDataName.count();
    const countByClass    = await accidentalByClass.count();

    expect(
      countByDataName + countByClass,
      'Expected at least one VexFlow accidental element in the SVG when rendering bb/3'
    ).toBeGreaterThan(0);
  });
});
