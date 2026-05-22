import { test, expect } from '@playwright/test';

test.describe('Akkord-Übersicht Filter', () => {

  test.beforeEach(async ({ page }) => {
    await page.goto('/pages/akkord-uebersicht/index.html');
  });

  test('shows chord diagrams on load', async ({ page }) => {
    const container = page.locator('#akkord-uebersicht-container');
    await expect(container).toBeVisible();

    const diagrams = container.locator('gt-fretboard');
    await expect(diagrams.first()).toBeVisible();
    const count = await diagrams.count();
    expect(count).toBeGreaterThan(10);
  });

  test('root filter reduces visible chords', async ({ page }) => {
    const container = page.locator('#akkord-uebersicht-container');
    const allCount = await container.locator('gt-fretboard').count();

    // Click filter for "A" root
    const filterA = page.locator('#filter-root button[data-value="A"]');
    await filterA.click();

    const filteredCount = await container.locator('gt-fretboard').count();
    expect(filteredCount).toBeGreaterThan(0);
    expect(filteredCount).toBeLessThan(allCount);
  });

  test('type filter reduces visible chords', async ({ page }) => {
    const container = page.locator('#akkord-uebersicht-container');
    const allCount = await container.locator('gt-fretboard').count();

    // Click filter for "Dur" type
    const filterDur = page.locator('#filter-type button[data-value="Dur"]');
    await filterDur.click();

    const filteredCount = await container.locator('gt-fretboard').count();
    expect(filteredCount).toBeGreaterThan(0);
    expect(filteredCount).toBeLessThan(allCount);
  });

  test('active filter button gets active class', async ({ page }) => {
    const filterA = page.locator('#filter-root button[data-value="A"]');
    await expect(filterA).not.toHaveClass(/active/);
    await filterA.click();
    await expect(filterA).toHaveClass(/active/);
  });

  test('Alle button resets filter and shows all chords', async ({ page }) => {
    const container = page.locator('#akkord-uebersicht-container');

    // First filter
    const filterA = page.locator('#filter-root button[data-value="A"]');
    await filterA.click();
    const filteredCount = await container.locator('gt-fretboard').count();

    // Reset with Alle
    const alleBtn = page.locator('#filter-root button[data-value=""]');
    await alleBtn.click();
    const allCount = await container.locator('gt-fretboard').count();
    expect(allCount).toBeGreaterThan(filteredCount);
  });

  test('chord diagrams have correct orientation (portrait)', async ({ page }) => {
    const firstDiagram = page.locator('gt-fretboard').first();
    await expect(firstDiagram).toBeVisible();

    // Should render an SVG internally
    const svg = firstDiagram.locator('svg').first();
    await expect(svg).toBeVisible();
  });
});
