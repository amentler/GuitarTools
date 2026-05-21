import { test, expect } from '@playwright/test';

const PAGES = [
  { path: '/', name: 'Main Menu' },
  { path: '/pages/ton-finder/index.html', name: 'Ton-Finder' },
  { path: '/pages/fretboard-tone-recognition/index.html', name: 'Fretboard Exercise' },
  { path: '/pages/sheet-music-reading/index.html', name: 'Sheet Music Reading' },
  { path: '/pages/metronome/index.html', name: 'Metronome' },
  { path: '/pages/akkord-uebersicht/index.html', name: 'Akkord-Übersicht' },
];

test.describe('Mobile Viewport – Responsive Layout', () => {

  test.use({ viewport: { width: 390, height: 844 } }); // iPhone 14

  for (const { path, name } of PAGES) {
    test(`${name}: no horizontal overflow on mobile`, async ({ page }) => {
      await page.goto(path);
      await page.waitForLoadState('domcontentloaded');

      const pageWidth = await page.evaluate(() => document.documentElement.scrollWidth);
      const viewportWidth = 390;

      // Tolerate up to 5px overflow (scrollbar/rounding)
      expect(pageWidth).toBeLessThanOrEqual(viewportWidth + 5);
    });
  }

  test('main menu cards are visible on mobile', async ({ page }) => {
    await page.goto('/');

    const cards = page.locator('gt-menu-card');
    await expect(cards.first()).toBeVisible();

    const count = await cards.count();
    expect(count).toBeGreaterThan(5);

    // Cards must be fully inside viewport (not cut off)
    const firstCard = cards.first();
    const box = await firstCard.boundingBox();
    if (box) {
      expect(box.x).toBeGreaterThanOrEqual(0);
      expect(box.right ?? (box.x + box.width)).toBeLessThanOrEqual(400);
    }
  });

  test('ton-finder controls stack vertically on mobile', async ({ page }) => {
    await page.goto('/pages/ton-finder/index.html');

    const fretboard = page.locator('#ton-finder-svg');
    const toggles = page.locator('#ton-finder-string-toggles');

    await expect(fretboard).toBeVisible();
    await expect(toggles).toBeVisible();

    const fretboardBox = await fretboard.boundingBox();
    const togglesBox = await toggles.boundingBox();

    if (fretboardBox && togglesBox) {
      // On mobile, toggles should be below fretboard (stacked vertically)
      expect(togglesBox.y).toBeGreaterThanOrEqual(fretboardBox.y);
    }
  });

  test('exercise header back-button is reachable on mobile', async ({ page }) => {
    await page.goto('/pages/ton-finder/index.html');

    const exerciseHeader = page.locator('gt-exercise-header');
    await expect(exerciseHeader).toBeVisible();

    const backBtn = exerciseHeader.locator('a, button').first();
    const box = await backBtn.boundingBox();
    if (box) {
      expect(box.x).toBeGreaterThanOrEqual(0);
      expect(box.x + box.width).toBeLessThanOrEqual(400);
    }
  });
});

test.describe('Tablet Viewport – Responsive Layout', () => {

  test.use({ viewport: { width: 768, height: 1024 } }); // iPad

  test('main menu shows grid layout on tablet', async ({ page }) => {
    await page.goto('/');

    const cards = page.locator('gt-menu-card');
    await expect(cards.first()).toBeVisible();

    // All cards should fit within tablet viewport width
    const firstBox = await cards.first().boundingBox();
    if (firstBox) {
      expect(firstBox.x + firstBox.width).toBeLessThanOrEqual(780);
    }
  });
});
