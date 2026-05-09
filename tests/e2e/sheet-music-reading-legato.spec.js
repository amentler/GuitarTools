import path from 'path';
import { fileURLToPath } from 'url';
import { test, expect } from '@playwright/test';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const FAST_WAV = path.resolve(
  __dirname, '../fixtures/sequences/open-strings/aeaedgdgbebeabab.wav',
);

// Sequence: A2–E2–A2–E2 | D3–G3–D3–G3 | B3–E4–B3–E4 | A2–B3–A2–B3
// All open strings, played legato (new string struck while previous still rings).
function note(name, octave, vfKey, string) {
  return { name, octave, vfKey, string, fret: 0 };
}

const BARS = [
  [note('A', 2, 'a/3', 5), note('E', 2, 'e/3', 6), note('A', 2, 'a/3', 5), note('E', 2, 'e/3', 6)],
  [note('D', 3, 'd/4', 4), note('G', 3, 'g/4', 3), note('D', 3, 'd/4', 4), note('G', 3, 'g/4', 3)],
  [note('B', 3, 'b/4', 2), note('E', 4, 'e/5', 1), note('B', 3, 'b/4', 2), note('E', 4, 'e/5', 1)],
  [note('A', 2, 'a/3', 5), note('B', 3, 'b/4', 2), note('A', 2, 'a/3', 5), note('B', 3, 'b/4', 2)],
];

async function setup(page) {
  await page.addInitScript(injectedBars => {
    localStorage.setItem('sheetMusic_active', 'true');
    window.__GT_SHEET_MUSIC_READING_BARS__ = injectedBars;
  }, BARS);
  await page.goto('/pages/sheet-music-reading/index.html');
  await expect(page.locator('#score-container svg').first()).toBeVisible();
  await expect(page.locator('#sheet-music-current-note')).toHaveText('A2');
}

test.use({
  launchOptions: {
    args: [
      '--use-fake-ui-for-media-stream',
      '--use-fake-device-for-media-stream',
      `--use-file-for-fake-audio-capture=${FAST_WAV}`,
    ],
  },
});

test('Aktivmodus erkennt die erste Legato-Bar und erreicht D3 (fast)', async ({ page }) => {
  await setup(page);

  // Bar 1 (A2–E2–A2–E2) abgeschlossen → Bar 2 startet mit D3
  await expect(page.locator('#sheet-music-current-note')).toHaveText('D3', { timeout: 12_000 });
});
