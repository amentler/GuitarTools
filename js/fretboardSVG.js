// SVG fretboard rendering – pure functions, no state

import { STRING_LABELS } from './fretboardLogic.js';

// ── Layout constants ──────────────────────────────────────────────────────────
const VB_W = 640;
const VB_H = 290;

const LABEL_X      = 48;   // x where string label text ends (text-anchor: end)
const NUT_X        = 58;   // left edge of fretboard (nut position)
const RIGHT_X      = 612;  // right edge of fretboard
const FRETBOARD_W  = RIGHT_X - NUT_X;   // 554px

const TOP_Y    = 40;   // y of topmost string (high E)
const BOTTOM_Y = 250;  // y of bottommost string (low E)
const STRING_SPACING = (BOTTOM_Y - TOP_Y) / 5;  // 42px

// Fret wire x-positions (nut + 4 frets).
// Tempered scale approximation – each fret ≈ previous / 17.817 shorter.
// We have frets 0-4 displayed (open + 4 fretted positions).
// Fret wire positions mark the LEFT edge of each "cell" (fret 0 = open = left of nut).
// The nut itself occupies x = NUT_X; fret wires are at positions after it.
const FRET_WIRE_X = (() => {
  const widths = [142, 134, 126, 119, 113]; // widths of columns 0-4 (sum ≈ 634 > 554, rescale)
  const total = widths.reduce((a, b) => a + b, 0);
  const scale = FRETBOARD_W / total;
  const positions = [NUT_X];
  let x = NUT_X;
  for (let i = 0; i < widths.length; i++) {
    x += widths[i] * scale;
    positions.push(Math.round(x));
  }
  return positions; // [NUT_X, x1, x2, x3, x4, RIGHT_X]
})();

// Center x of each fret "cell" (column between two wires)
const FRET_CENTER_X = FRET_WIRE_X.map((x, i) =>
  i < FRET_WIRE_X.length - 1
    ? Math.round((x + FRET_WIRE_X[i + 1]) / 2)
    : null
).filter(v => v !== null); // 5 values for frets 0-4

// y position of each string (index 0 = low E at bottom, 5 = high E at top)
// We display low E at the bottom of the SVG, high E at the top.
function stringY(stringIndex) {
  // stringIndex 0 = low E → BOTTOM_Y, 5 = high E → TOP_Y
  return BOTTOM_Y - stringIndex * STRING_SPACING;
}

// ── SVG helpers ───────────────────────────────────────────────────────────────
const SVG_NS = 'http://www.w3.org/2000/svg';

function el(tag, attrs = {}, children = []) {
  const e = document.createElementNS(SVG_NS, tag);
  for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v);
  for (const child of children) e.appendChild(child);
  return e;
}

function text(content, attrs = {}) {
  const e = document.createElementNS(SVG_NS, 'text');
  for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v);
  e.textContent = content;
  return e;
}

// ── Main render function ──────────────────────────────────────────────────────

/**
 * Renders the fretboard SVG into the given container element.
 * @param {HTMLElement} container
 * @param {number} targetString   0 (low E) to 5 (high E)
 * @param {number} targetFret     0 (open) to 4
 * @param {'correct'|'wrong'|null} feedbackState
 */
