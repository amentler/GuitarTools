import { test, expect } from '@playwright/test';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const WAV_FIXTURE  = path.resolve(__dirname, '../fixtures/chords/E-Moll/emin.wav');
const JSON_FIXTURE = path.resolve(__dirname, '../fixtures/sequences/open-strings/fast.json');

test.describe('Onset Tagger', () => {

  test.beforeEach(async ({ page }) => {
    await page.goto('/pages/onset-tagger/index.html');
  });

  test('page loads with file-load buttons and step sections', async ({ page }) => {
    await expect(page.locator('#tagger-wav-btn')).toBeVisible();
    await expect(page.locator('#tagger-json-btn')).toBeVisible();
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

  test('loading both files enables step 2', async ({ page }) => {
    await page.locator('#tagger-wav-input').setInputFiles(WAV_FIXTURE);
    await expect(page.locator('#tagger-waveform-wrap svg')).toBeVisible({ timeout: 10_000 });

    await page.locator('#tagger-json-input').setInputFiles(JSON_FIXTURE);

    await expect(page.locator('#tagger-step2')).not.toHaveClass(/tagger-section--disabled/, { timeout: 5_000 });
  });

  test('loading JSON file renders metadata form fields', async ({ page }) => {
    await page.locator('#tagger-wav-input').setInputFiles(WAV_FIXTURE);
    await expect(page.locator('#tagger-waveform-wrap svg')).toBeVisible({ timeout: 10_000 });

    await page.locator('#tagger-json-input').setInputFiles(JSON_FIXTURE);

    // fast.json has "notes", "tempoBpm", "notesPerBeat", "description"
    await expect(page.locator('[name="tempoBpm"]')).toBeVisible({ timeout: 5_000 });
    await expect(page.locator('[name="description"]')).toBeVisible();
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

    await expect(page.locator('.tagger-onset-select')).toContainText('100 ms');
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

  test('metadata field change persists until export', async ({ page }) => {
    await page.locator('#tagger-wav-input').setInputFiles(WAV_FIXTURE);
    await expect(page.locator('#tagger-waveform-wrap svg')).toBeVisible({ timeout: 10_000 });
    await page.locator('#tagger-json-input').setInputFiles(JSON_FIXTURE);
    await expect(page.locator('[name="tempoBpm"]')).toBeVisible({ timeout: 5_000 });

    const tempoInput = page.locator('[name="tempoBpm"]');
    await tempoInput.selectOption('150');
    await expect(tempoInput).toHaveValue('150');
  });

  test('export button triggers a ZIP download', async ({ page }) => {
    await page.locator('#tagger-wav-input').setInputFiles(WAV_FIXTURE);
    await expect(page.locator('#tagger-waveform-wrap svg')).toBeVisible({ timeout: 10_000 });
    await page.locator('#tagger-json-input').setInputFiles(JSON_FIXTURE);
    await expect(page.locator('#tagger-step2')).not.toHaveClass(/tagger-section--disabled/, { timeout: 5_000 });

    const [download] = await Promise.all([
      page.waitForEvent('download'),
      page.locator('#tagger-export').click(),
    ]);

    expect(download.suggestedFilename()).toMatch(/\.zip$/);
  });
});
