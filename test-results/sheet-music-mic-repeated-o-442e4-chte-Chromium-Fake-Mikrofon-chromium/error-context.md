# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: sheet-music-mic-repeated-open-strings.spec.js >> Noten spielen akzeptiert viermal E, A, D und G ueber das echte Chromium-Fake-Mikrofon
- Location: tests/e2e/sheet-music-mic-repeated-open-strings.spec.js:22:1

# Error details

```
Error: expect(locator).toHaveText(expected) failed

Locator:  locator('#score-value')
Expected: "4 / 16"
Received: "1 / 16"
Timeout:  10000ms

Call log:
  - Expect "toHaveText" with timeout 10000ms
  - waiting for locator('#score-value')
    5 × locator resolved to <span id="score-value">0 / 16</span>
      - unexpected value "0 / 16"
    9 × locator resolved to <span id="score-value">1 / 16</span>
      - unexpected value "1 / 16"

```

# Page snapshot

```yaml
- generic [ref=e2]:
  - generic "Noten spielen" [ref=e3]:
    - generic [ref=e4]:
      - link "← Zurück zum Menü" [ref=e5] [cursor=pointer]:
        - /url: ../../index.html
      - heading "Noten spielen" [level=2] [ref=e6]
      - generic [ref=e7]: 1 / 16
  - img [ref=e10]
  - generic [ref=e85]:
    - generic [ref=e86]: "Aktuell:"
    - generic [ref=e87]: E2
  - generic [ref=e88]:
    - button "⏹ Stopp" [ref=e89] [cursor=pointer]
    - button "Neue Noten" [ref=e90] [cursor=pointer]
  - generic [ref=e91]:
    - generic [ref=e92]:
      - generic [ref=e93]: "Modus:"
      - combobox [ref=e94] [cursor=pointer]:
        - option "Einfach" [selected]
        - option "Schwer"
    - generic [ref=e95]:
      - generic [ref=e96]: "Bünde: 0 – 3"
      - 'slider "Bünde: 0 – 3" [ref=e97] [cursor=pointer]': "3"
    - generic [ref=e98]:
      - generic [ref=e99]: "Saiten:"
      - generic [ref=e100]:
        - button "E2" [ref=e101] [cursor=pointer]
        - button "A2" [ref=e102] [cursor=pointer]
        - button "D3" [ref=e103] [cursor=pointer]
        - button "G3" [ref=e104] [cursor=pointer]
        - button "B3" [ref=e105] [cursor=pointer]
        - button "E4" [ref=e106] [cursor=pointer]
```

# Test source

```ts
  1  | import path from 'path';
  2  | import { fileURLToPath } from 'url';
  3  | import { test, expect } from '@playwright/test';
  4  | 
  5  | const __dirname = path.dirname(fileURLToPath(import.meta.url));
  6  | const repeatedOpenStringsAudioPath = path.resolve(__dirname, '../fixtures/sequences/open-strings/eeeeaaaaddddgggg.wav');
  7  | 
  8  | function note(name, octave, vfKey, string) {
  9  |   return { name, octave, vfKey, string, fret: 0 };
  10 | }
  11 | 
  12 | test.use({
  13 |   launchOptions: {
  14 |     args: [
  15 |       '--use-fake-ui-for-media-stream',
  16 |       '--use-fake-device-for-media-stream',
  17 |       `--use-file-for-fake-audio-capture=${repeatedOpenStringsAudioPath}`,
  18 |     ],
  19 |   },
  20 | });
  21 | 
  22 | test('Noten spielen akzeptiert viermal E, A, D und G ueber das echte Chromium-Fake-Mikrofon', async ({ page }) => {
  23 |   const bars = [[
  24 |     note('E', 2, 'e/3', 6),
  25 |     note('E', 2, 'e/3', 6),
  26 |     note('E', 2, 'e/3', 6),
  27 |     note('E', 2, 'e/3', 6),
  28 |   ], [
  29 |     note('A', 2, 'a/3', 5),
  30 |     note('A', 2, 'a/3', 5),
  31 |     note('A', 2, 'a/3', 5),
  32 |     note('A', 2, 'a/3', 5),
  33 |   ], [
  34 |     note('D', 3, 'd/4', 4),
  35 |     note('D', 3, 'd/4', 4),
  36 |     note('D', 3, 'd/4', 4),
  37 |     note('D', 3, 'd/4', 4),
  38 |   ], [
  39 |     note('G', 3, 'g/4', 3),
  40 |     note('G', 3, 'g/4', 3),
  41 |     note('G', 3, 'g/4', 3),
  42 |     note('G', 3, 'g/4', 3),
  43 |   ]];
  44 | 
  45 |   await page.addInitScript(injectedBars => {
  46 |     window.__GT_SHEET_MUSIC_MIC_BARS__ = injectedBars;
  47 |   }, bars);
  48 | 
  49 |   await page.goto('/pages/sheet-music-mic/index.html');
  50 | 
  51 |   await expect(page.locator('#sheet-mic-score-container svg')).toBeVisible();
  52 |   await expect(page.locator('#score-value')).toHaveText('0 / 16');
  53 |   await expect(page.locator('#sheet-mic-current-note')).toHaveText('E2');
  54 | 
  55 |   await page.click('#sheet-mic-start-btn');
  56 | 
> 57 |   await expect(page.locator('#score-value')).toHaveText('4 / 16', { timeout: 10_000 });
     |                                              ^ Error: expect(locator).toHaveText(expected) failed
  58 |   await expect(page.locator('#sheet-mic-current-note')).toHaveText('A2', { timeout: 10_000 });
  59 | 
  60 |   await expect(page.locator('#score-value')).toHaveText('8 / 16', { timeout: 10_000 });
  61 |   await expect(page.locator('#sheet-mic-current-note')).toHaveText('D3', { timeout: 10_000 });
  62 | 
  63 |   await expect(page.locator('#score-value')).toHaveText('12 / 16', { timeout: 10_000 });
  64 |   await expect(page.locator('#sheet-mic-current-note')).toHaveText('G3', { timeout: 10_000 });
  65 | 
  66 |   await expect(page.locator('#score-value')).toHaveText('16 / 16', { timeout: 10_000 });
  67 |   await expect(page.locator('#sheet-mic-current-note')).toHaveText('✓', { timeout: 10_000 });
  68 |   await expect(page.locator('#sheet-mic-feedback')).toContainText('Alle Noten gespielt!', { timeout: 10_000 });
  69 | 
  70 |   const greenNotes = page.locator('#sheet-mic-score-container svg [fill="#2ecc71"], #sheet-mic-score-container svg [stroke="#2ecc71"]');
  71 |   await expect(greenNotes).toHaveCount(16);
  72 | });
  73 | 
```