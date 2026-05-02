# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: fretboard-tone-recognition.spec.js >> Fretboard Tone Recognition Exercise >> keeps the first fret visible in open-string-only mode without rendering fret markers on the board
- Location: tests/e2e/fretboard-tone-recognition.spec.js:58:3

# Error details

```
Error: expect(locator).toHaveCount(expected) failed

Locator:  locator('gt-fretboard text').filter({ hasText: '1' })
Expected: 1
Received: 0
Timeout:  30000ms

Call log:
  - Expect "toHaveCount" with timeout 30000ms
  - waiting for locator('gt-fretboard text').filter({ hasText: '1' })
    33 × locator resolved to 0 elements
       - unexpected value "0"

```

# Page snapshot

```yaml
- generic [ref=e2]:
  - generic "Töne erkennen" [ref=e3]:
    - generic [ref=e4]:
      - link "← Zurück zum Menü" [ref=e5] [cursor=pointer]:
        - /url: ../../index.html
      - heading "Töne erkennen" [level=2] [ref=e6]
      - generic [ref=e7]: "Richtig: 0 von 0"
  - img [ref=e9]:
    - generic [ref=e10]: e
    - generic [ref=e11]: B
    - generic [ref=e12]: G
    - generic [ref=e13]: D
    - generic [ref=e14]: A
    - generic [ref=e15]: E
  - paragraph [ref=e22]: Welcher Ton ist markiert?
  - generic [ref=e23]:
    - button "C" [ref=e24] [cursor=pointer]
    - button "C#" [ref=e25] [cursor=pointer]
    - button "D" [ref=e26] [cursor=pointer]
    - button "D#" [ref=e27] [cursor=pointer]
    - button "E" [ref=e28] [cursor=pointer]
    - button "F" [ref=e29] [cursor=pointer]
    - button "F#" [ref=e30] [cursor=pointer]
    - button "G" [ref=e31] [cursor=pointer]
    - button "G#" [ref=e32] [cursor=pointer]
    - button "A" [ref=e33] [cursor=pointer]
    - button "A#" [ref=e34] [cursor=pointer]
    - button "B" [ref=e35] [cursor=pointer]
  - generic [ref=e36]:
    - generic [ref=e37]: ●
    - generic [ref=e38]: ●
    - generic [ref=e39]: ●
  - paragraph
  - generic [ref=e40]:
    - generic [ref=e41]:
      - generic [ref=e42]: "Bünde: Nur Leer"
      - 'slider "Bünde: Nur Leer" [active] [ref=e43] [cursor=pointer]': "0"
    - generic [ref=e44]:
      - generic [ref=e45]: "Saiten:"
      - generic [ref=e46]:
        - button "E2" [ref=e47] [cursor=pointer]
        - button "A2" [ref=e48] [cursor=pointer]
        - button "D3" [ref=e49] [cursor=pointer]
        - button "G3" [ref=e50] [cursor=pointer]
        - button "B3" [ref=e51] [cursor=pointer]
        - button "E4" [ref=e52] [cursor=pointer]
    - generic [ref=e53]:
      - generic [ref=e54]: "Zufällige Töne:"
      - checkbox "Zufällige Töne:" [ref=e55] [cursor=pointer]
```

# Test source

```ts
  1  | import { test, expect } from '@playwright/test';
  2  | 
  3  | function mockRandomSequence(page, values) {
  4  |   return page.addInitScript(sequence => {
  5  |     const queue = [...sequence];
  6  |     window.__GT_RANDOM__ = () => {
  7  |       if (queue.length === 0) {
  8  |         throw new Error('Random mock exhausted.');
  9  |       }
  10 |       return queue.shift();
  11 |     };
  12 |   }, values);
  13 | }
  14 | 
  15 | test.describe('Fretboard Tone Recognition Exercise', () => {
  16 |   test('shows an open-string target marker left of the fretboard when the mocked draw picks fret 0', async ({ page }) => {
  17 |     await mockRandomSequence(page, [0.01, 0.01]);
  18 |     await page.goto('/pages/fretboard-tone-recognition/index.html');
  19 | 
  20 |     const fretboard = page.locator('gt-fretboard');
  21 |     await expect(fretboard).toBeVisible();
  22 | 
  23 |     const openTarget = page.locator('gt-fretboard circle[fill="none"][stroke="#ff6b35"]');
  24 |     await expect(openTarget).toHaveCount(1);
  25 | 
  26 |     const filledTargets = page.locator('gt-fretboard circle[fill="#ff6b35"]');
  27 |     await expect(filledTargets).toHaveCount(0);
  28 | 
  29 |     const openPlaceholder = page.locator('gt-fretboard circle[data-string="0"][data-fret="0"]');
  30 |     const markerCx = await openTarget.getAttribute('cx');
  31 |     const markerCy = await openTarget.getAttribute('cy');
  32 | 
  33 |     await expect(openPlaceholder).toHaveAttribute('cx', markerCx);
  34 |     await expect(openPlaceholder).toHaveAttribute('cy', markerCy);
  35 |   });
  36 | 
  37 |   test('shows a filled fret marker on the fretboard when the mocked draw picks a fretted note', async ({ page }) => {
  38 |     await mockRandomSequence(page, [0.34, 0.65]);
  39 |     await page.goto('/pages/fretboard-tone-recognition/index.html');
  40 | 
  41 |     const fretboard = page.locator('gt-fretboard');
  42 |     await expect(fretboard).toBeVisible();
  43 | 
  44 |     const fretTarget = page.locator('gt-fretboard circle[fill="#ff6b35"]');
  45 |     await expect(fretTarget).toHaveCount(1);
  46 | 
  47 |     const openTargets = page.locator('gt-fretboard circle[fill="none"][stroke="#ff6b35"]');
  48 |     await expect(openTargets).toHaveCount(0);
  49 | 
  50 |     const fretPlaceholder = page.locator('gt-fretboard circle[data-string="2"][data-fret="3"]');
  51 |     const markerCx = await fretTarget.getAttribute('cx');
  52 |     const markerCy = await fretTarget.getAttribute('cy');
  53 | 
  54 |     await expect(fretPlaceholder).toHaveAttribute('cx', markerCx);
  55 |     await expect(fretPlaceholder).toHaveAttribute('cy', markerCy);
  56 |   });
  57 | 
  58 |   test('keeps the first fret visible in open-string-only mode without rendering fret markers on the board', async ({ page }) => {
  59 |     await mockRandomSequence(page, [0.01, 0.01]);
  60 |     await page.goto('/pages/fretboard-tone-recognition/index.html');
  61 | 
  62 |     await page.locator('#fret-range-slider').fill('0');
  63 | 
  64 |     const fretboard = page.locator('gt-fretboard');
  65 |     await expect(fretboard).toHaveAttribute('frets', '0');
  66 | 
  67 |     const fretNumber = page.locator('gt-fretboard text').filter({ hasText: '1' });
> 68 |     await expect(fretNumber).toHaveCount(1);
     |                              ^ Error: expect(locator).toHaveCount(expected) failed
  69 | 
  70 |     const openTarget = page.locator('gt-fretboard circle[fill="none"][stroke="#ff6b35"]');
  71 |     await expect(openTarget).toHaveCount(1);
  72 | 
  73 |     const filledTargets = page.locator('gt-fretboard circle[fill="#ff6b35"]');
  74 |     await expect(filledTargets).toHaveCount(0);
  75 | 
  76 |     const fret1Placeholder = page.locator('gt-fretboard circle[data-string="0"][data-fret="1"]');
  77 |     await expect(fret1Placeholder).toHaveCount(0);
  78 |   });
  79 | });
  80 | 
```