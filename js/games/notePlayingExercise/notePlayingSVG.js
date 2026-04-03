// SVG rendering for the Note-Playing Exercise
// Renders a single note on a treble clef staff (VexFlow) and tab positions (custom SVG).

import { Renderer, Stave, StaveNote, Voice, Formatter, Accidental } from 'https://cdn.jsdelivr.net/npm/vexflow@4.2.2/+esm';

// ── Note → VexFlow key mapping ────────────────────────────────────────────────
// Written pitch (guitar is transposing: sounds one octave lower than written).
// Notes span one chromatic octave: E4 (bottom treble-clef line) through D#5
// (4th line), so all 12 notes sit within the staff without ledger lines.
const NOTE_DISPLAY = {
  'E':  { vfKey: 'e/4',  acc: null },
  'F':  { vfKey: 'f/4',  acc: null },
  'F#': { vfKey: 'f#/4', acc: '#'  },
  'G':  { vfKey: 'g/4',  acc: null },
  'G#': { vfKey: 'g#/4', acc: '#'  },
  'A':  { vfKey: 'a/4',  acc: null },
  'A#': { vfKey: 'a#/4', acc: '#'  },
  'B':  { vfKey: 'b/4',  acc: null },
  'C':  { vfKey: 'c/5',  acc: null },
  'C#': { vfKey: 'c#/5', acc: '#'  },
  'D':  { vfKey: 'd/5',  acc: null },
  'D#': { vfKey: 'd#/5', acc: '#'  },
};

const VW = 220;
const VH = 120;
const STAVE_Y = 30;
const STAVE_W = 180;

/**
 * Renders a single note (or rest) on a treble clef staff into the given container.
 * @param {HTMLElement} container
 * @param {string|null} noteName  - e.g. "C#", "E", or null for empty staff
 */
export function renderNoteOnStaff(container, noteName) {
  container.innerHTML = '';

  const renderer = new Renderer(container, Renderer.Backends.SVG);
  renderer.resize(VW, VH);
  const ctx = renderer.getContext();

  const style = getComputedStyle(document.documentElement);
  const fg    = style.getPropertyValue('--color-text').trim() || '#eaeaea';
  ctx.setFillStyle(fg);
  ctx.setStrokeStyle(fg);

  const stave = new Stave(10, STAVE_Y, STAVE_W);
  stave.addClef('treble');
  stave.setContext(ctx).draw();

  if (noteName && NOTE_DISPLAY[noteName]) {
    const { vfKey, acc } = NOTE_DISPLAY[noteName];

    const staveNote = new StaveNote({ clef: 'treble', keys: [vfKey], duration: 'q' });
    if (acc) {
      staveNote.addModifier(new Accidental(acc), 0);
    }

    const voice = new Voice({ num_beats: 1, beat_value: 4 });
    try { voice.setMode(Voice.Mode.SOFT); } catch { /* VexFlow version compatibility */ }
    voice.addTickables([staveNote]);

    new Formatter().joinVoices([voice]).format([voice], STAVE_W * 0.5);
    voice.draw(ctx, stave);
  }

  // Make SVG responsive
  const vfSvg = container.querySelector('svg');
  if (vfSvg) {
    vfSvg.setAttribute('viewBox', `0 0 ${VW} ${VH}`);
    vfSvg.setAttribute('width', '100%');
    vfSvg.setAttribute('height', 'auto');
    vfSvg.style.width   = '100%';
    vfSvg.style.height  = 'auto';
    vfSvg.style.display = 'block';

    // Override VexFlow hardcoded black for dark theme
    vfSvg.querySelectorAll('[fill="black"],[fill="#000000"]')
      .forEach(el => el.setAttribute('fill', fg));
    vfSvg.querySelectorAll('[stroke="black"],[stroke="#000000"]')
      .forEach(el => el.setAttribute('stroke', fg));
    vfSvg.querySelectorAll('text').forEach(el => {
      const f = el.getAttribute('fill');
      if (!f || f === 'black' || f === '#000000') el.setAttribute('fill', fg);
    });
  }
}

// ── Tab constants ─────────────────────────────────────────────────────────────
const TAB_VW      = 260;
const TAB_STAFF_L = 28;
const TAB_STAFF_R = 250;
const STR_SP      = 14;
const STR_COUNT   = 6;

function tabEl(tag, attrs = {}, text) {
  const el = document.createElementNS('http://www.w3.org/2000/svg', tag);
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, String(v));
  if (text != null) el.textContent = text;
  return el;
}

/**
 * Renders tab positions (string/fret pairs) into the given container.
 * @param {HTMLElement} container
 * @param {Array<{string: number, fret: number}>} positions
 *   string = 0 (low E) … 5 (high E), same as notePlayingLogic convention.
 */
export function renderNotePositionsTab(container, positions) {
  container.innerHTML = '';

  if (!positions || positions.length === 0) return;

  const vbH = (STR_COUNT - 1) * STR_SP + 28;
  const svg = tabEl('svg', {
    viewBox: `0 0 ${TAB_VW} ${vbH}`,
    width: '100%',
    height: 'auto',
  });

  // Background
  svg.appendChild(tabEl('rect', {
    x: 0, y: 0, width: TAB_VW, height: vbH,
    fill: 'var(--color-surface)', rx: 6,
  }));

  // T A B label
  for (const [char, i] of [['T', 0], ['A', 1], ['B', 2]]) {
    svg.appendChild(tabEl('text', {
      x: 10, y: 4 + i * STR_SP,
      fill: 'var(--color-text-muted)', 'font-size': 11, 'font-weight': 700,
      'text-anchor': 'middle', 'dominant-baseline': 'middle',
    }, char));
  }

  // String lines (string 0 = low E = bottom line in tab)
  for (let s = 0; s < STR_COUNT; s++) {
    const y = 4 + (STR_COUNT - 1 - s) * STR_SP;
    svg.appendChild(tabEl('line', {
      x1: TAB_STAFF_L, y1: y, x2: TAB_STAFF_R, y2: y,
      stroke: 'var(--color-border)', 'stroke-width': 1,
    }));
  }

  // Group positions by string
  const byString = {};
  for (const pos of positions) {
    if (!byString[pos.string]) byString[pos.string] = [];
    byString[pos.string].push(pos.fret);
  }

  // Number of strings with notes
  const activeStrings = Object.keys(byString).map(Number);
  const totalCols = activeStrings.reduce((sum, s) => sum + byString[s].length, 0);
  const colW = (TAB_STAFF_R - TAB_STAFF_L) / Math.max(totalCols, 1);

  let col = 0;
  for (const s of [...activeStrings].sort((a, b) => a - b)) {
    for (const fret of byString[s]) {
      const x  = TAB_STAFF_L + (col + 0.5) * colW;
      // string 0 = low E = bottom row (highest y)
      const y  = 4 + (STR_COUNT - 1 - s) * STR_SP;
      const txt = String(fret);
      const bgW = txt.length > 1 ? 18 : 12;

      svg.appendChild(tabEl('rect', {
        x: x - bgW / 2, y: y - 6, width: bgW, height: 12,
        fill: 'var(--color-surface)',
      }));
      svg.appendChild(tabEl('text', {
        x, y,
        fill: 'var(--color-accent)', 'font-size': 11, 'font-family': 'monospace',
        'font-weight': 700,
        'text-anchor': 'middle', 'dominant-baseline': 'middle',
      }, txt));
      col++;
    }
  }

  container.appendChild(svg);
}
