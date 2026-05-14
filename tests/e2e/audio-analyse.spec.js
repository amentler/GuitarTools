import path from 'path';
import { fileURLToPath } from 'url';
import { test, expect } from '@playwright/test';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Baseline-Fixture: in sheetMusicSequenceFingerprint als positive Datei gelistet
const FIXTURE_WAV = path.resolve(
  __dirname,
  '../fixtures/sequences/sheet-music-reading/4-4_40bpm_EGADB_9low6.wav',
);

test.describe('Audio-Analyse Werkzeug', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/pages/audio-analyse/index.html');
  });

  test('Seite lädt und zeigt Upload-Bereich', async ({ page }) => {
    await expect(page.locator('#analyse-dropzone')).toBeVisible();
    await expect(page.locator('#btn-load-last')).toHaveCount(0);
    await expect(page.locator('#analyse-charts-wrapper')).toBeHidden();
  });

  test('WAV-Upload löst Analyse aus und zeigt Stats-Header mit Onsets', async ({ page }) => {
    const fileInput = page.locator('#input-wav-file');
    await fileInput.setInputFiles(FIXTURE_WAV);

    // Stats-Header erscheint nach der Analyse
    const statsHeader = page.locator('#analyse-stats-header');
    await expect(statsHeader).toBeVisible({ timeout: 30_000 });

    const statsText = await statsHeader.innerText();
    // Dateiname im Header
    expect(statsText).toContain('4-4_40bpm_EGADB_9low6.wav');
    // Dauer ist positiv
    expect(statsText).toMatch(/\d+\.\d+ s/);
    // Mindestens 1 Onset erkannt
    const onsetMatch = statsText.match(/(\d+) Onsets/);
    expect(onsetMatch).not.toBeNull();
    const onsetCount = parseInt(onsetMatch[1], 10);
    expect(onsetCount).toBeGreaterThan(0);
  });

  test('WAV-Upload zeigt keinen OfflineAudioContext-suspend-Fehler', async ({ page }) => {
    await page.addInitScript(() => {
      if (window.OfflineAudioContext?.prototype) {
        delete window.OfflineAudioContext.prototype.suspend;
      }
      if (window.webkitOfflineAudioContext?.prototype) {
        delete window.webkitOfflineAudioContext.prototype.suspend;
      }
    });
    await page.goto('/pages/audio-analyse/index.html');

    await page.locator('#input-wav-file').setInputFiles(FIXTURE_WAV);

    const status = page.locator('#analyse-status-msg');
    await expect(status).not.toContainText('offCtx.suspend is not a function');
    await expect(status).not.toContainText('offctx.suspend is not a function');
    await expect(status).not.toContainText('Analyse-Fehler');
  });

  test('Charts-Wrapper wird sichtbar und enthält SVG-Charts', async ({ page }) => {
    await page.locator('#input-wav-file').setInputFiles(FIXTURE_WAV);
    const wrapper = page.locator('#analyse-charts-wrapper');
    await expect(wrapper).toBeVisible({ timeout: 30_000 });

    // Wellenform, RMS, Spektralfluss, Frequenz – alle als Chart-Blöcke vorhanden
    const chartBlocks = wrapper.locator('.analysis-chart-block');
    await expect(chartBlocks.first()).toBeVisible();
    const count = await chartBlocks.count();
    expect(count).toBeGreaterThanOrEqual(7); // mindestens 7 Charts

    // Jeder Block enthält ein SVG
    const svgs = wrapper.locator('svg.analysis-chart-svg');
    const svgCount = await svgs.count();
    expect(svgCount).toBeGreaterThanOrEqual(7);
  });

  test('Chart-Labels enthalten erwartete Titel', async ({ page }) => {
    await page.locator('#input-wav-file').setInputFiles(FIXTURE_WAV);
    await expect(page.locator('#analyse-charts-wrapper')).toBeVisible({ timeout: 30_000 });

    const labels = await page.locator('.analysis-chart-label').allInnerTexts();
    const joined = labels.join(' ').toLowerCase();
    expect(joined).toContain('wellenform');
    expect(joined).toContain('rms');
    expect(joined).toContain('spektralfluss');
    expect(joined).toContain('band-ratio');
    expect(joined).toContain('onset');
    expect(joined).toContain('frequenz');
  });

  test('Spektralfluss-Chart hat sichtbare Linie (nicht konstant 0)', async ({ page }) => {
    await page.locator('#input-wav-file').setInputFiles(FIXTURE_WAV);
    await expect(page.locator('#analyse-charts-wrapper')).toBeVisible({ timeout: 30_000 });

    // Der Spektralfluss-Chart hat ein <polyline>-Element mit mehr als einem Punkt
    const fluxBlock = page.locator('.analysis-chart-block').filter({ hasText: /spektralfluss/i });
    await expect(fluxBlock).toBeVisible();
    const polyline = fluxBlock.locator('polyline');
    await expect(polyline).toBeVisible();

    const points = await polyline.getAttribute('points');
    expect(points).not.toBeNull();
    // Mindestens 2 verschiedene Y-Werte (keine konstante 0-Linie)
    const ys = points.trim().split(' ').map(pt => parseFloat(pt.split(',')[1]));
    const uniqueYs = new Set(ys.map(y => Math.round(y)));
    expect(uniqueYs.size).toBeGreaterThan(1);
  });

  test('Tooltip erscheint beim Hover und enthält alle relevanten Werte', async ({ page }) => {
    await page.locator('#input-wav-file').setInputFiles(FIXTURE_WAV);
    const wrapper = page.locator('#analyse-charts-wrapper');
    await expect(wrapper).toBeVisible({ timeout: 30_000 });

    // Hover über die Mitte des ersten Charts
    const firstSvg = wrapper.locator('svg.analysis-chart-svg').first();
    const box = await firstSvg.boundingBox();
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);

    const tooltip = page.locator('.analysis-tooltip');
    await expect(tooltip).toBeVisible({ timeout: 5_000 });

    const tooltipText = await tooltip.innerText();
    // Zeit-Wert
    expect(tooltipText).toMatch(/\d+\.\d+s/);
    // RMS
    expect(tooltipText).toContain('RMS:');
    // Spektralfluss
    expect(tooltipText).toContain('Flux:');
    // Band-Ratio
    expect(tooltipText).toContain('BandR:');
    // Aktive Bänder
    expect(tooltipText).toContain('ActiveB:');
    // Onset-Konfidenz
    expect(tooltipText).toContain('Conf:');
    // Frequenz
    expect(tooltipText).toContain('Freq:');
    // Note
    expect(tooltipText).toContain('Note:');
  });

  test('Tooltip bleibt nach Pointerleave offen und schließt per Klick', async ({ page }) => {
    await page.locator('#input-wav-file').setInputFiles(FIXTURE_WAV);
    const wrapper = page.locator('#analyse-charts-wrapper');
    await expect(wrapper).toBeVisible({ timeout: 30_000 });

    const firstSvg = wrapper.locator('svg.analysis-chart-svg').first();
    const box = await firstSvg.boundingBox();

    // Tooltip öffnen
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    const tooltip = page.locator('.analysis-tooltip');
    await expect(tooltip).toBeVisible({ timeout: 5_000 });

    // Maus aus dem Wrapper bewegen
    await page.mouse.move(0, 0);
    // Tooltip soll noch sichtbar sein
    await expect(tooltip).toBeVisible();

    // Klick auf Tooltip schließt ihn
    await tooltip.click();
    await expect(tooltip).toBeHidden();
  });
});
