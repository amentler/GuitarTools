// SVG score renderer – staff + optional tab below

const VB_W       = 815;
const STAFF_TOP  = 58;
const LS         = 14;     // line spacing
const STEP_H     = LS / 2; // 7 px per note step
const STAFF_BOT  = STAFF_TOP + 4 * LS;  // 114  (bottom line = E4, step 0)
const STAFF_L    = 66;
const BAR_W      = 185;
const STAFF_R    = STAFF_L + 4 * BAR_W; // 806
const BEAT_SP    = 38;     // pixels between beats

const NOTE_RX    = 6;
const NOTE_RY    = 5;
const STEM_LEN   = 35;

const TAB_TOP    = 178;
const STR_SP     = 13;
const STR_COUNT  = 6;

// ── Helpers ──────────────────────────────────────────────────────────────────

function el(tag, attrs = {}, text) {
  const e = document.createElementNS('http://www.w3.org/2000/svg', tag);
  for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, String(v));
  if (text != null) e.textContent = text;
  return e;
}

function noteY(step) {
  return STAFF_BOT - step * STEP_H;
}

function noteX(bar, beat) {
  return STAFF_L + bar * BAR_W + 22 + beat * BEAT_SP;
}

/** Y positions of required ledger lines for notes below the staff. */
function ledgerYs(step) {
  const ys = [];
  for (let s = -2; Math.abs(s) <= Math.abs(step); s -= 2) ys.push(noteY(s));
  return ys;
}

// ── Treble clef (SVG path approximation) ─────────────────────────────────────

function drawClef(svg) {
  const cx  = 20;
  const gY  = STAFF_BOT - LS;        // G4 line = second from bottom
  const top = STAFF_TOP - 10;
  const bot = STAFF_BOT + 22;

  // Simplified treble clef path
  const d = [
    `M ${cx} ${bot}`,
    `C ${cx + 14} ${bot}     ${cx + 16} ${bot - 12}  ${cx}     ${STAFF_BOT - 2}`,
    `C ${cx - 12} ${gY + 12} ${cx - 14} ${gY - 2}   ${cx}     ${gY - 2}`,
    `C ${cx + 15} ${gY - 4}  ${cx + 17} ${gY - 20}  ${cx + 2} ${gY - 16}`,
    `C ${cx - 10} ${gY - 12} ${cx - 13} ${gY - 36}  ${cx}     ${top + 14}`,
    `C ${cx + 14} ${top + 2} ${cx + 15} ${top + 14} ${cx + 7} ${top + 22}`,
  ].join(' ');

  svg.appendChild(el('path', {
    d,
    fill: 'none',
    stroke: 'var(--color-text)',
    'stroke-width': 2.5,
    'stroke-linecap': 'round',
    'stroke-linejoin': 'round',
  }));
}

// ── Public API ───────────────────────────────────────────────────────────────

/**
 * Renders the 4-bar score into `container`.
 * @param {HTMLElement} container
 * @param {Array<Array<object>>} bars
 * @param {boolean} showTab
 */
