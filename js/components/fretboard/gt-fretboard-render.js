// Pure SVG fretboard rendering – unified "clean" style
// Supports dynamic fret counts, string labels, and chord markers.

const SVG_NS = 'http://www.w3.org/2000/svg';

// Dimensions & Spacing – adjusted for "larger" content area
const VB_W = 640;
const VB_H = 260; // Slightly shorter viewbox to reduce empty vertical space
const MARGIN_LEFT = 60; // Increased from 45 to avoid overlap
const MARGIN_TOP = 25;
const MARGIN_BOTTOM = 40; // Space for fret numbers
const MARGIN_RIGHT = 15;

const DIAGRAM_W = VB_W - MARGIN_LEFT - MARGIN_RIGHT;
const DIAGRAM_H = VB_H - MARGIN_TOP - MARGIN_BOTTOM;

const NUM_STRINGS = 6;
const STRING_SPACING = DIAGRAM_H / (NUM_STRINGS - 1);

// Colors (matching chordDiagramRenderer)
const COLOR_STRING = '#d4a017';
const COLOR_FRET = '#d4a843';
const COLOR_NUT = '#f5e6c8';
const COLOR_TEXT = '#8a7a6a';
const COLOR_MARKER_DEFAULT = '#ff6b35';
const COLOR_CORRECT = '#2ecc71';
const COLOR_WRONG = '#e74c3c';

const STRING_LABELS = ['e', 'B', 'G', 'D', 'A', 'E'];

function stringY(stringIndex) {
  return MARGIN_TOP + (NUM_STRINGS - 1 - stringIndex) * STRING_SPACING;
}

function computeFretWireX(maxFret) {
  const span = 1 - Math.pow(2, -(maxFret + 1) / 12);
  const positions = [];
  for (let n = 0; n <= maxFret + 1; n++) {
    const ratio = (1 - Math.pow(2, -n / 12)) / span;
    positions.push(Math.round(MARGIN_LEFT + ratio * DIAGRAM_W));
  }
  return positions;
}

function el(tag, attrs = {}) {
  const node = document.createElementNS(SVG_NS, tag);
  for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, v);
  return node;
}

function txt(content, attrs = {}) {
  const node = document.createElementNS(SVG_NS, 'text');
  for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, v);
  node.textContent = content;
  return node;
}

/**
 * Renders an SVG fretboard into `container`.
 *
 * @param {HTMLElement} container   - Host element; its innerHTML is replaced.
 * @param {object}      options
 * @param {number}      options.maxFret        - Highest fret to show (default 5).
 * @param {number[]}    options.activeStrings  - String indices that are active (default all 6).
 * @param {Array<{stringIndex:number, fret:number, state?:string, label?:string}>} options.positions
 *   Marked positions. `state` can be 'selected' | 'correct' | 'wrong' | 'missed' | 'muted' | 'open'.
 * @param {boolean}     options.interactive    - If true, zones are clickable.
 * @param {boolean}     options.showLabels     - Show string labels E, A, D, G, B, e.
 * @param {function}    options.onSelect       - Called with (stringIndex, fret) on click.
 */
