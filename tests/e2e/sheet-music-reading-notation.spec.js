import { test, expect } from '@playwright/test';

test.describe('Sheet Music Reading – Notation rendering', () => {
  test('renders VexFlow SVG notation in score container on load', async ({ page }) => {
    await page.goto('/pages/sheet-music-reading/index.html');

    // VexFlow renders SVG rows inside #score-container
    const svg = page.locator('#score-container svg').first();
    await expect(svg).toBeVisible();
  });

  test('play button is visible and enabled', async ({ page }) => {
    await page.goto('/pages/sheet-music-reading/index.html');

    const playBtn = page.locator('#btn-sheet-play');
    await expect(playBtn).toBeVisible();
    await expect(playBtn).toBeEnabled();
  });
});