export function renderScore(container, bars, showTab) {
  container.innerHTML = '';

  const vbH = showTab
    ? TAB_TOP + (STR_COUNT - 1) * STR_SP + 18
    : STAFF_BOT + 50;

  const svg = el('svg', {
    viewBox: `0 0 ${VB_W} ${vbH}`,
    width: '100%',
    height: 'auto',
  });

  // Background
  svg.appendChild(el('rect', {
    x: 0, y: 0, width: VB_W, height: vbH,
    fill: 'var(--color-surface)', rx: 8,
  }));

  // ── Staff lines ────────────────────────────────────────────────────────
  for (let i = 0; i < 5; i++) {
    const y = STAFF_TOP + i * LS;
    svg.appendChild(el('line', {
      x1: STAFF_L, y1: y, x2: STAFF_R, y2: y,
      stroke: 'var(--color-text)', 'stroke-width': 1,
    }));
  }

  // ── Treble clef ────────────────────────────────────────────────────────
  drawClef(svg);

  // ── Time signature ─────────────────────────────────────────────────────
  const tsX = STAFF_L - 20;
  for (const [digit, row] of [['4', 1.5], ['4', 3.0]]) {
    svg.appendChild(el('text', {
      x: tsX, y: STAFF_TOP + LS * row,
      fill: 'var(--color-text)', 'font-size': 17, 'font-weight': 700,
      'text-anchor': 'middle', 'dominant-baseline': 'middle',
    }, digit));
  }

  // ── Bar lines ──────────────────────────────────────────────────────────
  for (let i = 0; i <= 4; i++) {
    const x = STAFF_L + i * BAR_W;
    svg.appendChild(el('line', {
      x1: x, y1: STAFF_TOP, x2: x, y2: STAFF_BOT,
      stroke: 'var(--color-text)',
      'stroke-width': (i === 0 || i === 4) ? 2 : 1,
    }));
  }
  // Double bar at end
  svg.appendChild(el('line', {
    x1: STAFF_R - 4, y1: STAFF_TOP, x2: STAFF_R - 4, y2: STAFF_BOT,
    stroke: 'var(--color-text)', 'stroke-width': 4,
  }));

  // ── Notes ──────────────────────────────────────────────────────────────
  for (let bi = 0; bi < bars.length; bi++) {
    for (let ni = 0; ni < bars[bi].length; ni++) {
      const note = bars[bi][ni];
      const x = noteX(bi, ni);
      const y = noteY(note.step);

      // Ledger lines below staff
      for (const ly of ledgerYs(note.step)) {
        svg.appendChild(el('line', {
          x1: x - NOTE_RX - 4, y1: ly, x2: x + NOTE_RX + 4, y2: ly,
          stroke: 'var(--color-text)', 'stroke-width': 1,
        }));
      }

      // Note head
      svg.appendChild(el('ellipse', {
        cx: x, cy: y, rx: NOTE_RX, ry: NOTE_RY,
        fill: 'var(--color-text)',
      }));

      // Stem — up for notes below B4 (step 4), down otherwise
      const up = note.step < 4;
      svg.appendChild(el('line', {
        x1: up ? x + NOTE_RX : x - NOTE_RX,
        y1: y,
        x2: up ? x + NOTE_RX : x - NOTE_RX,
        y2: up ? y - STEM_LEN : y + STEM_LEN,
        stroke: 'var(--color-text)', 'stroke-width': 1.5,
      }));
    }
  }

  // ── Tab section ────────────────────────────────────────────────────────
  if (showTab) {
    // "T A B" label on lines 0–2
    for (const [char, i] of [['T', 0], ['A', 1], ['B', 2]]) {
      svg.appendChild(el('text', {
        x: 10, y: TAB_TOP + i * STR_SP,
        fill: 'var(--color-text-muted)', 'font-size': 11, 'font-weight': 700,
        'text-anchor': 'middle', 'dominant-baseline': 'middle',
      }, char));
    }

    // String lines
    for (let s = 0; s < STR_COUNT; s++) {
      svg.appendChild(el('line', {
        x1: STAFF_L, y1: TAB_TOP + s * STR_SP,
        x2: STAFF_R, y2: TAB_TOP + s * STR_SP,
        stroke: 'var(--color-border)', 'stroke-width': 1,
      }));
    }

    // Fret numbers
    for (let bi = 0; bi < bars.length; bi++) {
      for (let ni = 0; ni < bars[bi].length; ni++) {
        const note = bars[bi][ni];
        const x    = noteX(bi, ni);
        const sy   = TAB_TOP + (note.string - 1) * STR_SP;
        const txt  = String(note.fret);
        const bgW  = txt.length > 1 ? 16 : 11;

        svg.appendChild(el('rect', {
          x: x - bgW / 2, y: sy - 6, width: bgW, height: 12,
          fill: 'var(--color-surface)',
        }));
        svg.appendChild(el('text', {
          x, y: sy,
          fill: 'var(--color-text)',
          'font-size': 11, 'font-family': 'monospace',
          'text-anchor': 'middle', 'dominant-baseline': 'middle',
        }, txt));
      }
    }
  }

  container.appendChild(svg);
}
