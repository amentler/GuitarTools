// SVG fretboard rendering – pure functions, no state

// ── Layout constants ──────────────────────────────────────────────────────────
const VB_W = 640;
const VB_H = 290;

const NUT_X       = 8;    // left edge of fretboard (no string labels, reclaimed space)
const RIGHT_X     = 632;  // right edge of fretboard
const FRETBOARD_W = RIGHT_X - NUT_X;  // 624px

const TOP_Y    = 40;   // y of topmost string (high E)
const BOTTOM_Y = 250;  // y of bottommost string (low E)
const STRING_SPACING = (BOTTOM_Y - TOP_Y) / 5;  // 42px

// Standard fretboard inlay positions (single dot)
const INLAY_FRETS = [3, 5, 7, 9];

// y position of each string (index 0 = low E at bottom, 5 = high E at top)
function stringY(stringIndex) {
  return BOTTOM_Y - stringIndex * STRING_SPACING;
}

/**
 * Compute fret wire x-positions using the tempered scale.
 * Returns maxFret + 2 values: [nut, wire1, wire2, ..., wireMaxFret, rightEdge]
 */
function computeFretWireX(maxFret) {
  // Tempered scale: distance from nut to fret n = scaleLength * (1 - 2^(-n/12))
  // We normalise so that fret (maxFret+1) maps to FRETBOARD_W (right edge).
  const span = 1 - Math.pow(2, -(maxFret + 1) / 12);
  const positions = [];
  for (let n = 0; n <= maxFret + 1; n++) {
    const ratio = (1 - Math.pow(2, -n / 12)) / span;
    positions.push(Math.round(NUT_X + ratio * FRETBOARD_W));
  }
  return positions;
}

// ── SVG helpers ───────────────────────────────────────────────────────────────
const SVG_NS = 'http://www.w3.org/2000/svg';

function el(tag, attrs = {}, children = []) {
  const e = document.createElementNS(SVG_NS, tag);
  for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v);
  for (const child of children) e.appendChild(child);
  return e;
}

function txt(content, attrs = {}) {
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
 * @param {number} targetFret     0 (open) to maxFret
 * @param {'correct'|'wrong'|null} feedbackState
 * @param {number} maxFret        1–12, default 4
 */
export function renderFretboard(container, targetString, targetFret, feedbackState, maxFret = 4) {
  container.innerHTML = '';

  const fretWireX  = computeFretWireX(maxFret);
  const fretCenterX = fretWireX.slice(0, -1).map((x, i) =>
    Math.round((x + fretWireX[i + 1]) / 2)
  );

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
    fill: '#5c2e0a',
    rx: '4',
  }));

  // ── 2. Inlay dots (standard fretboard markers) ───────────────────────────
  const markerY = Math.round((stringY(2) + stringY(3)) / 2);
  for (const mf of INLAY_FRETS) {
    if (mf > maxFret) continue;
    const markerX = Math.round((fretWireX[mf] + fretWireX[mf + 1]) / 2);
    svg.appendChild(el('circle', {
      cx: markerX, cy: markerY, r: '7',
      fill: '#7a3e1a', opacity: '0.7',
    }));
  }

  // ── 3. Nut ───────────────────────────────────────────────────────────────
  svg.appendChild(el('rect', {
    x: NUT_X, y: TOP_Y - 10,
    width: '7', height: BOTTOM_Y - TOP_Y + 20,
    fill: '#f5e6c8',
    rx: '2',
  }));

  // ── 4. Fret wires (positions 1..maxFret) ─────────────────────────────────
  for (let f = 1; f <= maxFret; f++) {
    svg.appendChild(el('line', {
      x1: fretWireX[f], y1: TOP_Y - 10,
      x2: fretWireX[f], y2: BOTTOM_Y + 10,
      stroke: '#d4a843',
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
      x1: NUT_X, y1: y,
      x2: RIGHT_X, y2: y,
      stroke,
      'stroke-width': width,
    }));
  }

  // ── 6. Fret number labels ────────────────────────────────────────────────
  const fretLabels = ['Leer', ...Array.from({ length: maxFret }, (_, i) => String(i + 1))];
  for (let f = 0; f <= maxFret; f++) {
    svg.appendChild(txt(fretLabels[f], {
      x: fretCenterX[f],
      y: TOP_Y - 18,
      'text-anchor': 'middle',
      'dominant-baseline': 'middle',
      fill: '#8a7a6a',
      'font-size': '12',
      'font-family': 'sans-serif',
    }));
  }

  // ── 7. Target dot ────────────────────────────────────────────────────────
  const dotX = fretCenterX[targetFret];
  const dotY = stringY(targetString);

  let dotFill;
  if (feedbackState === 'correct') {
    dotFill = '#2ecc71';
  } else if (feedbackState === 'wrong') {
    dotFill = '#e74c3c';
  } else {
    dotFill = '#ff6b35';
  }

  const dotGroup = el('g');

  // Outer glow ring (only when no feedback yet)
  if (!feedbackState) {
    const glow = el('circle', {
      cx: dotX, cy: dotY, r: '20',
      fill: 'none',
      stroke: '#ff6b35',
      'stroke-width': '2',
      opacity: '0.5',
    });
    glow.appendChild(el('animate', {
      attributeName: 'r',
      values: '18;24;18',
      dur: '1.5s',
      repeatCount: 'indefinite',
    }));
    glow.appendChild(el('animate', {
      attributeName: 'opacity',
      values: '0.5;0.1;0.5',
      dur: '1.5s',
      repeatCount: 'indefinite',
    }));
    dotGroup.appendChild(glow);
  }

  // Main dot circle
  const dotCircle = el('circle', {
    cx: dotX, cy: dotY, r: '15',
    fill: dotFill,
  });

  if (!feedbackState) {
    dotCircle.appendChild(el('animate', {
      attributeName: 'r',
      values: '14;16;14',
      dur: '1.5s',
      repeatCount: 'indefinite',
    }));
  }

  dotGroup.appendChild(dotCircle);

  // Label inside dot
  const dotLabel = feedbackState === 'correct' ? '✓' : feedbackState === 'wrong' ? '✗' : '?';
  dotGroup.appendChild(txt(dotLabel, {
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
