import { test, expect } from '@playwright/test';

test.describe('Note Playing - Permission Failure', () => {

  test.beforeEach(async ({ context }) => {
    await context.addInitScript(() => {
      navigator.mediaDevices.getUserMedia = () => Promise.reject(new Error('Permission denied'));
    });
  });

  test('Should show error message when microphone is denied', async ({ page }) => {
    await page.goto('/pages/note-playing/index.html');

    const errorMsg = page.locator('#note-play-permission');
    await expect(errorMsg).toBeVisible();
    await expect(errorMsg).toContainText(/Mikrofon/i);
    
    // Static UI should still be there
    await expect(page.locator('#note-play-notation')).toBeVisible();
    await expect(page.locator('#note-play-hint1')).toBeVisible();
  });
});
