import { test, expect } from '@playwright/test';

test('spielt einen einzelnen E-Moll-Akkord korrekt ein', async ({ page }) => {
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

  await page.goto('/pages/chord-playing-essentia/index.html?chord=E-Moll&categories=standard');

  await expect(page.locator('#ece-chord-name')).toHaveText('E-Moll');
  await expect(page.locator('#btn-ece-listen')).toBeEnabled({ timeout: 15_000 });

  await page.waitForFunction(() => {
    const history = window.__eceFeedbackHistory ?? [];
    return history.includes('Erfolg!');
  }, null, { timeout: 12_000 });
});