export function renderFretboard(container, options = {}) {
  const {
    maxFret = 5,
    activeStrings = [0, 1, 2, 3, 4, 5],
    positions = [],
    interactive = false,
    showLabels = true,
    onSelect = null,
  } = options;
  const displayedMaxFret = Math.max(1, maxFret);

  container.innerHTML = '';
  const fretWireX = computeFretWireX(displayedMaxFret);
  const fretCenters = fretWireX.slice(0, -1).map((x, i) =>
    Math.round((x + fretWireX[i + 1]) / 2)
  );

  const svg = el('svg', {
    viewBox: `0 0 ${VB_W} ${VB_H}`,
    xmlns: SVG_NS,
    class: 'fretboard-svg',
    style: 'width: 100%; height: auto; display: block; margin: 0 auto;',
  });

  // No wood background rect here – keep it clean.

  // Strings & Labels
  for (let s = 0; s < NUM_STRINGS; s++) {
    const stringIndex = 5 - s;
    const y = stringY(stringIndex);
    const isActive = activeStrings.includes(stringIndex);

    // String Line
    svg.appendChild(el('line', {
      x1: MARGIN_LEFT,
      y1: y,
      x2: MARGIN_LEFT + DIAGRAM_W,
      y2: y,
      stroke: COLOR_STRING,
      'stroke-width': 1 + ((NUM_STRINGS - 1 - stringIndex) * 0.5),
      opacity: isActive ? '1' : '0.2',
    }));

    // Label
    if (showLabels) {
      svg.appendChild(txt(STRING_LABELS[s], {
        x: MARGIN_LEFT - 42, // Moved further left to avoid markers
        y: y + 5,
        'text-anchor': 'middle',
        fill: COLOR_TEXT,
        'font-size': '16',
        'font-weight': 'bold',
        'font-family': 'monospace',
        opacity: isActive ? '1' : '0.3',
      }));
    }
  }

  // Frets & Nut
  for (let f = 0; f <= displayedMaxFret; f++) {
    const x = fretWireX[f];
    const isNut = f === 0;

    svg.appendChild(el('line', {
      x1: x,
      y1: MARGIN_TOP,
      x2: x,
      y2: MARGIN_TOP + DIAGRAM_H,
      stroke: isNut ? COLOR_NUT : COLOR_FRET,
      'stroke-width': isNut ? '8' : '3',
      'stroke-linecap': 'round',
    }));

    // Fret Numbers
    if (f > 0) {
      svg.appendChild(txt(f.toString(), {
        x: fretCenters[f - 1],
        y: MARGIN_TOP + DIAGRAM_H + 30,
        'text-anchor': 'middle',
        fill: COLOR_TEXT,
        'font-size': '14',
      }));
    }
  }

  // Interactive Zones & Position placeholders for Testing
  for (const stringIndex of activeStrings) {
    const y = stringY(stringIndex);

    for (let f = 0; f <= maxFret; f++) {
      const x = f === 0 ? MARGIN_LEFT - 20 : fretCenters[f - 1];
      const zoneX = f === 0 ? MARGIN_LEFT - 55 : fretWireX[f - 1];
      const zoneWidth = f === 0 ? 55 : fretWireX[f] - fretWireX[f - 1];

      // Clickable area
      const zone = el('rect', {
        x: zoneX,
        y: y - STRING_SPACING / 2,
        width: zoneWidth,
        height: STRING_SPACING,
        fill: 'transparent',
        style: interactive ? 'cursor:pointer;' : '',
        'data-string': String(stringIndex),
        'data-fret': String(f),
      });

      if (interactive && onSelect) {
        zone.addEventListener('click', () => onSelect(stringIndex, f));
      }
      svg.appendChild(zone);

      // Placeholder circle for tests
      const circle = el('circle', {
        cx: x, cy: y, r: f === 0 ? '8' : '14',
        fill: 'transparent',
        stroke: 'none',
        'data-string': String(stringIndex),
        'data-fret': String(f),
        'pointer-events': 'none',
      });
      svg.appendChild(circle);
    }
  }

  // Positions (Actual Markers)
  positions.forEach(pos => {
    const y = stringY(pos.stringIndex);

    if (pos.state === 'muted') {
      const size = 10;
      const x = MARGIN_LEFT - 20;
      const color = COLOR_WRONG;
      svg.appendChild(el('line', {
        x1: x - size, y1: y - size, x2: x + size, y2: y + size,
        stroke: color, 'stroke-width': '3',
        'pointer-events': 'none',
      }));
      svg.appendChild(el('line', {
        x1: x + size, y1: y - size, x2: x - size, y2: y + size,
        stroke: color, 'stroke-width': '3',
        'pointer-events': 'none',
      }));
    } else if (pos.fret === 0) {
      const x = MARGIN_LEFT - 20;
      let stroke = COLOR_TEXT;
      if (pos.state === 'correct') stroke = COLOR_CORRECT;
      if (pos.state === 'wrong') stroke = COLOR_WRONG;
      if (pos.state === 'selected' || pos.state === 'missed') stroke = COLOR_MARKER_DEFAULT;

      svg.appendChild(el('circle', {
        cx: x, cy: y, r: '8',
        fill: 'none',
        stroke: stroke,
        'stroke-width': '3',
        'pointer-events': 'none',
      }));
    } else {
      const x = fretCenters[pos.fret - 1];
      let fill = COLOR_MARKER_DEFAULT;
      if (pos.state === 'correct') fill = COLOR_CORRECT;
      if (pos.state === 'wrong') fill = COLOR_WRONG;
      if (pos.state === 'missed') fill = COLOR_MARKER_DEFAULT;

      svg.appendChild(el('circle', {
        cx: x, cy: y, r: '14',
        fill,
        'pointer-events': 'none',
      }));

      if (pos.label) {
        svg.appendChild(txt(pos.label, {
          x, y: y + 5,
          'text-anchor': 'middle',
          fill: '#ffffff',
          'font-size': '13',
          'font-weight': 'bold',
          'font-family': 'sans-serif',
          'pointer-events': 'none',
        }));
      }
    }
  });

  container.appendChild(svg);
}
