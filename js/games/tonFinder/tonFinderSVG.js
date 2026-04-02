const SVG_NS = 'http://www.w3.org/2000/svg';
const VB_W = 640;
const VB_H = 290;
const NUT_X = 8;
const RIGHT_X = 632;
const FRETBOARD_W = RIGHT_X - NUT_X;
const TOP_Y = 40;
const BOTTOM_Y = 250;
const STRING_SPACING = (BOTTOM_Y - TOP_Y) / 5;
const INLAY_FRETS = [3, 5, 7, 9];

function stringY(stringIndex) {
  return BOTTOM_Y - stringIndex * STRING_SPACING;
}

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

export function renderInteractiveFretboard(
  container,
  maxFret,
  activeStrings,
  onTogglePosition,
  selectedKeys,
  resultMap
) {
  container.innerHTML = '';
  const fretWireX = computeFretWireX(maxFret);
  const fretCenterX = fretWireX.slice(0, -1).map((x, i) => Math.round((x + fretWireX[i + 1]) / 2));

  const svg = el('svg', {
    viewBox: `0 0 ${VB_W} ${VB_H}`,
    xmlns: SVG_NS,
    role: 'img',
    'aria-label': 'Ton-Finder Griffbrett',
  });

  svg.appendChild(el('rect', {
    x: NUT_X, y: TOP_Y - 10,
    width: FRETBOARD_W, height: BOTTOM_Y - TOP_Y + 20,
    fill: '#3b1f0a', rx: '4',
  }));

  const markerY = Math.round((stringY(2) + stringY(3)) / 2);
  for (const mf of INLAY_FRETS) {
    if (mf > maxFret) continue;
    const markerX = Math.round((fretWireX[mf] + fretWireX[mf + 1]) / 2);
    svg.appendChild(el('circle', { cx: markerX, cy: markerY, r: '7', fill: '#5a3010', opacity: '0.7' }));
  }

  svg.appendChild(el('rect', {
    x: NUT_X, y: TOP_Y - 10,
    width: '7', height: BOTTOM_Y - TOP_Y + 20,
    fill: '#f5e6c8', rx: '2',
  }));

  for (let f = 1; f <= maxFret; f++) {
    svg.appendChild(el('line', {
      x1: fretWireX[f], y1: TOP_Y - 10,
      x2: fretWireX[f], y2: BOTTOM_Y + 10,
      stroke: '#c0c0c0', 'stroke-width': '3', 'stroke-linecap': 'round',
    }));
  }

  const STRING_PROPS = [
    { stroke: '#d4a017', width: '3.5' },
    { stroke: '#d4a017', width: '3.0' },
    { stroke: '#d4a017', width: '2.5' },
    { stroke: '#c8c8c8', width: '2.0' },
    { stroke: '#c8c8c8', width: '1.5' },
    { stroke: '#c8c8c8', width: '1.0' },
  ];

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

  const fretLabels = ['Leer', ...Array.from({ length: maxFret }, (_, i) => String(i + 1))];
  for (let f = 0; f <= maxFret; f++) {
    svg.appendChild(txt(fretLabels[f], {
      x: fretCenterX[f], y: TOP_Y - 18,
      'text-anchor': 'middle', 'dominant-baseline': 'middle',
      fill: '#8892a4', 'font-size': '12', 'font-family': 'sans-serif',
    }));
  }

  for (const stringIndex of activeStrings) {
    for (let fret = 0; fret <= maxFret; fret++) {
      const x = fretCenterX[fret];
      const y = stringY(stringIndex);
      const key = `${stringIndex}:${fret}`;
      const result = resultMap.get(key);
      const isSelected = selectedKeys.has(key);

      let fill = 'transparent';
      let stroke = 'transparent';
      if (result === 'correct') {
        fill = '#4caf50';
        stroke = '#4caf50';
      } else if (result === 'wrong') {
        fill = '#f44336';
        stroke = '#f44336';
      } else if (result === 'missed') {
        fill = '#f5a623';
        stroke = '#f5a623';
      } else if (isSelected) {
        fill = '#f5a623';
        stroke = '#f5a623';
      } else {
        stroke = '#60739a';
      }

      svg.appendChild(el('circle', {
        cx: x, cy: y, r: '15',
        fill,
        stroke,
        'stroke-width': '2',
        'data-string': String(stringIndex),
        'data-fret': String(fret),
        style: 'cursor:pointer;',
      }));
    }
  }

  svg.addEventListener('click', event => {
    const target = event.target.closest('circle[data-string][data-fret]');
    if (!target) return;
    onTogglePosition(
      parseInt(target.getAttribute('data-string'), 10),
      parseInt(target.getAttribute('data-fret'), 10)
    );
  });

  container.appendChild(svg);
}
