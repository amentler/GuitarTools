import { test, expect } from '@playwright/test';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const WAV_FIXTURE  = path.resolve(__dirname, '../fixtures/chords/E-Moll/emin.wav');

test.describe('Onset Tagger', () => {

  test.beforeEach(async ({ page }) => {
    await page.goto('/pages/onset-tagger/index.html');
  });

  test('page loads with file-load buttons and step sections', async ({ page }) => {
    await expect(page.locator('#tagger-load-menu-btn')).toBeVisible();
    await page.locator('#tagger-load-menu-btn').click();
    await expect(page.locator('#tagger-wav-btn')).toBeVisible();
    await expect(page.locator('#tagger-json-btn')).toBeVisible();
    await expect(page.locator('#tagger-zip-btn')).toBeVisible();
    await expect(page.locator('#tagger-export-top')).toBeVisible();
    await expect(page.locator('#tagger-filename-input')).toBeVisible();
    await expect(page.locator('#tagger-step1')).toBeVisible();
    await expect(page.locator('#tagger-step2')).toBeVisible();
  });

  test('step 1 is initially disabled', async ({ page }) => {
    await expect(page.locator('#tagger-step1')).toHaveClass(/tagger-section--disabled/);
  });

  test('loading a WAV file enables step 1 and shows waveform SVG', async ({ page }) => {
    const input = page.locator('#tagger-wav-input');
    await input.setInputFiles(WAV_FIXTURE);

    // Wait for waveform SVG to appear
    await expect(page.locator('#tagger-waveform-wrap svg')).toBeVisible({ timeout: 10_000 });
    await expect(page.locator('#tagger-step1')).not.toHaveClass(/tagger-section--disabled/);
  });

  test('add onset button adds entry to onset list', async ({ page }) => {
    await page.locator('#tagger-wav-input').setInputFiles(WAV_FIXTURE);
    await expect(page.locator('#tagger-waveform-wrap svg')).toBeVisible({ timeout: 10_000 });

    // The onset cursor slider defaults to 0 ms; click add
    await page.locator('#tagger-add-onset').click();

    const items = page.locator('.tagger-onset-item');
    await expect(items).toHaveCount(1);
  });

  test('remove onset button removes entry from list', async ({ page }) => {
    await page.locator('#tagger-wav-input').setInputFiles(WAV_FIXTURE);
    await expect(page.locator('#tagger-waveform-wrap svg')).toBeVisible({ timeout: 10_000 });

    await page.locator('#tagger-add-onset').click();
    await expect(page.locator('.tagger-onset-item')).toHaveCount(1);

    await page.locator('.tagger-onset-remove').click();
    await expect(page.locator('.tagger-onset-item')).toHaveCount(0);
  });

  test('selecting an onset in the list focuses it and slider edits the marker', async ({ page }) => {
    await page.locator('#tagger-wav-input').setInputFiles(WAV_FIXTURE);
    await expect(page.locator('#tagger-waveform-wrap svg')).toBeVisible({ timeout: 10_000 });

    await page.locator('#tagger-add-onset').click();
    await expect(page.locator('.tagger-onset-item')).toHaveCount(1);
    await page.locator('.tagger-onset-select').click();

    await expect(page.locator('.tagger-onset-item')).toHaveClass(/tagger-onset-item--selected/);
    await expect(page.locator('#tagger-cursor-display')).toHaveText('0.000 s');

    await page.locator('#tagger-cursor').evaluate((el) => {
      el.value = '100';
      el.dispatchEvent(new Event('input', { bubbles: true }));
    });

    await expect(page.locator('.tagger-onset-select')).toHaveText('1. 100 ms');
  });

  test('zoom buttons shrink and expand the visible range', async ({ page }) => {
    await page.locator('#tagger-wav-input').setInputFiles(WAV_FIXTURE);
    await expect(page.locator('#tagger-waveform-wrap svg')).toBeVisible({ timeout: 10_000 });

    const fullRange = await page.locator('#tagger-range-end').evaluate((el) => parseFloat(el.value));
    await page.locator('#tagger-zoom-in').click();
    const zoomed = await page.locator('#tagger-range-end').evaluate((endEl) => {
      const startEl = document.getElementById('tagger-range-start');
      return parseFloat(endEl.value) - parseFloat(startEl.value);
    });
    expect(zoomed).toBeLessThan(fullRange);

    await page.locator('#tagger-zoom-out').click();
    const unzoomed = await page.locator('#tagger-range-end').evaluate((endEl) => {
      const startEl = document.getElementById('tagger-range-start');
      return parseFloat(endEl.value) - parseFloat(startEl.value);
    });
    expect(unzoomed).toBeGreaterThan(zoomed);
  });

  test('selecting an onset centers the waveform on a close focus window', async ({ page }) => {
    await page.locator('#tagger-wav-input').setInputFiles(WAV_FIXTURE);
    await expect(page.locator('#tagger-waveform-wrap svg')).toBeVisible({ timeout: 10_000 });

    await page.locator('#tagger-cursor').evaluate((el) => {
      el.value = '1000';
      el.dispatchEvent(new Event('input', { bubbles: true }));
    });
    await page.locator('#tagger-add-onset').click();
    await page.locator('.tagger-onset-select').click();

    const range = await page.locator('#tagger-range-end').evaluate((endEl) => {
      const startEl = document.getElementById('tagger-range-start');
      return {
        start: parseFloat(startEl.value),
        end: parseFloat(endEl.value),
      };
    });
    expect(range.end - range.start).toBeLessThanOrEqual(0.61);
    expect((range.start + range.end) / 2).toBeCloseTo(1, 1);
  });

  test('clicking an onset marker centers the waveform', async ({ page }) => {
    await page.locator('#tagger-wav-input').setInputFiles(WAV_FIXTURE);
    await expect(page.locator('#tagger-waveform-wrap svg')).toBeVisible({ timeout: 10_000 });

    await page.locator('#tagger-cursor').evaluate((el) => {
      el.value = '1000';
      el.dispatchEvent(new Event('input', { bubbles: true }));
    });
    await page.locator('#tagger-add-onset').click();
    const clickPoint = await page.locator('[data-onset-hit="dot"][data-onset-index="0"]').first().evaluate((dot) => {
      const svg = dot.ownerSVGElement;
      const rect = svg.getBoundingClientRect();
      const viewBox = svg.viewBox.baseVal;
      const x = parseFloat(dot.getAttribute('cx'));
      const y = parseFloat(dot.getAttribute('cy'));
      return {
        x: rect.left + (x / viewBox.width) * rect.width,
        y: rect.top + (y / viewBox.height) * rect.height,
      };
    });
    await page.mouse.click(clickPoint.x, clickPoint.y);

    await expect(page.locator('.tagger-onset-select')).toHaveText('1. 1000 ms');
    const range = await page.locator('#tagger-range-end').evaluate((endEl) => {
      const startEl = document.getElementById('tagger-range-start');
      return {
        start: parseFloat(startEl.value),
        end: parseFloat(endEl.value),
      };
    });
    expect(range.end - range.start).toBeLessThanOrEqual(0.61);
    expect((range.start + range.end) / 2).toBeCloseTo(1, 1);
  });

  test('playback controls fit on a narrow mobile viewport', async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 740 });
    await page.locator('#tagger-wav-input').setInputFiles(WAV_FIXTURE);
    await expect(page.locator('#tagger-waveform-wrap svg')).toBeVisible({ timeout: 10_000 });

    const overflow = await page.locator('.tagger-playback-panel').evaluate((el) => (
      el.scrollWidth - el.clientWidth
    ));
    expect(overflow).toBeLessThanOrEqual(1);
  });

  test('filename edit is used for ZIP export', async ({ page }) => {
    await page.locator('#tagger-wav-input').setInputFiles(WAV_FIXTURE);
    await expect(page.locator('#tagger-waveform-wrap svg')).toBeVisible({ timeout: 10_000 });
    await page.locator('#tagger-filename-input').fill('custom tagged take');
    await page.locator('#tagger-filename-input').dispatchEvent('input');

    const [download] = await Promise.all([
      page.waitForEvent('download'),
      page.locator('#tagger-export-top').click(),
    ]);

    expect(download.suggestedFilename()).toBe('custom_tagged_take-tagged.zip');
  });

  test('clicking the waveform creates an onset at the clicked position', async ({ page }) => {
    await page.locator('#tagger-wav-input').setInputFiles(WAV_FIXTURE);
    await expect(page.locator('#tagger-waveform-wrap svg')).toBeVisible({ timeout: 10_000 });

    await page.locator('#tagger-waveform-wrap svg').click({ position: { x: 300, y: 60 } });

    await expect(page.locator('.tagger-onset-item')).toHaveCount(1);
    await expect(page.locator('.tagger-onset-item')).toHaveClass(/tagger-onset-item--selected/);
  });

  test('strategy button imports detected onsets without duplicating close markers', async ({ page }) => {
    await page.locator('#tagger-wav-input').setInputFiles(WAV_FIXTURE);
    await expect(page.locator('#tagger-waveform-wrap svg')).toBeVisible({ timeout: 10_000 });

    const strategyButton = page.locator('.tagger-strategy-btn').first();
    await expect(strategyButton).toBeVisible();
    await strategyButton.click();

    await expect(page.locator('#tagger-strategy-status')).toContainText('hinzugefügt', { timeout: 10_000 });
    const firstCount = await page.locator('.tagger-onset-item').count();

    await strategyButton.click();
    await expect(page.locator('#tagger-strategy-status')).toContainText('übersprungen', { timeout: 10_000 });
    await expect(page.locator('.tagger-onset-item')).toHaveCount(firstCount);
  });

});
