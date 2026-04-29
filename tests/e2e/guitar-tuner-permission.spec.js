import { test, expect } from '@playwright/test';

test.describe('Guitar Tuner - Permission Failure', () => {

  test.beforeEach(async ({ context }) => {
    // Deny microphone permission
    await context.grantPermissions([]);
    // Also mock getUserMedia to reject, as some browsers/environments 
    // might handle permission denial differently in Playwright
    await context.addInitScript(() => {
      navigator.mediaDevices.getUserMedia = () => Promise.reject(new Error('Permission denied'));
    });
  });

  test('Should show error message when microphone is denied', async ({ page }) => {
    await page.goto('/pages/guitar-tuner/index.html');

    const errorMsg = page.locator('#tuner-permission');
    await expect(errorMsg).toBeVisible();
    await expect(errorMsg).toContainText(/Mikrofon/i);
    
    // UI should still be functional (e.g. mode toggle)
    const chromaticBtn = page.locator('#btn-mode-chromatic');
    await chromaticBtn.click();
    await expect(chromaticBtn).toHaveClass(/active/);
  });
});
