import { test, expect } from '@playwright/test';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const WAV_FIXTURE  = path.resolve(__dirname, '../fixtures/chords/E-Moll/emin.wav');
const ZIP_FIXTURE  = path.resolve(__dirname, '../fixtures/sequences/sheet-music-reading/sheet-music-reading_100bpm_tffjv-tagged.zip');

/** Seed a WAV+sidecar recording into gt-audio-analyse-db so the onset tagger
 *  can load it via ?source=sheet-music&id=<id>. */
async function seedSheetMusicTake(page, id) {
  const wavBytes = Array.from(fs.readFileSync(WAV_FIXTURE));
  await page.evaluate(([recId, wavArr]) => {
    const wav = new Uint8Array(wavArr);
    const sidecar = {
      id: recId,
      baseName: recId,
      bpm: 120,
      category: 'random',
      trainingRole: 'random',
      updatedAt: new Date().toISOString(),
      recordedAt: new Date().toISOString(),
    };
    return new Promise((resolve, reject) => {
      const req = indexedDB.open('gt-audio-analyse-db', 1);
      req.onupgradeneeded = (e) => e.target.result.createObjectStore('recordings');
      req.onsuccess = (e) => {
        const db = e.target.result;
        const entry = { id: recId, baseName: recId, wav, sidecar, manifest: sidecar, savedAt: sidecar.recordedAt };
        const tx = db.transaction('recordings', 'readwrite');
        tx.objectStore('recordings').put(entry, recId);
        tx.oncomplete = () => { db.close(); resolve(); };
        tx.onerror   = () => { db.close(); reject(tx.error); };
      };
      req.onerror = () => reject(req.error);
    });
  }, [id, wavBytes]);
}

