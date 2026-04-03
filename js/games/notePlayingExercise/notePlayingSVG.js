// SVG rendering for the Note-Playing Exercise
// Renders a single note on a treble clef staff (VexFlow) and tab positions (custom SVG).

import { Renderer, Stave, StaveNote, Voice, Formatter, Accidental } from 'https://cdn.jsdelivr.net/npm/vexflow@4.2.2/+esm';

// ── Octave-aware pitch → VexFlow key ──────────────────────────────────────────

/**
 * Converts an octave-aware pitch string (e.g. "C#4") to a VexFlow key and accidental.
 * @param {string} pitch - e.g. "C#4", "E2", "A#3"
 * @returns {{ vfKey: string, acc: string|null } | null}
 */
function pitchToVfKey(pitch) {
  const match = pitch.match(/^([A-G]#?)(\d+)$/);
  if (!match) return null;
  const noteName = match[1];
  const octave   = match[2];
  const vfKey    = `${noteName.toLowerCase()}/${octave}`;
  const acc      = noteName.includes('#') ? '#' : null;
  return { vfKey, acc };
}

/**
 * Guitar notation is written one octave above sounding pitch.
 * This converts a sounding pitch (e.g. E2) to written staff pitch (E3).
 * @param {string|null} pitch
 * @returns {string|null}
 */
function toGuitarWrittenPitch(pitch) {
  if (!pitch) return null;
  const match = pitch.match(/^([A-G]#?)(\d+)$/);
  if (!match) return null;
  const noteName = match[1];
  const octave = parseInt(match[2], 10);
  if (Number.isNaN(octave)) return null;
  return `${noteName}${octave + 1}`;
}

const VW = 220;
const VH = 185;
const STAVE_Y = 50;
const STAVE_W = 180;

/**
 * Renders a single note (or rest) on a treble clef staff into the given container.
 * @param {HTMLElement} container
 * @param {string|null} pitch - octave-aware pitch string e.g. "C#4", "E2", or null for empty staff
 */
export function renderNoteOnStaff(container, pitch) {
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

  if (pitch) {
    const writtenPitch = toGuitarWrittenPitch(pitch);
    const parsed = pitchToVfKey(writtenPitch);
    if (parsed) {
      const { vfKey, acc } = parsed;

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
