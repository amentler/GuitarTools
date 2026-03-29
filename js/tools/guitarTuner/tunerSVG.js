// SVG tuner gauge – init once, update in place

const VB_W = 400;
const VB_H = 250;
const PIVOT_X = 200;
const PIVOT_Y = 220;
const RADIUS = 155;
const MAX_DEG = 60; // ±60° from 12 o'clock

// Angle from 12 o'clock, clockwise positive (SVG rotate convention)
function polarPoint(angleDeg, r) {
  const rad = (angleDeg - 90) * (Math.PI / 180);
  return {
    x: PIVOT_X + r * Math.cos(rad),
    y: PIVOT_Y + r * Math.sin(rad),
  };
}

function arcPath(startDeg, endDeg, r, innerR) {
  const s = polarPoint(startDeg, r);
  const e = polarPoint(endDeg, r);
  const si = polarPoint(endDeg, innerR);
  const ei = polarPoint(startDeg, innerR);
  const large = Math.abs(endDeg - startDeg) > 180 ? 1 : 0;
  return [
    `M ${s.x} ${s.y}`,
    `A ${r} ${r} 0 ${large} 1 ${e.x} ${e.y}`,
    `L ${si.x} ${si.y}`,
    `A ${innerR} ${innerR} 0 ${large} 0 ${ei.x} ${ei.y}`,
    'Z',
  ].join(' ');
}

function svgEl(tag, attrs = {}) {
  const el = document.createElementNS('http://www.w3.org/2000/svg', tag);
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
  return el;
}

/**
 * Builds the tuner SVG inside container. Call once per startExercise.
 * @param {HTMLElement} container
 */
