import { test, expect } from '@playwright/test';

test.describe('Sheet Music Reading', () => {

  test.beforeEach(async ({ page }) => {
    await page.goto('/pages/sheet-music-reading/index.html');
  });

  test('Page renders score container', async ({ page }) => {
    const score = page.locator('#score-container');
    await expect(score).toBeVisible();
    // VexFlow should render something inside (usually an SVG or Canvas)
    // We use .first() because there might be multiple SVGs (e.g. playback bar)
    await expect(score.locator('svg, canvas').first()).toBeVisible();
  });

  test('Toggle buttons change state', async ({ page }) => {
    const tabBtn = page.locator('#btn-show-tab');
    const endlessBtn = page.locator('#btn-endless-mode');

    await expect(tabBtn).not.toHaveClass(/active/);
    await tabBtn.click();
    await expect(tabBtn).toHaveClass(/active/);

    await expect(endlessBtn).not.toHaveClass(/active/);
    await endlessBtn.click();
    await expect(endlessBtn).toHaveClass(/active/);
  });

  test('BPM slider updates label', async ({ page }) => {
    const slider = page.locator('#sheet-music-bpm-slider');
    const label = page.locator('#sheet-music-bpm-label');

    await slider.fill('120');
    await expect(label).toHaveText('120');
  });

  test('Time signature select updates value', async ({ page }) => {
    const select = page.locator('#sheet-music-time-sig');
    await select.selectOption('3/4');
    await expect(select).toHaveValue('3/4');
  });

  test('New bars button regenerates content', async ({ page }) => {
    const score = page.locator('#score-container');
    // Wait for initial render
    await expect(score.locator('svg').first()).toBeVisible();
    const initialContent = await score.innerHTML();
    
    await page.locator('#btn-new-bars').click();
    
    // Content should change (new SVG usually)
    await expect(async () => {
      const newContent = await score.innerHTML();
      expect(newContent).not.toBe(initialContent);
    }).toPass();
  });

  test('Persistence: Reload restores settings', async ({ page }) => {
    // We set localStorage directly to ensure the state is saved,
    // then reload and check if the UI picks it up.
    await page.evaluate(() => {
      localStorage.setItem('sheetMusic_bpm', '110');
      localStorage.setItem('sheetMusic_timeSig', '6/8');
      localStorage.setItem('sheetMusic_showTab', 'true');
      localStorage.setItem('sheetMusic_endless', 'true');
    });

    // Ensure it's there
    const bpm = await page.evaluate(() => localStorage.getItem('sheetMusic_bpm'));
    expect(bpm).toBe('110');

    // Give a tiny moment for any potential async storage sync (though localStorage is sync)
    await page.waitForTimeout(100);

    await page.reload();

    // The slider should have the value from localStorage
    const slider = page.locator('#sheet-music-bpm-slider');
    await expect(slider).toHaveValue('110');
    
    // Label should also be updated
    await expect(page.locator('#sheet-music-bpm-label')).toHaveText('110');
    
    // Select should be updated
    await expect(page.locator('#sheet-music-time-sig')).toHaveValue('6/8');
    
    // Buttons should have active class
    await expect(page.locator('#btn-show-tab')).toHaveClass(/active/);
    await expect(page.locator('#btn-endless-mode')).toHaveClass(/active/);
  });
});
