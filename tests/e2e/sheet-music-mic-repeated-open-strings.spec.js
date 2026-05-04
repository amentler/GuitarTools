import path from 'path';
import { fileURLToPath } from 'url';
import { test, expect } from '@playwright/test';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repeatedOpenStringsAudioPath = path.resolve(__dirname, '../fixtures/sequences/open-strings/eeeeaaaaddddgggg.wav');

function note(name, octave, vfKey, string) {
  return { name, octave, vfKey, string, fret: 0 };
}

test.use({
  launchOptions: {
    args: [
      '--use-fake-ui-for-media-stream',
      '--use-fake-device-for-media-stream',
      `--use-file-for-fake-audio-capture=${repeatedOpenStringsAudioPath}`,
    ],
  },
});

test('Noten lesen im Aktivmodus akzeptiert wiederholte offene Saiten ueber das echte Chromium-Fake-Mikrofon', async ({ page }) => {
  const bars = [[
    note('E', 2, 'e/3', 6),
    note('E', 2, 'e/3', 6),
    note('E', 2, 'e/3', 6),
    note('E', 2, 'e/3', 6),
  ], [
    note('A', 2, 'a/3', 5),
    note('A', 2, 'a/3', 5),
    note('A', 2, 'a/3', 5),
    note('A', 2, 'a/3', 5),
  ], [
    note('D', 3, 'd/4', 4),
    note('D', 3, 'd/4', 4),
    note('D', 3, 'd/4', 4),
    note('D', 3, 'd/4', 4),
  ], [
    note('G', 3, 'g/4', 3),
    note('G', 3, 'g/4', 3),
    note('G', 3, 'g/4', 3),
    note('G', 3, 'g/4', 3),
  ]];

  await page.addInitScript(injectedBars => {
    localStorage.setItem('sheetMusic_active', 'true');
    window.__GT_SHEET_MUSIC_READING_BARS__ = injectedBars;
  }, bars);

  await page.goto('/pages/sheet-music-reading/index.html');

  await expect(page.locator('#score-container svg').first()).toBeVisible();
  await expect(page.locator('#sheet-music-current-note')).toHaveText('E2');

  await expect(page.locator('#sheet-music-current-note')).toHaveText('A2', { timeout: 10_000 });

  await expect(page.locator('#sheet-music-current-note')).toHaveText('D3', { timeout: 10_000 });

  await expect(page.locator('#sheet-music-current-note')).toHaveText('G3', { timeout: 10_000 });

  await expect(page.locator('#sheet-music-current-note')).toHaveText('✓', { timeout: 10_000 });
  await expect(page.locator('#sheet-music-feedback')).toContainText('Alle Noten gespielt!', { timeout: 10_000 });

  const greenNotes = page.locator('#score-container svg [fill="#2ecc71"], #score-container svg [stroke="#2ecc71"]');
  await expect(greenNotes).toHaveCount(16);
});