export function initTunerSVG(container) {
  container.innerHTML = '';

  const svg = svgEl('svg', {
    viewBox: `0 0 ${VB_W} ${VB_H}`,
    width: '100%',
    height: 'auto',
    role: 'img',
    'aria-label': 'Stimmgerät',
  });

  // Background
  svg.appendChild(svgEl('rect', {
    x: 0, y: 0, width: VB_W, height: VB_H,
    fill: 'var(--color-surface)',
    rx: 12,
  }));

  // ── Arc zones (outer r = RADIUS, inner r = RADIUS - 18) ──────────────────
  const ARC_OUTER = RADIUS;
  const ARC_INNER = RADIUS - 18;

  // Red left  (−60° to −30°)
  svg.appendChild(svgEl('path', {
    d: arcPath(-MAX_DEG, -MAX_DEG / 2, ARC_OUTER, ARC_INNER),
    fill: 'var(--color-wrong)',
    opacity: '0.6',
  }));
  // Yellow left (−30° to −15°)
  svg.appendChild(svgEl('path', {
    d: arcPath(-MAX_DEG / 2, -MAX_DEG / 4, ARC_OUTER, ARC_INNER),
    fill: 'var(--color-accent-alt)',
    opacity: '0.7',
  }));
  // Green center (−15° to +15°)
  svg.appendChild(svgEl('path', {
    d: arcPath(-MAX_DEG / 4, MAX_DEG / 4, ARC_OUTER, ARC_INNER),
    fill: 'var(--color-correct)',
    opacity: '0.7',
  }));
  // Yellow right (+15° to +30°)
  svg.appendChild(svgEl('path', {
    d: arcPath(MAX_DEG / 4, MAX_DEG / 2, ARC_OUTER, ARC_INNER),
    fill: 'var(--color-accent-alt)',
    opacity: '0.7',
  }));
  // Red right (+30° to +60°)
  svg.appendChild(svgEl('path', {
    d: arcPath(MAX_DEG / 2, MAX_DEG, ARC_OUTER, ARC_INNER),
    fill: 'var(--color-wrong)',
    opacity: '0.6',
  }));

  // ── Tick marks every 10° ─────────────────────────────────────────────────
  for (let deg = -MAX_DEG; deg <= MAX_DEG; deg += 10) {
    const inner = deg % 30 === 0 ? RADIUS - 28 : RADIUS - 22;
    const p1 = polarPoint(deg, RADIUS);
    const p2 = polarPoint(deg, inner);
    svg.appendChild(svgEl('line', {
      x1: p1.x, y1: p1.y, x2: p2.x, y2: p2.y,
      stroke: 'var(--color-border)',
      'stroke-width': deg % 30 === 0 ? 2 : 1,
    }));
  }

  // ── Labels: ♭ left, ♯ right ───────────────────────────────────────────────
  const lblFlat = polarPoint(-MAX_DEG - 4, RADIUS - 40);
  svg.appendChild(svgEl('text', {
    x: lblFlat.x, y: lblFlat.y,
    fill: 'var(--color-text-muted)',
    'font-size': '14',
    'text-anchor': 'middle',
    'dominant-baseline': 'middle',
  })).textContent = '♭';

  const lblSharp = polarPoint(MAX_DEG + 4, RADIUS - 40);
  svg.appendChild(svgEl('text', {
    x: lblSharp.x, y: lblSharp.y,
    fill: 'var(--color-text-muted)',
    'font-size': '14',
    'text-anchor': 'middle',
    'dominant-baseline': 'middle',
  })).textContent = '♯';

  // ── Needle ────────────────────────────────────────────────────────────────
  const needleTop = polarPoint(0, RADIUS - 8);
  const needle = svgEl('line', {
    id: 'tuner-needle',
    x1: PIVOT_X, y1: PIVOT_Y,
    x2: needleTop.x, y2: needleTop.y,
    stroke: 'var(--color-text)',
    'stroke-width': '2.5',
    'stroke-linecap': 'round',
    transform: `rotate(0, ${PIVOT_X}, ${PIVOT_Y})`,
    style: 'transition: transform 0.1s ease-out',
  });
  svg.appendChild(needle);

  // Pivot dot
  svg.appendChild(svgEl('circle', {
    cx: PIVOT_X, cy: PIVOT_Y, r: 5,
    fill: 'var(--color-text-muted)',
  }));

  // ── In-tune green dot ─────────────────────────────────────────────────────
  svg.appendChild(svgEl('circle', {
    id: 'tuner-dot',
    cx: PIVOT_X, cy: 62, r: 10,
    fill: 'var(--color-surface)',
    stroke: 'var(--color-correct)',
    'stroke-width': '2',
    style: 'transition: fill 0.15s',
  }));

  // ── Note text (large, centred) ────────────────────────────────────────────
  svg.appendChild(svgEl('text', {
    id: 'tuner-note',
    x: PIVOT_X, y: 200,
    fill: 'var(--color-text)',
    'font-size': '36',
    'font-weight': '700',
    'font-family': 'monospace',
    'text-anchor': 'middle',
    'dominant-baseline': 'middle',
  })).textContent = '–';

  // ── Cents text (small, muted) ─────────────────────────────────────────────
  svg.appendChild(svgEl('text', {
    id: 'tuner-cents',
    x: PIVOT_X, y: 173,
    fill: 'var(--color-text-muted)',
    'font-size': '13',
    'text-anchor': 'middle',
    'dominant-baseline': 'middle',
  })).textContent = '';

  container.appendChild(svg);
}

/**
 * Updates the tuner display without rebuilding the SVG.
 * @param {{cents:number, note:string, octave:number, isActive:boolean, isInTune:boolean, isStandardNote:boolean}} opts
 */
export function updateTunerDisplay({ cents, note, octave, isActive, isInTune, isStandardNote }) {
  const needle = document.getElementById('tuner-needle');
  const dot    = document.getElementById('tuner-dot');
  const noteTxt = document.getElementById('tuner-note');
  const centsTxt = document.getElementById('tuner-cents');

  if (!needle) return;

  if (!isActive) {
    needle.setAttribute('transform', `rotate(0, ${PIVOT_X}, ${PIVOT_Y})`);
    dot.setAttribute('fill', 'var(--color-surface)');
    noteTxt.textContent = '–';
    centsTxt.textContent = '';
    return;
  }

  // Clamp rotation to ±MAX_DEG
  const deg = Math.max(-MAX_DEG, Math.min(MAX_DEG, (cents / 50) * MAX_DEG));
  needle.setAttribute('transform', `rotate(${deg.toFixed(1)}, ${PIVOT_X}, ${PIVOT_Y})`);

  const lit = isInTune && isStandardNote;
  dot.setAttribute('fill', lit ? 'var(--color-correct)' : 'var(--color-surface)');

  noteTxt.textContent = note ? `${note}${octave}` : '–';
  centsTxt.textContent = cents !== null
    ? (cents >= 0 ? `+${cents.toFixed(0)}` : `${cents.toFixed(0)}`) + ' ct'
    : '';
}
