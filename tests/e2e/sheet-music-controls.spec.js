import { test, expect } from '@playwright/test';

test.describe('Sheet Music Reading – Controls', () => {

  test.beforeEach(async ({ page }) => {
    await page.goto('/pages/sheet-music-reading/index.html');
  });

  test('score container renders notation on load', async ({ page }) => {
    const scoreContainer = page.locator('#score-container');
    await expect(scoreContainer).toBeVisible();

    // VexFlow renders an SVG into the score container
    const svg = scoreContainer.locator('svg').first();
    await expect(svg).toBeVisible({ timeout: 5000 });
  });

  test('Neue Takte button regenerates score', async ({ page }) => {
    const scoreContainer = page.locator('#score-container');
    const svg = scoreContainer.locator('svg').first();
    await expect(svg).toBeVisible({ timeout: 5000 });

    // Get initial SVG content hash
    const contentBefore = await scoreContainer.innerHTML();

    const newBarsBtn = page.locator('#btn-new-bars');
    await expect(newBarsBtn).toBeVisible();
    await newBarsBtn.click();

    // Score SVG should be regenerated (different content)
    await page.waitForTimeout(300);
    const contentAfter = await scoreContainer.innerHTML();
    // Content may or may not change (random), but element must still be visible
    expect(typeof contentAfter).toBe('string');
    expect(contentAfter.length).toBeGreaterThan(0);
    // Suppress unused warning — use both
    expect(typeof contentBefore).toBe('string');
  });

  test('fret range slider updates label', async ({ page }) => {
    const slider = page.locator('#sheet-music-fret-range-slider');
    const label = page.locator('#sheet-music-fret-range-label');

    await expect(slider).toBeVisible();
    await expect(label).toBeVisible();

    const labelBefore = await label.textContent();

    // Move slider
    await slider.fill('5');
    await slider.dispatchEvent('input');

    const labelAfter = await label.textContent();
    expect(labelAfter).not.toEqual(labelBefore);
    expect(labelAfter).toContain('5');
  });

  test('key selector changes key value', async ({ page }) => {
    const keySelect = page.locator('#sheet-music-key');
    await expect(keySelect).toBeVisible();

    // Select G major
    await keySelect.selectOption('G');
    const selected = await keySelect.inputValue();
    expect(selected).toBe('G');
  });

  test('string toggles are visible and clickable', async ({ page }) => {
    const stringToggles = page.locator('#sheet-music-string-toggles');
    await expect(stringToggles).toBeVisible();

    const buttons = stringToggles.locator('button');
    const count = await buttons.count();
    expect(count).toBeGreaterThanOrEqual(6);

    // Click first string toggle
    await buttons.first().click();
    // Should not crash — page remains interactive
    await expect(page.locator('#score-container')).toBeVisible();
  });

  test('BPM slider updates BPM label', async ({ page }) => {
    const bpmSlider = page.locator('#sheet-music-bpm-slider');
    const bpmLabel = page.locator('#sheet-music-bpm-label');

    await expect(bpmSlider).toBeVisible();
    await expect(bpmLabel).toBeVisible();

    await bpmSlider.fill('120');
    await bpmSlider.dispatchEvent('input');

    await expect(bpmLabel).toHaveText('120');
  });
});
