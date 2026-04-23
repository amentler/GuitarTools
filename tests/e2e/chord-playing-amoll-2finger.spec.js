import path from 'path';
import { fileURLToPath } from 'url';
import { test, expect } from '@playwright/test';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const aMollTwoFingerAudioPath = path.resolve(__dirname, '../fixtures/chords/A-Moll (2-Finger)/01.wav');

test.use({
  launchOptions: {
    args: [
      '--use-fake-ui-for-media-stream',
      '--use-fake-device-for-media-stream',
      `--use-file-for-fake-audio-capture=${aMollTwoFingerAudioPath}`,
    ],
  },
});

test('spielt A-Moll (2-Finger) mit neuer WAV korrekt ein', async ({ page }) => {
  await page.addInitScript(() => {
    window.__eceFeedbackHistory = [];

    document.addEventListener('DOMContentLoaded', () => {
      const feedback = document.getElementById('feedback-text');
      if (!feedback) return;

      const pushCurrentText = () => {
        window.__eceFeedbackHistory.push(feedback.textContent ?? '');
      };

      pushCurrentText();

      const observer = new MutationObserver(pushCurrentText);
      observer.observe(feedback, { childList: true, characterData: true, subtree: true });
    });
  });

  await page.goto('/pages/chord-playing-essentia/index.html?chord=A-Moll%20(2-Finger)&categories=simplified');

  await expect(page.locator('#ece-chord-name')).toHaveText('A-Moll (2-Finger)');
  await expect(page.locator('#btn-ece-listen')).toBeEnabled({ timeout: 15_000 });

  await page.waitForFunction(() => {
    const history = window.__eceFeedbackHistory ?? [];
    return history.includes('Erfolg!');
  }, null, { timeout: 12_000 });
});
