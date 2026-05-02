# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: fretboard-tone-recognition.spec.js >> Fretboard Tone Recognition Exercise >> shows a filled fret marker on the fretboard when the mocked draw picks a fretted note
- Location: tests/e2e/fretboard-tone-recognition.spec.js:37:3

# Error details

```
Error: expect(locator).toHaveAttribute(expected) failed

Locator:  locator('gt-fretboard circle[data-string="2"][data-fret="3"]')
Expected: "123"
Received: "362"
Timeout:  30000ms

Call log:
  - Expect "toHaveAttribute" with timeout 30000ms
  - waiting for locator('gt-fretboard circle[data-string="2"][data-fret="3"]')
    33 × locator resolved to <circle r="14" cx="362" cy="142" stroke="none" data-fret="3" data-string="2" fill="transparent" pointer-events="none"></circle>
       - unexpected value "362"

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
    - generic [ref=e16]: "1"
    - generic [ref=e17]: "2"
    - generic [ref=e18]: "3"
    - generic [ref=e19]: "4"
  - paragraph [ref=e50]: Welcher Ton ist markiert?
  - generic [ref=e51]:
    - button "C" [ref=e52] [cursor=pointer]
    - button "C#" [ref=e53] [cursor=pointer]
    - button "D" [ref=e54] [cursor=pointer]
    - button "D#" [ref=e55] [cursor=pointer]
    - button "E" [ref=e56] [cursor=pointer]
    - button "F" [ref=e57] [cursor=pointer]
    - button "F#" [ref=e58] [cursor=pointer]
    - button "G" [ref=e59] [cursor=pointer]
    - button "G#" [ref=e60] [cursor=pointer]
    - button "A" [ref=e61] [cursor=pointer]
    - button "A#" [ref=e62] [cursor=pointer]
    - button "B" [ref=e63] [cursor=pointer]
  - generic [ref=e64]:
    - generic [ref=e65]: ●
    - generic [ref=e66]: ●
    - generic [ref=e67]: ●
  - paragraph
  - generic [ref=e68]:
    - generic [ref=e69]:
      - generic [ref=e70]: "Bünde: 0 – 4"
      - 'slider "Bünde: 0 – 4" [ref=e71] [cursor=pointer]': "4"
    - generic [ref=e72]:
      - generic [ref=e73]: "Saiten:"
      - generic [ref=e74]:
        - button "E2" [ref=e75] [cursor=pointer]
        - button "A2" [ref=e76] [cursor=pointer]
        - button "D3" [ref=e77] [cursor=pointer]
        - button "G3" [ref=e78] [cursor=pointer]
        - button "B3" [ref=e79] [cursor=pointer]
        - button "E4" [ref=e80] [cursor=pointer]
    - generic [ref=e81]:
      - generic [ref=e82]: "Zufällige Töne:"
      - checkbox "Zufällige Töne:" [ref=e83] [cursor=pointer]
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
> 54 |     await expect(fretPlaceholder).toHaveAttribute('cx', markerCx);
     |                                   ^ Error: expect(locator).toHaveAttribute(expected) failed
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
  68 |     await expect(fretNumber).toHaveCount(1);
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