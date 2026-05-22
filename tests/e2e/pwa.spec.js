import { test, expect } from '@playwright/test';

test.describe('PWA – Service Worker and Manifest', () => {

  test('service worker is registered successfully', async ({ page }) => {
    await page.goto('/');

    // Wait for SW registration
    const swRegistered = await page.evaluate(async () => {
      if (!('serviceWorker' in navigator)) return false;
      try {
        const reg = await navigator.serviceWorker.ready;
        return reg.active !== null || reg.waiting !== null || reg.installing !== null;
      } catch {
        return false;
      }
    });

    expect(swRegistered).toBe(true);
  });

  test('manifest.json is accessible', async ({ page }) => {
    const response = await page.request.get('/manifest.json');
    expect(response.status()).toBe(200);

    const json = await response.json();
    expect(json.name).toBeTruthy();
    expect(json.icons).toBeTruthy();
    expect(Array.isArray(json.icons)).toBe(true);
    expect(json.icons.length).toBeGreaterThan(0);
  });

  test('sw.js is accessible', async ({ page }) => {
    const response = await page.request.get('/sw.js');
    expect(response.status()).toBe(200);

    const text = await response.text();
    expect(text).toContain('CACHE_VERSION');
    expect(text).toContain('install');
  });

  test('app has correct theme-color meta tag', async ({ page }) => {
    await page.goto('/');

    const themeColor = await page.locator('meta[name="theme-color"]').getAttribute('content');
    expect(themeColor).toBeTruthy();
  });

  test('main index page is cached after first load', async ({ page }) => {
    // First visit — populate cache
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Check that at least one guitartools cache exists
    const hasCaches = await page.evaluate(async () => {
      const keys = await caches.keys();
      return keys.some(k => k.startsWith('guitartools'));
    });

    expect(hasCaches).toBe(true);
  });
});