export function renderFretboard(container, targetString, targetFret, feedbackState) {
  // Remove old SVG
  container.innerHTML = '';

  const svg = el('svg', {
    viewBox: `0 0 ${VB_W} ${VB_H}`,
    xmlns: SVG_NS,
    role: 'img',
    'aria-label': 'Gitarren-Griffbrett',
  });

  // ── 1. Fretboard background ──────────────────────────────────────────────
  svg.appendChild(el('rect', {
    x: NUT_X, y: TOP_Y - 10,
    width: FRETBOARD_W, height: BOTTOM_Y - TOP_Y + 20,
    fill: '#3b1f0a',
    rx: '4',
  }));

  // ── 2. Fret position marker (dot between frets 2-3, between strings 2-3) ─
  const markerX = Math.round((FRET_WIRE_X[2] + FRET_WIRE_X[3]) / 2);
  const markerY = Math.round((stringY(2) + stringY(3)) / 2);
  svg.appendChild(el('circle', {
    cx: markerX, cy: markerY, r: '8',
    fill: '#5a3010', opacity: '0.7',
  }));

  // ── 3. Nut ───────────────────────────────────────────────────────────────
  svg.appendChild(el('rect', {
    x: NUT_X - 1, y: TOP_Y - 10,
    width: '7', height: BOTTOM_Y - TOP_Y + 20,
    fill: '#f5e6c8',
    rx: '2',
  }));

  // ── 4. Fret wires (at positions 1-4, the nut covers position 0) ──────────
  for (let f = 1; f <= 4; f++) {
    svg.appendChild(el('line', {
      x1: FRET_WIRE_X[f], y1: TOP_Y - 10,
      x2: FRET_WIRE_X[f], y2: BOTTOM_Y + 10,
      stroke: '#c0c0c0',
      'stroke-width': '3',
      'stroke-linecap': 'round',
    }));
  }

  // ── 5. Strings ───────────────────────────────────────────────────────────
  const STRING_PROPS = [
    { stroke: '#d4a017', width: '3.5' }, // 0 low E
    { stroke: '#d4a017', width: '3.0' }, // 1 A
    { stroke: '#d4a017', width: '2.5' }, // 2 D
    { stroke: '#c8c8c8', width: '2.0' }, // 3 G
    { stroke: '#c8c8c8', width: '1.5' }, // 4 B
    { stroke: '#c8c8c8', width: '1.0' }, // 5 high E
  ];

  for (let s = 0; s < 6; s++) {
    const y = stringY(s);
    const { stroke, width } = STRING_PROPS[s];
    svg.appendChild(el('line', {
      x1: NUT_X - 1, y1: y,
      x2: RIGHT_X, y2: y,
      stroke,
      'stroke-width': width,
    }));
  }

  // ── 6. String name labels ────────────────────────────────────────────────
  for (let s = 0; s < 6; s++) {
    const y = stringY(s);
    svg.appendChild(text(STRING_LABELS[s], {
      x: LABEL_X,
      y: y + 1,
      'text-anchor': 'end',
      'dominant-baseline': 'middle',
      fill: '#8892a4',
      'font-size': '13',
      'font-family': 'monospace',
    }));
  }

  // ── 7. Fret number labels ────────────────────────────────────────────────
  const FRET_LABELS = ['Leer', '1', '2', '3', '4'];
  for (let f = 0; f < 5; f++) {
    svg.appendChild(text(FRET_LABELS[f], {
      x: FRET_CENTER_X[f],
      y: TOP_Y - 18,
      'text-anchor': 'middle',
      'dominant-baseline': 'middle',
      fill: '#8892a4',
      'font-size': '12',
      'font-family': 'sans-serif',
    }));
  }

  // ── 8. Target dot ────────────────────────────────────────────────────────
  const dotX = FRET_CENTER_X[targetFret];
  const dotY = stringY(targetString);

  let dotFill;
  if (feedbackState === 'correct') {
    dotFill = '#4caf50';
  } else if (feedbackState === 'wrong') {
    dotFill = '#f44336';
  } else {
    dotFill = '#f5a623';
  }

  const dotGroup = el('g');

  // Outer glow ring (only when no feedback yet)
  if (!feedbackState) {
    const glow = el('circle', {
      cx: dotX, cy: dotY, r: '20',
      fill: 'none',
      stroke: '#f5a623',
      'stroke-width': '2',
      opacity: '0.5',
    });
    const glowAnim = el('animate', {
      attributeName: 'r',
      values: '18;24;18',
      dur: '1.5s',
      repeatCount: 'indefinite',
    });
    const opacityAnim = el('animate', {
      attributeName: 'opacity',
      values: '0.5;0.1;0.5',
      dur: '1.5s',
      repeatCount: 'indefinite',
    });
    glow.appendChild(glowAnim);
    glow.appendChild(opacityAnim);
    dotGroup.appendChild(glow);
  }

  // Main dot circle
  const dotCircle = el('circle', {
    cx: dotX, cy: dotY, r: '15',
    fill: dotFill,
    'stroke-width': '0',
  });

  if (!feedbackState) {
    const pulseAnim = el('animate', {
      attributeName: 'r',
      values: '14;16;14',
      dur: '1.5s',
      repeatCount: 'indefinite',
    });
    dotCircle.appendChild(pulseAnim);
  }

  dotGroup.appendChild(dotCircle);

  // Label inside dot
  const dotLabel = feedbackState === 'correct' ? '✓' : feedbackState === 'wrong' ? '✗' : '?';
  dotGroup.appendChild(text(dotLabel, {
    x: dotX, y: dotY + 1,
    'text-anchor': 'middle',
    'dominant-baseline': 'middle',
    fill: '#fff',
    'font-size': feedbackState ? '16' : '14',
    'font-weight': 'bold',
    'font-family': 'sans-serif',
    'pointer-events': 'none',
  }));

  svg.appendChild(dotGroup);

  container.appendChild(svg);
}
