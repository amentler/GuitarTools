import { test, expect } from '@playwright/test';

test.describe('Metronome', () => {

  test.beforeEach(async ({ page }) => {
    await page.goto('/pages/metronome/index.html');
  });

  test('Start/Stop toggles button text and state', async ({ page }) => {
    const toggleBtn = page.locator('#btn-metronome-toggle');
    
    await expect(toggleBtn).toHaveText('Start');
    await expect(toggleBtn).not.toHaveClass(/playing/);

    await toggleBtn.click();
    await expect(toggleBtn).toHaveText('Stop');
    await expect(toggleBtn).toHaveClass(/playing/);

    await toggleBtn.click();
    await expect(toggleBtn).toHaveText('Start');
    await expect(toggleBtn).not.toHaveClass(/playing/);
  });

  test('BPM slider updates display and value', async ({ page }) => {
    const slider = page.locator('#metronome-bpm-slider');
    const display = page.locator('#metronome-bpm-value');

    await slider.fill('150');
    await expect(display).toHaveText('150');
    await expect(slider).toHaveValue('150');
  });

  test('BPM buttons update display and slider', async ({ page }) => {
    const display = page.locator('#metronome-bpm-value');
    const slider = page.locator('#metronome-bpm-slider');

    // Initial value is 120
    await page.locator('#btn-metronome-plus-5').click();
    await expect(display).toHaveText('125');
    await expect(slider).toHaveValue('125');

    await page.locator('#btn-metronome-minus-1').click();
    await expect(display).toHaveText('124');
    await expect(slider).toHaveValue('124');

    await page.locator('#btn-metronome-plus-1').click();
    await expect(display).toHaveText('125');
    await expect(slider).toHaveValue('125');

    await page.locator('#btn-metronome-minus-5').click();
    await expect(display).toHaveText('120');
    await expect(slider).toHaveValue('120');
  });

  test('Time signature select updates value', async ({ page }) => {
    const select = page.locator('#metronome-beats-select');
    
    await select.selectOption('3');
    await expect(select).toHaveValue('3');
  });

  test('Persistence: Reload restores BPM and time signature', async ({ page }) => {
    const slider = page.locator('#metronome-bpm-slider');
    const select = page.locator('#metronome-beats-select');

    await slider.fill('135');
    await select.selectOption('2');

    await page.reload();

    await expect(slider).toHaveValue('135');
    await expect(page.locator('#metronome-bpm-value')).toHaveText('135');
    await expect(select).toHaveValue('2');
  });
});
