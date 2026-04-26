import { test, expect } from '@playwright/test';

test.describe('Unified Fretboard Component - Baseline', () => {

  test('Fretboard Tone Recognition: should show target note and handle interaction', async ({ page }) => {
    await page.goto('/pages/fretboard-tone-recognition/index.html');

    const fretboard = page.locator('gt-fretboard');
    await expect(fretboard).toBeVisible();

    // Check if there is exactly one highlighted circle (target note)
    const highlightedCircles = page.locator('gt-fretboard circle[fill="#ff6b35"]');
    await expect(highlightedCircles).toHaveCount(1);

    // Clicking a note button should provide feedback
    const firstNoteBtn = page.locator('.btn-note').first();
    await firstNoteBtn.click();

    // Feedback text should appear
    const feedback = page.locator('#feedback-text');
    await expect(feedback).not.toBeEmpty();
  });

  test('Ton-Finder: should allow toggling positions and show feedback on finish', async ({ page }) => {
    await page.goto('/pages/ton-finder/index.html');

    const fretboard = page.locator('#ton-finder-svg');
    await expect(fretboard).toBeVisible();

    // Initially no selected notes
    const selectedCircles = page.locator('gt-fretboard circle[fill="#ff6b35"]');
    await expect(selectedCircles).toHaveCount(0);

    // Click a position on the fretboard
    // Using a circle that is definitely there (e.g. fret 1, string 0)
    const targetCircle = page.locator('gt-fretboard circle[data-string="0"][data-fret="1"]');
    await targetCircle.click({ force: true }); // force true because of absolute positioning in SVG

    // Now one should be selected
    await expect(selectedCircles).toHaveCount(1);

    // Finish round
    await page.locator('#btn-ton-finder-finish').click();

    // Feedback should be visible
    const feedback = page.locator('#ton-finder-feedback');
    await expect(feedback).not.toBeEmpty();

    // Circles should now have result colors (correct/wrong/missed)
    // #2ecc71 = correct, #e74c3c = wrong, #ff6b35 = missed (or selected)
    const resultCircles = page.locator('gt-fretboard circle[fill="#2ecc71"], gt-fretboard circle[fill="#e74c3c"], gt-fretboard circle[fill="#ff6b35"]');
    const count = await resultCircles.count();
    expect(count).toBeGreaterThan(0);
  });

  test('Fretboard: should respect fret range settings', async ({ page }) => {
    await page.goto('/pages/ton-finder/index.html');

    const slider = page.locator('#ton-finder-fret-range-slider');
    await slider.fill('3'); // Set to 3 frets

    const fretboard = page.locator('#ton-finder-svg');
    await expect(fretboard).toHaveAttribute('frets', '3');

    // Check that we don't have circles for fret 4
    const fret4Circle = page.locator('gt-fretboard circle[data-fret="4"]');
    await expect(fret4Circle).toHaveCount(0);

    // Check that we have circles for fret 3
    const fret3Circle = page.locator('gt-fretboard circle[data-fret="3"]');
    await expect(fret3Circle).not.toHaveCount(0);
  });
});
