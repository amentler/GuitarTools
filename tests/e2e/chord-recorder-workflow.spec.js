import { test, expect } from '@playwright/test';

test.describe('Chord Recorder – Setup and Workflow', () => {

  test('renders chord grid with selectable chord cards on load', async ({ page }) => {
    await page.goto('/pages/chord-recorder/index.html');

    const firstCard = page.locator('.cr-chord-card').first();
    await expect(firstCard).toBeVisible();

    // Tool menu buttons rendered
    const downloadBtn = page.locator('#cr-download-all');
    await expect(downloadBtn).toBeVisible();
    await expect(downloadBtn).toBeDisabled(); // No recordings yet
  });

  test('selecting a chord card toggles selected state and enables start', async ({ page }) => {
    await page.goto('/pages/chord-recorder/index.html');

    const firstCard = page.locator('.cr-chord-card').first();
    await expect(firstCard).toBeVisible();

    await firstCard.click();
    await expect(firstCard).toHaveClass(/cr-chord-card--selected/);

    // Start button(s) become visible when a chord is selected
    const startBtns = page.locator('[data-start]');
    const count = await startBtns.count();
    if (count > 0) {
      // At least one start button should be visible (not hidden)
      const firstVisible = startBtns.filter({ hasNot: page.locator('.u-hidden') });
      expect(await firstVisible.count()).toBeGreaterThan(0);
    }
  });

  test('deselecting a chord card removes selected state', async ({ page }) => {
    await page.goto('/pages/chord-recorder/index.html');

    const firstCard = page.locator('.cr-chord-card').first();
    await firstCard.click();
    await expect(firstCard).toHaveClass(/cr-chord-card--selected/);

    await firstCard.click();
    await expect(firstCard).not.toHaveClass(/cr-chord-card--selected/);
  });

  test('variation count label updates when chord is selected', async ({ page }) => {
    await page.goto('/pages/chord-recorder/index.html');

    const countEl = page.locator('#cr-variation-count');
    await expect(countEl).toBeVisible();

    const textBefore = await countEl.textContent();

    const firstCard = page.locator('.cr-chord-card').first();
    await firstCard.click();

    const textAfter = await countEl.textContent();
    expect(textAfter).not.toEqual(textBefore);
    expect(textAfter).toContain('Aufnahmen geplant');
  });

  test('Manage button switches to manage view', async ({ page }) => {
    await page.goto('/pages/chord-recorder/index.html');

    const manageBtn = page.locator('#cr-manage-recordings');
    await expect(manageBtn).toBeVisible();
    await manageBtn.click();

    // Manage view replaces root with back button and Recording-Verwaltung section
    const backBtn = page.locator('#cr-back-to-record');
    await expect(backBtn).toBeVisible();

    const heading = page.locator('.cr-section-title');
    await expect(heading).toContainText('Recording-Verwaltung');
  });
});

test.describe('Chord Recorder – Microphone Permission', () => {

  test('shows error message when microphone permission is denied', async ({ page, context }) => {
    await context.addInitScript(() => {
      navigator.mediaDevices.getUserMedia = () =>
        Promise.reject(new Error('Permission denied by user'));
    });

    await page.goto('/pages/chord-recorder/index.html');

    // Select a chord and start recording
    const firstCard = page.locator('.cr-chord-card').first();
    await expect(firstCard).toBeVisible();
    await firstCard.click();

    // Find and click start button
    const startBtns = page.locator('[data-start]');
    if (await startBtns.count() > 0) {
      await startBtns.first().click({ force: true });

      // Error message should appear
      const errorMsg = page.locator('.cr-error');
      await expect(errorMsg).toBeVisible({ timeout: 5000 });
      await expect(errorMsg).toContainText(/Mikrofon/i);
    }
  });
});
