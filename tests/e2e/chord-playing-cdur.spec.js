import path from 'path';
import { fileURLToPath } from 'url';
import { test, expect } from '@playwright/test';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const cDurAudioPath = path.resolve(__dirname, '../fixtures/chords/C-Dur/c_chord.wav');

test.use({
  launchOptions: {
    args: [
      '--use-fake-ui-for-media-stream',
      '--use-fake-device-for-media-stream',
      `--use-file-for-fake-audio-capture=${cDurAudioPath}`,
    ],
  },
});

test('spielt einen einzelnen C-Dur-Akkord korrekt ein', async ({ page }) => {
  await page.goto('/pages/chord-playing-essentia/index.html?chord=C-Dur&categories=standard');

  await expect(page.locator('#ece-chord-name')).toHaveText('C-Dur');
  await expect(page.locator('#btn-ece-listen')).toBeEnabled({ timeout: 15_000 });

  await expect(page.locator('#feedback-text')).toHaveText('Erfolg!', { timeout: 12_000 });
});
