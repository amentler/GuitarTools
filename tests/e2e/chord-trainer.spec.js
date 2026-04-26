import { test, expect } from '@playwright/test';

test.describe('Akkord Trainer Migration', () => {

  test('should allow entering a chord and show feedback', async ({ page }) => {
    await page.goto('/pages/akkord-trainer/index.html');

    const fretboard = page.locator('#chord-fretboard');
    await expect(fretboard).toBeVisible();

    // Check if nut positions are visible (initially all 0)
    const openCircles = page.locator('gt-fretboard circle[data-fret="0"]');
    // 6 strings, all should have a circle at fret 0
    await expect(openCircles).toHaveCount(6);

    // Click a fret (e.g. fret 1, string 1 - B string in chord trainer mapping?)
    // In gt-fretboard stringIndex 0 is low E, 5 is high E. 
    // In chord trainer code: string 1 is low E (index 0).
    const fret1String0 = page.locator('gt-fretboard circle[data-string="0"][data-fret="1"]');
    await fret1String0.click({ force: true });

    // Check if the marker appeared
    const selectedMarker = page.locator('gt-fretboard circle[fill="#ff6b35"]');
    // Note: data-fret 0 is also drawn but with fill="none". 
    // Our highlighted marker should have fill="#ff6b35"
    await expect(selectedMarker).toHaveCount(1);

    // Toggle mute at fret 0
    const nut0 = page.locator('gt-fretboard [data-string="0"][data-fret="0"]').first();
    await nut0.click({ force: true });
    
    // Check for muted cross (lines)
    const mutedLines = page.locator('gt-fretboard line[stroke="#e74c3c"]');
    // There are 2 lines per muted marker.
    await expect(mutedLines).toHaveCount(2);
  });
});
