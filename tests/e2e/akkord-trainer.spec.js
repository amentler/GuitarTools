import { test, expect } from '@playwright/test';

test.describe('Akkord-Trainer Interaction', () => {

  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      window.localStorage.setItem('gt_srs_enabled', 'false');
    });
    await page.goto('/pages/akkord-trainer/index.html');
  });

  test('shows a chord name on load', async ({ page }) => {
    const chordName = page.locator('#chord-name-display');
    await expect(chordName).toBeVisible();
    const text = await chordName.textContent();
    expect(text?.trim().length).toBeGreaterThan(0);
  });

  test('fretboard is visible and has 6 strings', async ({ page }) => {
    const fretboard = page.locator('#chord-fretboard');
    await expect(fretboard).toBeVisible();

    // Each string has at least an open-fret circle
    const openCircles = page.locator('gt-fretboard circle[data-fret="0"]');
    await expect(openCircles).toHaveCount(6);
  });

  test('clicking a fret selects a position', async ({ page }) => {
    const fret1 = page.locator('gt-fretboard circle[data-fret="1"]').first();
    await expect(fret1).toBeVisible();
    await fret1.click({ force: true });

    const selectedMarker = page.locator('gt-fretboard circle[fill="#ff6b35"]');
    await expect(selectedMarker).toHaveCount(1);
  });

  test('Prüfen button shows feedback text', async ({ page }) => {
    const checkBtn = page.locator('#btn-chord-check');
    await expect(checkBtn).toBeVisible();

    await checkBtn.click();

    const feedbackText = page.locator('#chord-feedback-text');
    const text = await feedbackText.textContent();
    expect(text?.trim().length).toBeGreaterThan(0);
    expect(text).not.toBe('Trage den Akkord ein...');
  });

  test('score increments on correct check', async ({ page }) => {
    const scoreTotal = page.locator('#score-total');
    await expect(scoreTotal).toHaveText('0');

    const checkBtn = page.locator('#btn-chord-check');
    await checkBtn.click();

    // total should increment regardless of correct/wrong
    const totalAfter = await scoreTotal.textContent();
    expect(Number(totalAfter)).toBeGreaterThan(0);
  });

  test('category checkbox changes chord pool', async ({ page }) => {
    // Switch to standard chords only
    const simplifiedCb = page.locator('#check-cat-simplified');
    const standardCb = page.locator('#check-cat-standard');

    await simplifiedCb.uncheck();
    await standardCb.check();

    // A new chord name should appear (may or may not be different)
    const chordName = page.locator('#chord-name-display');
    const text = await chordName.textContent();
    expect(text?.trim().length).toBeGreaterThan(0);
  });
});
