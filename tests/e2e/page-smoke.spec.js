import { test, expect } from '@playwright/test';

test.describe('Page Smoke Tests', () => {

  const smokeConfigs = [
    { name: 'Griffbrett-Erkennung', path: '/pages/fretboard-tone-recognition/index.html', anchor: 'gt-fretboard' },
    { name: 'Noten lesen', path: '/pages/sheet-music-reading/index.html', anchor: '#score-container' },
    { name: 'Akkord-Trainer', path: '/pages/akkord-trainer/index.html', anchor: 'gt-fretboard' },
    { name: 'Ton-Finder', path: '/pages/ton-finder/index.html', anchor: '#ton-finder-svg' },
    { name: 'Ton spielen', path: '/pages/note-playing/index.html', anchor: '#note-play-notation' },
    { name: 'Noten spielen', path: '/pages/sheet-music-mic/index.html', anchor: '#sheet-mic-score-container' },
    { name: 'Akkord spielen', path: '/pages/chord-playing-essentia/index.html', anchor: 'gt-fretboard' },
    { name: 'Akkordfolgen-Trainer', path: '/pages/akkordfolgen-trainer/index.html', anchor: '#aft-setup' },
    { name: 'Gitarren-Tuner', path: '/pages/guitar-tuner/index.html', anchor: '.tuner-mode-toggle' },
    { name: 'Metronom', path: '/pages/metronome/index.html', anchor: '#metronome-bpm-slider' },
    { name: 'Akkord-Uebersicht', path: '/pages/akkord-uebersicht/index.html', anchor: '#akkord-uebersicht-container' }
  ];

  for (const config of smokeConfigs) {
    test(`Smoke: ${config.name} should load and show primary anchor`, async ({ page }) => {
      // Catch console errors
      const errors = [];
      page.on('pageerror', err => errors.push(err.message));
      
      await page.goto(config.path);

      // Check primary anchor
      const anchor = page.locator(config.anchor);
      await expect(anchor).toBeVisible();

      // Ensure no major JS errors occurred during load
      expect(errors).toEqual([]);
    });
  }
});
