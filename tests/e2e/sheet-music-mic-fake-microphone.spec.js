import path from 'path';
import { fileURLToPath } from 'url';
import { test, expect } from '@playwright/test';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const openStringsSequenceAudioPath = path.resolve(__dirname, '../fixtures/sequences/open-strings/medium.wav');

test.use({
  launchOptions: {
    args: [
      '--use-fake-ui-for-media-stream',
      '--use-fake-device-for-media-stream',
      `--use-file-for-fake-audio-capture=${openStringsSequenceAudioPath}`,
    ],
  },
});

test('Noten spielen akzeptiert vier Noten ueber das echte Chromium-Fake-Mikrofon', async ({ page }) => {
  await page.addInitScript(() => {
    window.__GT_SHEET_MUSIC_MIC_BARS__ = [[
      { name: 'E', octave: 2, vfKey: 'e/3', string: 6, fret: 0 },
      { name: 'A', octave: 2, vfKey: 'a/3', string: 5, fret: 0 },
      { name: 'D', octave: 3, vfKey: 'd/4', string: 4, fret: 0 },
      { name: 'G', octave: 3, vfKey: 'g/4', string: 3, fret: 0 },
    ]];
  });

  await page.goto('/pages/sheet-music-mic/index.html');

  await expect(page.locator('#sheet-mic-score-container svg')).toBeVisible();
  await expect(page.locator('#score-value')).toHaveText('0 / 4');
  await expect(page.locator('#sheet-mic-current-note')).toHaveText('E2');

  await expect(page.locator('#score-value')).toHaveText('1 / 4', { timeout: 6_000 });
  await expect(page.locator('#sheet-mic-current-note')).toHaveText('A2', { timeout: 6_000 });

  await expect(page.locator('#score-value')).toHaveText('2 / 4', { timeout: 6_000 });
  await expect(page.locator('#sheet-mic-current-note')).toHaveText('D3', { timeout: 6_000 });

  await expect(page.locator('#score-value')).toHaveText('3 / 4', { timeout: 6_000 });
  await expect(page.locator('#sheet-mic-current-note')).toHaveText('G3', { timeout: 6_000 });

  await expect(page.locator('#score-value')).toHaveText('4 / 4', { timeout: 6_000 });
  await expect(page.locator('#sheet-mic-current-note')).toHaveText('✓', { timeout: 6_000 });
  await expect(page.locator('#sheet-mic-feedback')).toContainText('Alle Noten gespielt!', { timeout: 6_000 });

  const greenNotes = page.locator('#sheet-mic-score-container svg [fill="#2ecc71"], #sheet-mic-score-container svg [stroke="#2ecc71"]');
  await expect(greenNotes).toHaveCount(4);
});
