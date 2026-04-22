import { test, expect } from '@playwright/test';

test('spielt einen einzelnen C-Dur-Akkord korrekt ein', async ({ page }) => {
  await page.goto('/pages/chord-playing-essentia/index.html?chord=C-Dur&categories=standard');

  await expect(page.locator('#ece-chord-name')).toHaveText('C-Dur');
  await expect(page.locator('#btn-ece-listen')).toBeEnabled({ timeout: 15_000 });

  await page.click('#btn-ece-listen');

  await expect(page.locator('#feedback-text')).toHaveText('✅ Richtig!', { timeout: 12_000 });
});
