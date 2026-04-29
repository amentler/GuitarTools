import { test, expect } from '@playwright/test';

function mockRandomSequence(page, values) {
  return page.addInitScript(sequence => {
    const queue = [...sequence];
    window.__GT_RANDOM__ = () => {
      if (queue.length === 0) {
        throw new Error('Random mock exhausted.');
      }
      return queue.shift();
    };
  }, values);
}

test.describe('Fretboard Tone Recognition Exercise', () => {
  test('shows an open-string target marker left of the fretboard when the mocked draw picks fret 0', async ({ page }) => {
    await mockRandomSequence(page, [0.01, 0.01]);
    await page.goto('/pages/fretboard-tone-recognition/index.html');

    const fretboard = page.locator('gt-fretboard');
    await expect(fretboard).toBeVisible();

    const openTarget = page.locator('gt-fretboard circle[fill="none"][stroke="#ff6b35"]');
    await expect(openTarget).toHaveCount(1);

    const filledTargets = page.locator('gt-fretboard circle[fill="#ff6b35"]');
    await expect(filledTargets).toHaveCount(0);

    const openPlaceholder = page.locator('gt-fretboard circle[data-string="0"][data-fret="0"]');
    const markerCx = await openTarget.getAttribute('cx');
    const markerCy = await openTarget.getAttribute('cy');

    await expect(openPlaceholder).toHaveAttribute('cx', markerCx);
    await expect(openPlaceholder).toHaveAttribute('cy', markerCy);
  });

  test('shows a filled fret marker on the fretboard when the mocked draw picks a fretted note', async ({ page }) => {
    await mockRandomSequence(page, [0.34, 0.65]);
    await page.goto('/pages/fretboard-tone-recognition/index.html');

    const fretboard = page.locator('gt-fretboard');
    await expect(fretboard).toBeVisible();

    const fretTarget = page.locator('gt-fretboard circle[fill="#ff6b35"]');
    await expect(fretTarget).toHaveCount(1);

    const openTargets = page.locator('gt-fretboard circle[fill="none"][stroke="#ff6b35"]');
    await expect(openTargets).toHaveCount(0);

    const fretPlaceholder = page.locator('gt-fretboard circle[data-string="2"][data-fret="3"]');
    const markerCx = await fretTarget.getAttribute('cx');
    const markerCy = await fretTarget.getAttribute('cy');

    await expect(fretPlaceholder).toHaveAttribute('cx', markerCx);
    await expect(fretPlaceholder).toHaveAttribute('cy', markerCy);
  });

  test('keeps the first fret visible in open-string-only mode without rendering fret markers on the board', async ({ page }) => {
    await mockRandomSequence(page, [0.01, 0.01]);
    await page.goto('/pages/fretboard-tone-recognition/index.html');

    await page.locator('#fret-range-slider').fill('0');

    const fretboard = page.locator('gt-fretboard');
    await expect(fretboard).toHaveAttribute('frets', '0');

    const fretNumber = page.locator('gt-fretboard text').filter({ hasText: '1' });
    await expect(fretNumber).toHaveCount(1);

    const openTarget = page.locator('gt-fretboard circle[fill="none"][stroke="#ff6b35"]');
    await expect(openTarget).toHaveCount(1);

    const filledTargets = page.locator('gt-fretboard circle[fill="#ff6b35"]');
    await expect(filledTargets).toHaveCount(0);

    const fret1Placeholder = page.locator('gt-fretboard circle[data-string="0"][data-fret="1"]');
    await expect(fret1Placeholder).toHaveCount(0);
  });
});
