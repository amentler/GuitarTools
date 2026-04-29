import { test, expect } from '@playwright/test';

test.describe('Navigation Baseline', () => {

  const pages = [
    { title: 'Griffbrett', path: '/pages/fretboard-tone-recognition/index.html' },
    { title: 'Noten lesen', path: '/pages/sheet-music-reading/index.html' },
    { title: 'Akkord-Trainer', path: '/pages/akkord-trainer/index.html' },
    { title: 'Ton-Finder', path: '/pages/ton-finder/index.html' },
    { title: 'Ton spielen', path: '/pages/note-playing/index.html' },
    { title: 'Noten spielen', path: '/pages/sheet-music-mic/index.html' },
    { title: 'Akkord spielen', path: '/pages/chord-playing-essentia/index.html' },
    { title: 'Akkorde spielen', path: '/pages/akkordfolgen-trainer/index.html' },
    { title: 'Tuner', path: '/pages/guitar-tuner/index.html' },
    { title: 'Metronom', path: '/pages/metronome/index.html' },
    { title: 'Akkord Übersicht', path: '/pages/akkord-uebersicht/index.html' }
  ];

  test('Main menu should render all menu cards', async ({ page }) => {
    await page.goto('/');
    
    for (const p of pages) {
      const card = page.locator(`gt-menu-card[title="${p.title}"]`);
      await expect(card).toBeVisible();
      await expect(card.locator('a')).toHaveAttribute('href', p.path.replace(/^\//, ''));
    }
  });

  for (const p of pages) {
    test(`Navigation: back button from ${p.title} works`, async ({ page }) => {
      await page.goto(p.path);

      // Check if gt-exercise-header back button is visible
      const backBtn = page.locator('gt-exercise-header a.btn-back');
      await expect(backBtn).toBeVisible();

      // Click back button
      await backBtn.click();

      // Should be back on main menu
      await expect(page).toHaveURL(/\/index\.html$|\/$/);
      const title = page.locator('.menu-title');
      await expect(title).toContainText('Gitarren-Lerntools');
    });
  }
});
