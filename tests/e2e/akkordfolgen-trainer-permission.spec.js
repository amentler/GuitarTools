import { test, expect } from '@playwright/test';

test.describe('Akkordfolgen-Trainer - Permission Failure', () => {

  test.beforeEach(async ({ context }) => {
    await context.addInitScript(() => {
      navigator.mediaDevices.getUserMedia = () => Promise.reject(new Error('Permission denied'));
    });
  });

  test('Should show error message when microphone is denied after start', async ({ page }) => {
    await page.goto('/pages/akkordfolgen-trainer/index.html');

    // Click start button to trigger microphone request
    const startBtn = page.locator('#aft-start-btn');
    await expect(startBtn).toBeVisible();
    await startBtn.click();

    const errorMsg = page.locator('#aft-permission');
    await expect(errorMsg).toBeVisible();
    await expect(errorMsg).toContainText(/Mikrofon/i);
    
    // Setup should still be visible (it reverts to setup on error)
    await expect(page.locator('#aft-setup')).toBeVisible();
    await expect(page.locator('#aft-start-btn')).toBeVisible();
  });
});
