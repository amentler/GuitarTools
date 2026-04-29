import { test, expect } from '@playwright/test';

async function getStringRowY(page, stringLabel) {
  return page.evaluate((label) => {
    const node = Array.from(document.querySelectorAll('gt-fretboard text'))
      .find(text =>
        text.textContent === label &&
        text.getAttribute('fill') !== '#ffffff' &&
        Number(text.getAttribute('x')) < 40
      );
    return node ? Number(node.getAttribute('y')) - 5 : null;
  }, stringLabel);
}

async function getFretX(page, fretNumber) {
  return page.evaluate((fret) => {
    const node = Array.from(document.querySelectorAll('gt-fretboard text'))
      .find(text =>
        text.textContent === String(fret) &&
        text.getAttribute('fill') !== '#ffffff' &&
        Number(text.getAttribute('y')) > 200
      );
    return node ? Number(node.getAttribute('x')) : null;
  }, fretNumber);
}

async function getLabeledMarkerPosition(page, label) {
  return page.evaluate((fingerLabel) => {
    const text = Array.from(document.querySelectorAll('gt-fretboard text'))
      .find(node => node.textContent === fingerLabel && node.getAttribute('fill') === '#ffffff');
    if (!text?.previousElementSibling) return null;

    const marker = text.previousElementSibling;
    return {
      cx: marker.getAttribute('cx'),
      cy: marker.getAttribute('cy'),
    };
  }, label);
}

async function getOpenMarkers(page) {
  return page.evaluate(() => Array.from(
    document.querySelectorAll('gt-fretboard circle[fill="none"][stroke="#ff6b35"]')
  ).map(node => ({
    cx: Number(node.getAttribute('cx')),
    cy: Number(node.getAttribute('cy')),
  })));
}

async function getMutedCrossMidpoints(page) {
  return page.evaluate(() => {
    const lines = Array.from(document.querySelectorAll('gt-fretboard line[stroke="#e74c3c"]'));
    const result = [];

    for (let i = 0; i < lines.length; i += 2) {
      const line = lines[i];
      if (!line) continue;
      result.push({
        cx: (Number(line.getAttribute('x1')) + Number(line.getAttribute('x2'))) / 2,
        cy: (Number(line.getAttribute('y1')) + Number(line.getAttribute('y2'))) / 2,
      });
    }

    return result;
  });
}

test.describe('Chord Diagram Orientation Regressions', () => {
  test('renders G-Dur finger markers on the intended strings', async ({ page }) => {
    await page.goto('/pages/chord-playing-essentia/index.html?chord=G-Dur&categories=standard');
    await expect(page.locator('#ece-chord-name')).toHaveText('G-Dur');

    const finger1 = await getLabeledMarkerPosition(page, '1');
    const finger2 = await getLabeledMarkerPosition(page, '2');
    const finger4 = await getLabeledMarkerPosition(page, '4');

    const expectedFinger1 = { cx: String(await getFretX(page, 2)), cy: String(await getStringRowY(page, 'A')) };
    const expectedFinger2 = { cx: String(await getFretX(page, 3)), cy: String(await getStringRowY(page, 'E')) };
    const expectedFinger4 = { cx: String(await getFretX(page, 3)), cy: String(await getStringRowY(page, 'e')) };

    expect(finger1).toEqual(expectedFinger1);
    expect(finger2).toEqual(expectedFinger2);
    expect(finger4).toEqual(expectedFinger4);
  });

  test('renders Asus2 with muted low E and open high e, not the other way around', async ({ page }) => {
    await page.goto('/pages/chord-playing-essentia/index.html?chord=Asus2&categories=sus_add');
    await expect(page.locator('#ece-chord-name')).toHaveText('Asus2');

    const expectedHighEOpenY = await getStringRowY(page, 'e');
    const unexpectedLowEOpenY = await getStringRowY(page, 'E');
    const expectedLowEMutedY = await getStringRowY(page, 'E');
    const firstFretX = await getFretX(page, 1);

    const openMarkers = await getOpenMarkers(page);
    const mutedCrosses = await getMutedCrossMidpoints(page);

    expect(openMarkers.some(marker => marker.cy === expectedHighEOpenY)).toBe(true);
    expect(openMarkers.some(marker => marker.cy === unexpectedLowEOpenY)).toBe(false);
    expect(mutedCrosses.some(marker => marker.cy === expectedLowEMutedY && marker.cx < firstFretX)).toBe(true);
  });
});
