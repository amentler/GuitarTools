import { test, expect } from '@playwright/test';

test.describe('Fretboard Controls – String-Toggle + Fret-Range', () => {

  test.beforeEach(async ({ page }) => {
    await page.goto('/pages/fretboard-tone-recognition/index.html');
  });

  test('string-toggles renders 6 buttons', async ({ page }) => {
    const toggles = page.locator('#string-toggles');
    await expect(toggles).toBeVisible();

    const buttons = toggles.locator('button');
    await expect(buttons).toHaveCount(6);
  });

  test('clicking a string toggle deactivates and reactivates it', async ({ page }) => {
    const toggles = page.locator('#string-toggles');
    const firstBtn = toggles.locator('button').first();
    await expect(firstBtn).toBeVisible();

    const classBefore = await firstBtn.getAttribute('class');

    await firstBtn.click();
    const classAfter = await firstBtn.getAttribute('class');
    expect(classAfter).not.toEqual(classBefore);

    // Click again to re-enable
    await firstBtn.click();
    const classRestored = await firstBtn.getAttribute('class');
    expect(classRestored).toEqual(classBefore);
  });

  test('fret range slider updates the fret label', async ({ page }) => {
    const slider = page.locator('#fret-range-slider');
    const label = page.locator('#fret-range-label');

    await expect(slider).toBeVisible();
    await expect(label).toBeVisible();

    const labelBefore = await label.textContent();

    await slider.fill('7');
    await slider.dispatchEvent('input');

    const labelAfter = await label.textContent();
    expect(labelAfter).not.toEqual(labelBefore);
    expect(labelAfter).toContain('7');
  });

  test('fretboard SVG redraws after fret range change', async ({ page }) => {
    const slider = page.locator('#fret-range-slider');
    const fretboard = page.locator('#fretboard-svg');
    await expect(fretboard).toBeVisible();

    await slider.fill('6');
    await slider.dispatchEvent('input');

    // Fretboard must still be visible (no crash)
    await expect(fretboard).toBeVisible();
    const svg = fretboard.locator('svg');
    await expect(svg).toBeVisible();
  });

  test('note buttons are rendered with note names', async ({ page }) => {
    const noteButtons = page.locator('#note-buttons button');
    const count = await noteButtons.count();
    expect(count).toBeGreaterThan(0);

    const firstLabel = await noteButtons.first().textContent();
    expect(firstLabel?.trim().length).toBeGreaterThan(0);
  });
});

test.describe('Ton-Finder Controls – String-Toggle + Fret-Range', () => {

  test.beforeEach(async ({ page }) => {
    await page.goto('/pages/ton-finder/index.html');
  });

  test('string toggles are visible with 6 buttons', async ({ page }) => {
    const toggles = page.locator('#ton-finder-string-toggles');
    await expect(toggles).toBeVisible();

    const buttons = toggles.locator('button');
    await expect(buttons).toHaveCount(6);
  });

  test('fret range slider updates label', async ({ page }) => {
    const slider = page.locator('#ton-finder-fret-range-slider');
    const label = page.locator('#ton-finder-fret-range-label');

    await expect(slider).toBeVisible();
    await expect(label).toBeVisible();

    const before = await label.textContent();
    await slider.fill('6');
    await slider.dispatchEvent('input');

    const after = await label.textContent();
    expect(after).not.toEqual(before);
    expect(after).toContain('6');
  });
});
