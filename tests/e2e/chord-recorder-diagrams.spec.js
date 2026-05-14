import { test, expect } from '@playwright/test';

test.describe('Chord Recorder – Chord grid diagrams', () => {
  test('renders gt-fretboard chord diagrams in the chord grid', async ({ page }) => {
    await page.goto('/pages/chord-recorder/index.html');

    // The chord grid is populated with chord cards after async mount
    const firstCard = page.locator('.cr-chord-card').first();
    await expect(firstCard).toBeVisible();

    // Each card contains a gt-fretboard element that renders an SVG
    const firstFretboard = page.locator('.cr-chord-card gt-fretboard').first();
    await expect(firstFretboard).toBeVisible();

    const svgInsideFretboard = page.locator('.cr-chord-card gt-fretboard svg').first();
    await expect(svgInsideFretboard).toBeVisible();
  });

  test('chord grid contains diagrams for multiple chords', async ({ page }) => {
    await page.goto('/pages/chord-recorder/index.html');

    await expect(page.locator('.cr-chord-card')).toHaveCountGreaterThan(5);
  });
});
