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

  test('analysis flyout renders analyzer charts after WAV load', async ({ page }) => {
    await page.locator('#tagger-wav-input').setInputFiles(WAV_FIXTURE);

    await expect(page.locator('#tagger-analysis-flyout')).toBeVisible();
    await expect(page.locator('#tagger-analysis-status')).toContainText(/Frames|Analyse läuft/, { timeout: 30_000 });
    await expect(page.locator('#tagger-analysis-charts-wrapper')).toBeVisible({ timeout: 30_000 });
    await expect(page.locator('#tagger-analysis-charts-wrapper svg.analysis-chart-svg').first()).toBeVisible();
  });

  test('analysis flyout contains only analyzer display options', async ({ page }) => {
    const flyout = page.locator('#tagger-analysis-flyout');
    await expect(flyout.locator('input[type="checkbox"]')).toHaveCount(3);
    await expect(flyout.locator('input[type="range"]')).toHaveCount(0);
    await expect(flyout.locator('select')).toHaveCount(0);
    await expect(flyout.locator('#tagger-play, #tagger-stop, #btn-play-pause, #btn-stop-audio')).toHaveCount(0);
  });

  test('analysis flyout scrolls internally', async ({ page }) => {
    const scrollState = await page.locator('#tagger-analysis-content').evaluate((el) => {
      const computed = window.getComputedStyle(el);
      return {
        overflowY: computed.overflowY,
        maxHeight: computed.maxHeight,
      };
    });
    expect(scrollState.overflowY).toBe('auto');
    expect(scrollState.maxHeight).not.toBe('none');
  });

  test('analysis flyout charts are tall and follow waveform zoom', async ({ page }) => {
    await page.locator('#tagger-wav-input').setInputFiles(WAV_FIXTURE);
    const wrapper = page.locator('#tagger-analysis-charts-wrapper');
    await expect(wrapper).toBeVisible({ timeout: 30_000 });

    const firstChartWrap = wrapper.locator('.analysis-chart-svg-wrap').first();
    const height = await firstChartWrap.evaluate(el => el.getBoundingClientRect().height);
    expect(height).toBeGreaterThan(180);

    const firstSvg = wrapper.locator('svg.analysis-chart-svg').first();
    const beforeText = await firstSvg.evaluate(el => el.textContent);
    await page.locator('#tagger-zoom-in').click();
    const afterText = await firstSvg.evaluate(el => el.textContent);
    expect(afterText).not.toEqual(beforeText);
  });

  test('current onset marker appears in all analyzer charts and follows cursor', async ({ page }) => {
    await page.locator('#tagger-wav-input').setInputFiles(WAV_FIXTURE);
    const wrapper = page.locator('#tagger-analysis-charts-wrapper');
    await expect(wrapper).toBeVisible({ timeout: 30_000 });

    const chartCount = await wrapper.locator('svg.analysis-chart-svg').count();
    const markerCount = await wrapper.locator('.analysis-marker-current').count();
    expect(markerCount).toBe(chartCount);

    const firstMarker = wrapper.locator('.analysis-marker-current').first();
    const beforeX = await firstMarker.getAttribute('x1');
    await page.locator('#tagger-cursor').evaluate((el) => {
      el.value = '100';
      el.dispatchEvent(new Event('input', { bubbles: true }));
    });
    await expect(page.locator('#tagger-cursor-display')).toHaveText('0.100 s');
    const afterX = await wrapper.locator('.analysis-marker-current').first().getAttribute('x1');
    expect(afterX).not.toEqual(beforeX);
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
