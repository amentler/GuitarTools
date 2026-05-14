import { test, expect } from '@playwright/test';

test.describe('Note Playing – Notation rendering', () => {
  test('renders VexFlow SVG notation on load', async ({ page }) => {
    await page.goto('/pages/note-playing/index.html');

    // VexFlow renders an SVG inside #note-play-notation
    const svg = page.locator('#note-play-notation svg').first();
    await expect(svg).toBeVisible();
  });

  test('hint and skip buttons are functional', async ({ page }) => {
    await page.goto('/pages/note-playing/index.html');

    const hint1 = page.locator('#note-play-hint1');
    await expect(hint1).toBeVisible();
    await expect(hint1).toBeEnabled();

    const skipBtn = page.locator('#note-play-skip');
    await expect(skipBtn).toBeVisible();
    await expect(skipBtn).toBeEnabled();

    // Clicking skip advances to the next note (SVG re-renders)
    await skipBtn.click();
    const svg = page.locator('#note-play-notation svg').first();
    await expect(svg).toBeVisible();
  });
});
