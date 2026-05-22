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
    // filename input was removed – auto-generated name shown as read-only
    await expect(page.locator('#tagger-filename-input')).toHaveCount(0);
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

  test('analysis flyout contains analyzer display options and playback controls', async ({ page }) => {
    const flyout = page.locator('#tagger-analysis-flyout');
    await expect(flyout.locator('input[type="checkbox"]')).toHaveCount(3);
    await expect(flyout.locator('input[type="range"]')).toHaveCount(0);
    await expect(flyout.locator('select')).toHaveCount(1); // onset model selector
    await expect(flyout.locator('#tagger-play, #tagger-stop')).toHaveCount(2);
    await expect(flyout.locator('[data-speed]')).toHaveCount(4);
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

  test('playback marker appears in all analyzer charts and follows playback', async ({ page }) => {
    await page.locator('#tagger-wav-input').setInputFiles(WAV_FIXTURE);
    const wrapper = page.locator('#tagger-analysis-charts-wrapper');
    await expect(wrapper).toBeVisible({ timeout: 30_000 });

    const chartCount = await wrapper.locator('svg.analysis-chart-svg').count();
    await expect(wrapper.locator('.analysis-playhead')).toHaveCount(chartCount);

    const firstPlayhead = wrapper.locator('.analysis-playhead').first();
    const beforeX = await firstPlayhead.getAttribute('x1');
    await page.locator('#tagger-play').click();

    await expect(firstPlayhead).toHaveAttribute('opacity', '1');
    await expect.poll(async () => firstPlayhead.getAttribute('x1')).not.toBe(beforeX);

    await page.locator('#tagger-stop').click();
    await expect(firstPlayhead).toHaveAttribute('opacity', '0');
  });

  test('speed buttons update active playback rate selection', async ({ page }) => {
    await expect(page.locator('[data-speed="1"]')).toHaveClass(/tagger-speed--active/);

    await page.locator('[data-speed="0.5"]').click();

    await expect(page.locator('[data-speed="1"]')).not.toHaveClass(/tagger-speed--active/);
    await expect(page.locator('[data-speed="0.5"]')).toHaveClass(/tagger-speed--active/);
  });

  test('add onset button adds entry to onset list', async ({ page }) => {
    await page.locator('#tagger-wav-input').setInputFiles(WAV_FIXTURE);
    await expect(page.locator('#tagger-waveform-wrap svg')).toBeVisible({ timeout: 10_000 });

    // The onset cursor slider defaults to 0 ms; click add
    await page.locator('#tagger-add-onset').click();

    const items = page.locator('.tagger-onset-item');
    await expect(items).toHaveCount(1);
  });

  test('top remove onset button is disabled until an onset is selected', async ({ page }) => {
    await page.locator('#tagger-wav-input').setInputFiles(WAV_FIXTURE);
    await expect(page.locator('#tagger-waveform-wrap svg')).toBeVisible({ timeout: 10_000 });

    const removeButton = page.locator('#tagger-remove-onset');
    await expect(removeButton).toBeDisabled();

    await page.locator('#tagger-add-onset').click();
    await expect(removeButton).toBeEnabled();
  });

  test('top remove onset button removes selected onset from list', async ({ page }) => {
    await page.locator('#tagger-wav-input').setInputFiles(WAV_FIXTURE);
    await expect(page.locator('#tagger-waveform-wrap svg')).toBeVisible({ timeout: 10_000 });

    await page.locator('#tagger-add-onset').click();
    await expect(page.locator('.tagger-onset-item')).toHaveCount(1);

    await page.locator('#tagger-remove-onset').click();
    await expect(page.locator('.tagger-onset-item')).toHaveCount(0);
    await expect(page.locator('#tagger-remove-onset')).toBeDisabled();
  });

  test('onset list shows only the index without milliseconds', async ({ page }) => {
    await page.locator('#tagger-wav-input').setInputFiles(WAV_FIXTURE);
    await expect(page.locator('#tagger-waveform-wrap svg')).toBeVisible({ timeout: 10_000 });

    await page.locator('#tagger-add-onset').click();
    await expect(page.locator('.tagger-onset-item')).toHaveCount(1);
    await expect(page.locator('.tagger-onset-select')).toHaveText('1');
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

    await expect(page.locator('.tagger-onset-select')).toHaveText('1');
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

    await expect(page.locator('.tagger-onset-select')).toHaveText('1');
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

  test('onset action controls fit on a narrow mobile viewport', async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 740 });
    await page.locator('#tagger-wav-input').setInputFiles(WAV_FIXTURE);
    await expect(page.locator('#tagger-waveform-wrap svg')).toBeVisible({ timeout: 10_000 });

    const overflow = await page.locator('.tagger-onset-actions').evaluate((el) => (
      el.scrollWidth - el.clientWidth
    ));
    expect(overflow).toBeLessThanOrEqual(1);
  });

  test('analysis flyout does not overflow horizontally on mobile viewport', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await page.locator('#tagger-wav-input').setInputFiles(WAV_FIXTURE);
    await expect(page.locator('#tagger-waveform-wrap svg')).toBeVisible({ timeout: 10_000 });

    const flyoutOverflow = await page.locator('#tagger-analysis-flyout').evaluate((el) => (
      el.scrollWidth - el.clientWidth
    ));
    expect(flyoutOverflow).toBeLessThanOrEqual(1);

    // The flyout width should not exceed viewport width
    const flyoutWidth = await page.locator('#tagger-analysis-flyout').evaluate((el) => el.getBoundingClientRect().width);
    expect(flyoutWidth).toBeLessThanOrEqual(375 + 1);
  });

  test('ZIP export uses auto-generated baseName as filename', async ({ page }) => {
    await page.locator('#tagger-wav-input').setInputFiles(WAV_FIXTURE);
    await expect(page.locator('#tagger-waveform-wrap svg')).toBeVisible({ timeout: 10_000 });

    const [download] = await Promise.all([
      page.waitForEvent('download'),
      page.locator('#tagger-export-top').click(),
    ]);

    // Auto-generated name follows: [role_]category_bpmBPM_suffix-tagged.zip
    expect(download.suggestedFilename()).toMatch(/^.+-tagged\.zip$/);
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
