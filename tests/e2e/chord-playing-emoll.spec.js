import { test, expect } from '@playwright/test';

test('spielt einen einzelnen E-Moll-Akkord korrekt ein', async ({ page }) => {
  await page.addInitScript(() => {
    const originalRandom = Math.random;
    let callCount = 0;

    Math.random = () => {
      callCount += 1;
      if (callCount === 1) return 0.51;
      return originalRandom();
    };
  });

  await page.goto('/pages/chord-playing-essentia/index.html');

  await expect(page.locator('#ece-chord-name')).toHaveText('E-Moll (2-Finger)');
  await expect(page.locator('#btn-ece-listen')).toBeEnabled({ timeout: 15_000 });

  await page.click('#btn-ece-listen');

  await expect(page.locator('#feedback-text')).toHaveText('✅ Richtig!', { timeout: 12_000 });
});
