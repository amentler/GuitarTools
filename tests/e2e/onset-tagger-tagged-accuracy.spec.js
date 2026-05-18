import { test, expect } from '@playwright/test';
import path from 'path';
import { fileURLToPath } from 'url';
import { readFileSync } from 'fs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const MEDIUM_WAV = path.resolve(__dirname, '../fixtures/sequences/sheet-music-reading/medium.wav');
const MEDIUM_JSON = path.resolve(__dirname, '../fixtures/sequences/sheet-music-reading/medium.json');

// Tags liegen knapp am Onset-Anfang. Für das Spiel gilt:
//   zu früh feuern → falscher Ton wird erkannt  (streng: nur 1 Fenster früh erlaubt)
//   leicht zu spät → kein Problem               (locker: 3 Fenster nach dem Tag erlaubt)
const WINDOW_MS = 30;
const EARLY_WINDOWS = 1; // bis 30 ms vor dem Tag
const LATE_WINDOWS = 3;  // bis 90 ms nach dem Tag

function taggedMs() {
  return JSON.parse(readFileSync(MEDIUM_JSON, 'utf-8')).onsetsMs;
}

function hitsWithinWindow(tagged, detected) {
  return tagged.filter(tag =>
    detected.some(det => det >= tag - EARLY_WINDOWS * WINDOW_MS && det <= tag + LATE_WINDOWS * WINDOW_MS),
  );
}

test.describe('Onset-Tagger – getaggte Onset-Genauigkeit', () => {
  test('XGBoost erkennt alle getaggten Onsets in medium.wav im [-30ms, +90ms]-Fenster', async ({ page }) => {
    await page.goto('/pages/onset-tagger/index.html');

    // Nur WAV laden – ohne JSON, damit die Liste leer startet
    await page.locator('#tagger-wav-input').setInputFiles(MEDIUM_WAV);
    await expect(page.locator('#tagger-waveform-wrap svg')).toBeVisible({ timeout: 15_000 });

    // XGBoost-Strategie-Button klicken
    const stratBtn = page.locator('[data-strategy-key="xgboost-android-firefox"]');
    await expect(stratBtn).toBeVisible();
    await stratBtn.click();

    // Auf Abschluss warten (überlappende Fenster → etwas mehr Zeit)
    await expect(page.locator('#tagger-strategy-status')).toContainText('hinzugefügt', { timeout: 60_000 });

    // Erkannte Timestamps aus der UI lesen  (Format: "1. 586 ms")
    const texts = await page.locator('.tagger-onset-select').allInnerTexts();
    const detectedMs = texts
      .map(t => { const m = t.match(/(\d+)\s*ms/); return m ? parseInt(m[1], 10) : null; })
      .filter(v => v !== null);

    const tagged = taggedMs();
    const hits = hitsWithinWindow(tagged, detectedMs);

    expect(
      hits.length,
      `Nur ${hits.length}/${tagged.length} getaggte Onsets im [-${EARLY_WINDOWS * WINDOW_MS}ms, +${LATE_WINDOWS * WINDOW_MS}ms]-Fenster erkannt.\n` +
      `Erkannt (${detectedMs.length}): ${detectedMs.join(', ')}\n` +
      `Tags   (${tagged.length}): ${tagged.join(', ')}`,
    ).toBe(tagged.length);
  });
});