async function getVisibleRange(page) {
  return page.locator('#tagger-range-end').evaluate((endEl) => {
    const startEl = document.getElementById('tagger-range-start');
    return {
      start: parseFloat(startEl.value),
      end: parseFloat(endEl.value),
    };
  });
}

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

    await expect(page.locator('#tagger-play')).toHaveText('Reset');
    await expect(firstPlayhead).toHaveAttribute('opacity', '1');
    await expect.poll(async () => firstPlayhead.getAttribute('x1')).not.toBe(beforeX);

    await page.locator('#tagger-stop').click();
    await expect(page.locator('#tagger-play')).toHaveText('▶ Play');
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
    const zoomedRange = await getVisibleRange(page);
    const zoomed = zoomedRange.end - zoomedRange.start;
    expect(zoomed).toBeCloseTo(fullRange * 0.6, 2);

    await page.locator('#tagger-zoom-out').click();
    const unzoomedRange = await getVisibleRange(page);
    const unzoomed = unzoomedRange.end - unzoomedRange.start;
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

    const range = await getVisibleRange(page);
    expect(range.end - range.start).toBeLessThanOrEqual(0.49);
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
    const range = await getVisibleRange(page);
    expect(range.end - range.start).toBeLessThanOrEqual(0.49);
    expect((range.start + range.end) / 2).toBeCloseTo(1, 1);
  });

  test('play button resets to the visible range start while playback continues', async ({ page }) => {
    await page.locator('#tagger-wav-input').setInputFiles(WAV_FIXTURE);
    await expect(page.locator('#tagger-waveform-wrap svg')).toBeVisible({ timeout: 10_000 });

    await page.locator('#tagger-cursor').evaluate((el) => {
      el.value = '1000';
      el.dispatchEvent(new Event('input', { bubbles: true }));
    });
    await page.locator('#tagger-add-onset').click();
    await page.locator('.tagger-onset-select').click();
    const range = await getVisibleRange(page);
    expect(range.start).toBeGreaterThan(0);

    await page.locator('#tagger-play').click();
    await expect(page.locator('#tagger-play')).toHaveText('Reset');

    const playhead = page.locator('[data-layer="playhead"]').first();
    await expect.poll(async () => Number(await playhead.getAttribute('x1'))).toBeGreaterThan(500);
    const beforeResetX = Number(await playhead.getAttribute('x1'));

    await page.locator('#tagger-play').click();
    await expect(page.locator('#tagger-play')).toHaveText('Reset');
    await expect.poll(async () => Number(await playhead.getAttribute('x1')))
      .toBeLessThan(beforeResetX - 100);
  });

  test('selecting another onset while playing restarts audio at the new visible range start', async ({ page }) => {
    await page.locator('#tagger-wav-input').setInputFiles(WAV_FIXTURE);
    await expect(page.locator('#tagger-waveform-wrap svg')).toBeVisible({ timeout: 10_000 });

    await page.locator('#tagger-cursor').evaluate((el) => {
      el.value = '1000';
      el.dispatchEvent(new Event('input', { bubbles: true }));
    });
    await page.locator('#tagger-add-onset').click();
    const secondClickPoint = await page.locator('#tagger-waveform-wrap svg').evaluate((svg) => {
      const rect = svg.getBoundingClientRect();
      const viewBox = svg.viewBox.baseVal;
      const targetSec = 1.8;
      const rangeEnd = parseFloat(document.getElementById('tagger-range-end').value);
      const plotLeft = 4;
      const plotWidth = viewBox.width - 8;
      const x = plotLeft + (targetSec / rangeEnd) * plotWidth;
      return {
        x: rect.left + (x / viewBox.width) * rect.width,
        y: rect.top + (70 / viewBox.height) * rect.height,
      };
    });
    await page.mouse.click(secondClickPoint.x, secondClickPoint.y);
    await expect(page.locator('.tagger-onset-item')).toHaveCount(2);

    await page.locator('.tagger-onset-select').first().click();
    await page.locator('#tagger-play').click();
    await expect(page.locator('#tagger-play')).toHaveText('Reset');

    const playhead = page.locator('[data-layer="playhead"]').first();
    await expect.poll(async () => Number(await playhead.getAttribute('x1'))).toBeGreaterThan(500);
    const beforeSelectX = Number(await playhead.getAttribute('x1'));

    await page.locator('.tagger-onset-select').nth(1).click();
    await expect(page.locator('#tagger-play')).toHaveText('Reset');
    await expect.poll(async () => Number(await playhead.getAttribute('x1')))
      .toBeLessThan(beforeSelectX - 100);
    const range = await getVisibleRange(page);
    expect((range.start + range.end) / 2).toBeGreaterThan(1.5);
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

    // Wait for the analysis charts to actually render (status text no longer "läuft")
    await expect(page.locator('#tagger-analysis-status')).not.toContainText('läuft', { timeout: 20_000 });
    await expect(page.locator('#tagger-analysis-charts-wrapper')).not.toHaveClass(/u-hidden/, { timeout: 5_000 });

    // The flyout must not overflow the viewport
    const flyoutOverflow = await page.locator('#tagger-analysis-flyout').evaluate((el) => (
      el.scrollWidth - el.clientWidth
    ));
    expect(flyoutOverflow).toBeLessThanOrEqual(1);

    // The flyout width should not exceed viewport width
    const flyoutWidth = await page.locator('#tagger-analysis-flyout').evaluate((el) => el.getBoundingClientRect().width);
    expect(flyoutWidth).toBeLessThanOrEqual(375 + 1);

    // The page body must not have a horizontal scrollbar (chart content inside fixed flyout
    // must not leak into document flow and make the page wider than the viewport)
    const bodyOverflow = await page.evaluate(() => document.body.scrollWidth - document.documentElement.clientWidth);
    expect(bodyOverflow).toBeLessThanOrEqual(1);
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

  test('ZIP load does not produce Analyse-Fehler (no concurrent ONNX session)', async ({ page }) => {
    await page.locator('#tagger-zip-input').setInputFiles(ZIP_FIXTURE);

    // Wait for analysis to settle (either success or error)
    await expect(page.locator('#tagger-analysis-status')).not.toContainText('läuft', { timeout: 60_000 });

    // Must NOT show an error
    const statusText = await page.locator('#tagger-analysis-status').textContent();
    expect(statusText).not.toMatch(/Analyse-Fehler/i);
    expect(statusText).not.toMatch(/Session already started/i);

    // Analysis charts must be visible (success path)
    await expect(page.locator('#tagger-analysis-charts-wrapper')).toBeVisible();
  });

  // ── URL-params load (recordings page → onset tagger) ──────────────────────
  // This is the real trigger: applyWavBuffer().then(() => applySidecarData())
  // fires both run() calls in the same microtask chain, causing concurrent ONNX.

  test('URL-params load does not produce Analyse-Fehler (Session already started)', async ({ page }) => {
    const testId = 'tdd-test-url-params-load';
    // Seed IDB with a real WAV recording so loadRecordingFromSource can find it
    await seedSheetMusicTake(page, testId);

    // Navigate with ?source=sheet-music&id=<testId> — mirrors "open in onset tagger" button
    await page.goto(`/pages/onset-tagger/index.html?source=sheet-music&id=${testId}`);

    // Waveform must render (WAV decoded successfully)
    await expect(page.locator('#tagger-waveform-wrap svg')).toBeVisible({ timeout: 15_000 });

    // Analysis must complete without error
    await expect(page.locator('#tagger-analysis-status')).not.toContainText('läuft', { timeout: 60_000 });
    const statusText = await page.locator('#tagger-analysis-status').textContent();
    expect(statusText).not.toMatch(/Analyse-Fehler/i);
    expect(statusText).not.toMatch(/Session already started/i);

    // Charts must be visible
    await expect(page.locator('#tagger-analysis-charts-wrapper')).toBeVisible();
  });

  test('analysis flyout stays within viewport on mobile after URL-params analysis', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    const testId = 'tdd-test-flyout-mobile';
    await seedSheetMusicTake(page, testId);
    await page.goto(`/pages/onset-tagger/index.html?source=sheet-music&id=${testId}`);

    // Wait for analysis to finish
    await expect(page.locator('#tagger-analysis-status')).not.toContainText('läuft', { timeout: 60_000 });

    const flyout = page.locator('#tagger-analysis-flyout');

    // Flyout must not overflow horizontally
    const overflow = await flyout.evaluate(el => el.scrollWidth - el.clientWidth);
    expect(overflow).toBeLessThanOrEqual(1);

    // Flyout must be within viewport (position:fixed bottom:0 must hold)
    const rect = await flyout.evaluate(el => {
      const r = el.getBoundingClientRect();
      return { bottom: r.bottom, left: r.left, right: r.right, width: r.width };
    });
    expect(rect.bottom).toBeLessThanOrEqual(667 + 2);
    expect(rect.width).toBeLessThanOrEqual(375 + 1);
    expect(rect.left).toBeGreaterThanOrEqual(-1);

    // Page body must not cause horizontal scroll (fixed flyout must align with page content)
    const bodyOverflow = await page.evaluate(() => document.body.scrollWidth - document.documentElement.clientWidth);
    expect(bodyOverflow).toBeLessThanOrEqual(1);
  });

  // ── Flyout layout regression tests ───────────────────────────────────────
  // These tests document regressions introduced in commits 7502ba1 and b38ff88:
  //   1. overflow-x: hidden on body breaks position:fixed in real browsers
  //      (flyout scrolls with page instead of staying at viewport bottom)
  //   2. overflow-x: hidden on .analysis-flyout itself breaks position:fixed
  //      in real Android Chrome (compositing layer causes fixed elem to scroll)
  //   3. overflow-x: hidden on .analysis-flyout-scroll is not needed
  //      (chart SVGs have width="100%" and are constrained by their containers)
  //   4. flex-wrap: wrap on controls row causes speed buttons to wrap/drift apart

  test('body must not have overflow-x: hidden (would break position:fixed flyout in real browsers)', async ({ page }) => {
    // overflow-x: hidden on body propagates to the viewport in browsers and
    // causes position:fixed elements to be positioned relative to the body
    // scroll container instead of the viewport. This makes the flyout
    // disappear at page load and reappear (wrongly positioned) on scroll.
    const bodyOverflowX = await page.evaluate(() => getComputedStyle(document.body).overflowX);
    expect(bodyOverflowX).not.toBe('hidden');
  });

  test('flyout controls row must not use flex-wrap: wrap (causes speed buttons to drift apart)', async ({ page }) => {
    // flex-wrap: wrap with justify-content: space-between distributes flex items
    // unevenly when they wrap to a second line. On narrow viewports the speed
    // buttons end up far from the toggle button or on a separate line entirely.
    const flexWrap = await page.locator('.tagger-flyout-controls-row').evaluate(
      el => getComputedStyle(el).flexWrap,
    );
    expect(flexWrap).toBe('nowrap');
  });

  test('.analysis-flyout must not have overflow-x: hidden (breaks position:fixed via compositing on Android Chrome)', async ({ page }) => {
    // overflow-x: hidden on a position:fixed element triggers compositing
    // in Android Chrome which causes the element to lose its fixed positioning
    // and scroll with the page instead. The flyout's left:0/right:0 already
    // constrains the width to the viewport – no overflow clipping is needed.
    const flyoutOverflowX = await page.locator('#tagger-analysis-flyout').evaluate(
      el => getComputedStyle(el).overflowX,
    );
    expect(flyoutOverflowX).not.toBe('hidden');
  });

  test('.analysis-flyout-scroll must not have overflow-x: hidden (added unnecessarily – chart SVGs are already width:100%)', async ({ page }) => {
    // overflow-x: hidden was added to the scroll container as a defensive measure
    // but it was not present before the regression commits and is not needed
    // because all chart SVGs carry width="100%" and are constrained by their
    // parent containers.
    const scrollOverflowX = await page.locator('#tagger-analysis-content').evaluate(
      el => getComputedStyle(el).overflowX,
    );
    expect(scrollOverflowX).not.toBe('hidden');
  });

  test('flyout is anchored at viewport bottom after WAV load (position:fixed holds)', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await page.locator('#tagger-wav-input').setInputFiles(WAV_FIXTURE);
    await expect(page.locator('#tagger-waveform-wrap svg')).toBeVisible({ timeout: 10_000 });

    // Wait for analysis to complete so the flyout is in its final state
    await expect(page.locator('#tagger-analysis-status')).not.toContainText('läuft', { timeout: 30_000 });

    // position:fixed; bottom:0 must keep the flyout at the viewport bottom
    // regardless of page scroll height or body overflow settings.
    const flyoutBottom = await page.locator('#tagger-analysis-flyout').evaluate(
      el => el.getBoundingClientRect().bottom,
    );
    expect(flyoutBottom).toBeCloseTo(667, 0); // within 1 px of viewport height
  });

  test('long filename in meta form does not widen page beyond viewport', async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 780 });
    // Load a WAV and inject a very long baseName (like real sheet-music-reading fixture names)
    await page.locator('#tagger-wav-input').setInputFiles(WAV_FIXTURE);
    await expect(page.locator('#tagger-waveform-wrap svg')).toBeVisible({ timeout: 10_000 });

    // Overwrite the baseName display with a long filename as it appears from recordings
    const longName = 'sheet-music-reading_120bpm_android-firefox_abcdefghijklmnopqrstuvwxyz-tagged';
    await page.evaluate((name) => {
      const el = document.querySelector('.tagger-basename-display');
      if (el) el.textContent = name;
    }, longName);

    // The page must not become wider than the viewport
    const pageOverflow = await page.evaluate(
      () => document.documentElement.scrollWidth - window.innerWidth,
    );
    expect(pageOverflow).toBeLessThanOrEqual(1);

    // The baseName display element must not overflow its grid cell
    const cellOverflow = await page.evaluate(() => {
      const el = document.querySelector('.tagger-basename-display');
      return el ? el.scrollWidth - el.clientWidth : 0;
    });
    expect(cellOverflow).toBeLessThanOrEqual(1);
  });

});
