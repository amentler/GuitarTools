import { test, expect } from '@playwright/test';

test.describe('Fretboard Tone Recognition Exercise', () => {
  test('should show a highlighted note on load', async ({ page }) => {
    await page.goto('/pages/fretboard-tone-recognition/index.html');

    // Wait for the fretboard to be rendered
    const fretboard = page.locator('gt-fretboard');
    await expect(fretboard).toBeVisible();

    // Check if there is exactly one highlighted circle
    // Highlighting means fill is not transparent.
    // In gt-fretboard-render.js:
    // selected/missed: #ff6b35
    // correct: #2ecc71
    // wrong: #e74c3c

    const highlightedCircles = page.locator('gt-fretboard circle[fill="#ff6b35"]');

    // Initially, one note should be "selected" (highlighted)
    await expect(highlightedCircles).toHaveCount(1);
  });
});
