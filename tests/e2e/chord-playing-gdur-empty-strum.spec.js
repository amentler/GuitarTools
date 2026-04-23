import path from 'path';
import { fileURLToPath } from 'url';
import { test, expect } from '@playwright/test';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const emptyStrumAudioPath = path.resolve(__dirname, '../fixtures/chords/0_strum.wav');

test.use({
  launchOptions: {
    args: [
      '--use-fake-ui-for-media-stream',
      '--use-fake-device-for-media-stream',
      `--use-file-for-fake-audio-capture=${emptyStrumAudioPath}`,
    ],
  },
});

test('wertet leeres Strumming bei erwartetem G-Dur nicht als richtig', async ({ page }) => {
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

  await page.goto('/pages/chord-playing-essentia/index.html?chord=G-Dur&categories=standard');

  await expect(page.locator('#ece-chord-name')).toHaveText('G-Dur');
  await expect(page.locator('#btn-ece-listen')).toBeEnabled({ timeout: 15_000 });

  await page.click('#btn-ece-listen');

  await page.waitForTimeout(5_000);

  const feedbackHistory = await page.evaluate(() => window.__eceFeedbackHistory ?? []);
  expect(
    feedbackHistory,
    `Leeres Strumming wurde fälschlich als richtig bewertet. Feedback-Historie: ${JSON.stringify(feedbackHistory)}`,
  ).not.toContain('✅ Richtig!');
  expect(
    feedbackHistory.some(text => /Kein Anschlag erkannt|Nicht erkannt/.test(text)),
    `Es wurde weder Timeout noch Fehlerfeedback angezeigt. Feedback-Historie: ${JSON.stringify(feedbackHistory)}`,
  ).toBe(true);
});
