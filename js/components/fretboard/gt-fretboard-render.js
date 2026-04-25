// Pure SVG fretboard rendering – no state, no framework dependencies

const SVG_NS = 'http://www.w3.org/2000/svg';
const VB_W = 640;
const VB_H = 290;
const NUT_X = 8;
const RIGHT_X = 632;
const FRETBOARD_W = RIGHT_X - NUT_X;
const TOP_Y = 55;
const BOTTOM_Y = 265;
const STRING_SPACING = (BOTTOM_Y - TOP_Y) / 5;
const INLAY_FRETS = [3, 5, 7, 9];
const WOOD_PADDING = 20;

const STRING_PROPS = [
  { stroke: '#d4a017', width: '3.5' }, // 0 low E
  { stroke: '#d4a017', width: '3.0' }, // 1 A
  { stroke: '#d4a017', width: '2.5' }, // 2 D
  { stroke: '#c8c8c8', width: '2.0' }, // 3 G
  { stroke: '#c8c8c8', width: '1.5' }, // 4 B
  { stroke: '#c8c8c8', width: '1.0' }, // 5 high E
];

function stringY(stringIndex) {
  return BOTTOM_Y - stringIndex * STRING_SPACING;
}

/**
 * Compute fret wire x-positions using equal temperament.
 * Returns maxFret + 2 values: [nut, wire1, ..., wireMaxFret, rightEdge].
 * Formula: distance from nut to fret n = scaleLength × (1 − 2^(−n/12))
 * We normalise so that fret (maxFret+1) maps to FRETBOARD_W.
 */
function computeFretWireX(maxFret) {
  const span = 1 - Math.pow(2, -(maxFret + 1) / 12);
  const positions = [];
  for (let n = 0; n <= maxFret + 1; n++) {
    const ratio = (1 - Math.pow(2, -n / 12)) / span;
    positions.push(Math.round(NUT_X + ratio * FRETBOARD_W));
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
 * @param {Array<{stringIndex:number, fret:number, state?:string}>} options.positions
 *   Marked positions. `state` can be 'selected' | 'correct' | 'wrong' | 'missed'.
 * @param {boolean}     options.interactive    - If true, circles are clickable.
 * @param {function}    options.onSelect       - Called with (stringIndex, fret) on click.
 */
export function renderFretboard(container, options = {}) {
  const {
    maxFret = 5,
    activeStrings = [0, 1, 2, 3, 4, 5],
    positions = [],
    interactive = false,
    onSelect = null,
  } = options;

  // Build a fast lookup map: "stringIndex:fret" → state
  const posMap = new Map(
    positions.map(p => [`${p.stringIndex}:${p.fret}`, p.state ?? 'selected'])
  );

  container.innerHTML = '';

  const fretWireX = computeFretWireX(maxFret);
  const fretCenterX = fretWireX.slice(0, -1).map((x, i) =>
    Math.round((x + fretWireX[i + 1]) / 2)
  );

  const svg = el('svg', {
    viewBox: `0 0 ${VB_W} ${VB_H}`,
    xmlns: SVG_NS,
    role: 'group',
    'aria-label': 'Interaktives Griffbrett',
  });

  // Fretboard background
  svg.appendChild(el('rect', {
    x: NUT_X, y: TOP_Y - WOOD_PADDING,
    width: FRETBOARD_W, height: BOTTOM_Y - TOP_Y + (2 * WOOD_PADDING),
    fill: '#5c2e0a', rx: '4',
  }));

  // Inlay dots
  const markerY = Math.round((stringY(2) + stringY(3)) / 2);
  for (const mf of INLAY_FRETS) {
    if (mf > maxFret) continue;
    const markerX = Math.round((fretWireX[mf] + fretWireX[mf + 1]) / 2);
    svg.appendChild(el('circle', { cx: markerX, cy: markerY, r: '7', fill: '#7a3e1a', opacity: '0.7' }));
  }

  // Nut
  svg.appendChild(el('rect', {
    x: NUT_X, y: TOP_Y - WOOD_PADDING,
    width: '7', height: BOTTOM_Y - TOP_Y + (2 * WOOD_PADDING),
    fill: '#f5e6c8', rx: '2',
  }));

  // Fret wires
  for (let f = 1; f <= maxFret; f++) {
    svg.appendChild(el('line', {
      x1: fretWireX[f], y1: TOP_Y - WOOD_PADDING,
      x2: fretWireX[f], y2: BOTTOM_Y + WOOD_PADDING,
      stroke: '#d4a843', 'stroke-width': '3', 'stroke-linecap': 'round',
    }));
  }

  // Strings
  for (let s = 0; s < 6; s++) {
    const y = stringY(s);
    const props = STRING_PROPS[s];
    const isActive = activeStrings.includes(s);
    svg.appendChild(el('line', {
      x1: NUT_X, y1: y, x2: RIGHT_X, y2: y,
      stroke: props.stroke,
      'stroke-width': props.width,
      opacity: isActive ? '1' : '0.25',
    }));
  }

  // Fret number labels
  const fretLabels = ['Leer', ...Array.from({ length: maxFret }, (_, i) => String(i + 1))];
  for (let f = 0; f <= maxFret; f++) {
    svg.appendChild(txt(fretLabels[f], {
      x: fretCenterX[f], y: TOP_Y - 35,
      'text-anchor': 'middle', 'dominant-baseline': 'middle',
      fill: '#8a7a6a', 'font-size': '12', 'font-family': 'sans-serif',
    }));
  }

  // Position circles
  for (const stringIndex of activeStrings) {
    for (let fret = 0; fret <= maxFret; fret++) {
      const x = fretCenterX[fret];
      const y = stringY(stringIndex);
      const key = `${stringIndex}:${fret}`;
      const state = posMap.get(key);

      let fill = 'transparent';
      let stroke;

      if (state === 'correct') {
        fill = '#2ecc71'; stroke = '#2ecc71';
      } else if (state === 'wrong') {
        fill = '#e74c3c'; stroke = '#e74c3c';
      } else if (state === 'missed') {
        fill = '#ff6b35'; stroke = '#ff6b35';
      } else if (state === 'selected') {
        fill = '#ff6b35'; stroke = '#ff6b35';
      } else {
        stroke = '#c8b89a';
      }

      svg.appendChild(el('circle', {
        cx: x, cy: y, r: '15',
        fill,
        stroke,
        'stroke-width': '2',
        'data-string': String(stringIndex),
        'data-fret': String(fret),
        'aria-label': `Griffbrett-Position: Saite ${stringIndex}, Bund ${fret}`,
        style: interactive ? 'cursor:pointer;' : '',
      }));
    }
  }

  if (interactive && onSelect) {
    svg.addEventListener('click', event => {
      const target = event.target.closest('circle[data-string][data-fret]');
      if (!target) return;
      onSelect(
        parseInt(target.getAttribute('data-string'), 10),
        parseInt(target.getAttribute('data-fret'), 10)
      );
    });
  }

  container.appendChild(svg);
}
