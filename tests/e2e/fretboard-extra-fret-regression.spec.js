import { test, expect } from '@playwright/test';

async function getFretboardGeometry(page) {
  return page.evaluate(() => {
    const svg = document.querySelector('gt-fretboard svg');
    if (!svg) return null;

    const numericLabels = Array.from(svg.querySelectorAll('text'))
      .filter(node => /^\d+$/.test(node.textContent?.trim() ?? ''))
      .map(node => ({
        label: Number(node.textContent),
        x: Number(node.getAttribute('x')),
      }));

    const verticalFretWires = Array.from(svg.querySelectorAll('line'))
      .filter(node => node.getAttribute('x1') === node.getAttribute('x2'))
      .map(node => Number(node.getAttribute('x1')));

    const stringRightEdge = Math.max(
      ...Array.from(svg.querySelectorAll('line[stroke="#d4a017"]'))
        .map(node => Number(node.getAttribute('x2')))
    );

    const rightmostFretWire = Math.max(...verticalFretWires);

    return {
      numericLabels,
      stringRightEdge,
      rightmostFretWire,
      unlabeledRightGap: stringRightEdge - rightmostFretWire,
    };
  });
}

test.describe('GtFretboard extra-fret regression', () => {
  test('shows no unlabeled extra fret area to the right when only fret 1 is selected', async ({ page }) => {
    await page.goto('/pages/fretboard-tone-recognition/index.html');

    await page.locator('#fret-range-slider').fill('1');
    await expect(page.locator('gt-fretboard')).toHaveAttribute('frets', '1');

    const geometry = await getFretboardGeometry(page);
    expect(geometry).not.toBeNull();

    expect(geometry.numericLabels.map(({ label }) => label)).toEqual([1]);
    expect(geometry.unlabeledRightGap).toBeLessThanOrEqual(1);
  });
});
