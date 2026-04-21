import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  NOTE_STAFF_VIEW_WIDTH,
  NOTE_STAFF_VIEW_HEIGHT,
  NOTE_STAFF_Y,
} from '../../js/games/notePlayingExercise/notePlayingLayoutMetrics.js';

function extractCssNumber(css, selector, prop) {
  const escapedSelector = selector
    .replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    .replace(/\s+/g, '\\s+');
  const escapedProp = prop.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const rulePattern = new RegExp(`${escapedSelector}\\s*\\{([\\s\\S]*?)\\}`, 'm');
  const rule = css.match(rulePattern);
  if (!rule) throw new Error(`Missing CSS rule: ${selector}`);

  const valuePattern = new RegExp(`${escapedProp}\\s*:\\s*([^;]+);`, 'm');
  const valueMatch = rule[1].match(valuePattern);
  if (!valueMatch) throw new Error(`Missing CSS property '${prop}' in: ${selector}`);

  const raw = valueMatch[1].trim();
  if (raw.endsWith('rem')) return parseFloat(raw) * 16;
  if (raw.endsWith('px')) return parseFloat(raw);
  throw new Error(`Unsupported unit for ${selector} -> ${prop}: ${raw}`);
}

describe('Note Playing layout spacing', () => {
  it('keeps enough notation footroom for low notes like E2', () => {
    const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
    const css = fs.readFileSync(path.join(root, 'style.css'), 'utf8');

    const notationWidth = extractCssNumber(css, '.note-play-notation', 'max-width');
    const lowerStaffLineY = NOTE_STAFF_Y + 40;
    const pxBelowStaffInNotation = notationWidth * (NOTE_STAFF_VIEW_HEIGHT - lowerStaffLineY) / NOTE_STAFF_VIEW_WIDTH;

    // Keep enough visible SVG space under the lowest staff line so E2 noteheads/ledger lines don't get clipped.
    expect(pxBelowStaffInNotation).toBeGreaterThanOrEqual(90);
  });

  it('keeps the gap from bottom staff line to hint-button top within a compact limit', () => {
    const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
    const css = fs.readFileSync(path.join(root, 'style.css'), 'utf8');

    const notationWidth = extractCssNumber(css, '.note-play-notation', 'max-width');
    const displayGap = extractCssNumber(css, '.note-play-display', 'gap');
    const targetHeight = extractCssNumber(css, '.note-play-target-note', 'min-height');
    const targetMarginBottom = extractCssNumber(css, '.note-play-target-note', 'margin-bottom');
    const hintsMarginTop = extractCssNumber(css, '.note-play-hints', 'margin-top');

    // VexFlow stave has 5 lines with 10 viewBox-units spacing => lower line at staveY + 40.
    const lowerStaffLineY = NOTE_STAFF_Y + 40;
    const pxBelowStaffInNotation = notationWidth * (NOTE_STAFF_VIEW_HEIGHT - lowerStaffLineY) / NOTE_STAFF_VIEW_WIDTH;

    // Flow (tab hidden): notation -> gap -> target -> gap -> hints (with margins).
    const distancePx =
      pxBelowStaffInNotation +
      displayGap +
      targetHeight +
      targetMarginBottom +
      displayGap +
      hintsMarginTop;

    expect(distancePx).toBeLessThanOrEqual(125);
  });
});
