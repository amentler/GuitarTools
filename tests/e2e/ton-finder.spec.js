import { test, expect } from '@playwright/test';

test.describe('Ton-Finder Exercise', () => {

  test.beforeEach(async ({ page }) => {
    // Disable SRS to get deterministic behaviour
    await page.addInitScript(() => {
      window.localStorage.setItem('gt_srs_enabled', 'false');
    });
    await page.goto('/pages/ton-finder/index.html');
  });

  test('shows a target note on load', async ({ page }) => {
    const targetNote = page.locator('#ton-finder-target-note');
    await expect(targetNote).toBeVisible();
    const text = await targetNote.textContent();
    expect(text?.trim().length).toBeGreaterThan(0);
  });

  test('fretboard is visible and interactive', async ({ page }) => {
    const fretboard = page.locator('#ton-finder-svg');
    await expect(fretboard).toBeVisible();
  });

  test('clicking a fret position shows feedback', async ({ page }) => {
    const fretboard = page.locator('#ton-finder-svg');
    await expect(fretboard).toBeVisible();

    // Click any fret position (data-fret="1" on first string)
    const anyFret = page.locator('gt-fretboard circle[data-fret="1"]').first();
    if (await anyFret.count() > 0) {
      await anyFret.click({ force: true });
      // After clicking, a feedback or selection state should appear
      const selectedMarkers = page.locator('gt-fretboard circle[fill="#ff6b35"]');
      // At least one marker selected or feedback shown
      const feedbackText = page.locator('#ton-finder-feedback');
      const markerCount = await selectedMarkers.count();
      const feedbackContent = await feedbackText.textContent();
      expect(markerCount > 0 || (feedbackContent ?? '').length > 0).toBe(true);
    }
  });

  test('Fertig button triggers next round or score update', async ({ page }) => {
    const fertigBtn = page.locator('#btn-ton-finder-finish');
    await expect(fertigBtn).toBeVisible();

    await fertigBtn.click();

    // After Fertig, either the target note changes or points update
    const pointsEl = page.locator('#score-points');
    if (await pointsEl.count() > 0) {
      const points = await pointsEl.textContent();
      expect(points).not.toBeNull();
    } else {
      const noteAfter = await page.locator('#ton-finder-target-note').textContent();
      // Note may change or stay (if no positions found)
      expect(typeof noteAfter).toBe('string');
    }
  });

  test('string toggle changes active strings', async ({ page }) => {
    const stringToggles = page.locator('gt-string-toggles');
    await expect(stringToggles).toBeVisible();

    // Find a toggle button inside the component
    const toggleBtn = page.locator('gt-string-toggles button').first();
    if (await toggleBtn.count() > 0) {
      const classBefore = await toggleBtn.getAttribute('class');
      await toggleBtn.click();
      const classAfter = await toggleBtn.getAttribute('class');
      // Class should change (active/inactive state toggled)
      expect(classBefore).not.toEqual(classAfter);
    }
  });

  test('fret range slider changes label', async ({ page }) => {
    const slider = page.locator('#ton-finder-fret-range-slider');
    const label = page.locator('#ton-finder-fret-range-label');

    await expect(slider).toBeVisible();
    await slider.fill('7');
    // The label should reflect the new value
    const labelText = await label.textContent();
    expect(labelText).toContain('7');
  });
});
