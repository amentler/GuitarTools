import path from 'path';
import { fileURLToPath } from 'url';
import { test, expect } from '@playwright/test';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const D3_WAV = path.resolve(__dirname, '../fixtures/audio/D3/d3.wav');

function note(name, octave, vfKey, string) {
  return { name, octave, vfKey, string, fret: 0 };
}

test.use({
  launchOptions: {
    args: [
      '--use-fake-ui-for-media-stream',
      '--use-fake-device-for-media-stream',
      `--use-file-for-fake-audio-capture=${D3_WAV}`,
    ],
  },
});

test('Noten lesen im Aktivmodus erkennt eine echte D3-WAV über Chromium-Fake-Mikrofon', async ({ page }) => {
  await page.addInitScript(injectedBars => {
    localStorage.setItem('sheetMusic_active', 'true');
    window.__GT_SHEET_MUSIC_READING_BARS__ = injectedBars;
  }, [[note('D', 3, 'd/4', 4)]]);

  await page.goto('/pages/sheet-music-reading/index.html');

  await expect(page.locator('#score-container svg').first()).toBeVisible();
  await expect(page.locator('#sheet-music-current-note')).toHaveText('D3');
  await expect(page.locator('#sheet-music-current-note')).toHaveText('✓', { timeout: 12_000 });
  await expect(page.locator('#sheet-music-feedback')).toContainText('Alle Noten gespielt!');

  const greenNotes = page.locator('#score-container svg [fill="#2ecc71"], #score-container svg [stroke="#2ecc71"]');
  await expect(greenNotes).toHaveCount(1);
});
