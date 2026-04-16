// SVG score renderer – VexFlow for notation, custom SVG for tab

import { Renderer, Stave, StaveNote, Voice, Formatter } from 'https://cdn.jsdelivr.net/npm/vexflow@4.2.2/+esm';
import { getTimeSignatureConfig } from './sheetMusicLogic.js';

// Fixed virtual canvas – CSS scales this to the actual container width.
// A narrower virtual canvas means CSS scales up the notes, making them appear
// larger on screen while the 4-bar layout still fits within the container.
const VW      = 640;   // narrower virtual canvas → CSS scales notes to ~141% on 900px container
const VH      = 240;   // extra height prevents clef-curl clipping above and ledger-line clipping below
const STAVE_Y = 80;    // y of top staff line (leaves 80 px for clef curl; low notes at ~155 px)

// First bar is wider to accommodate clef + time signature glyphs.
const FIRST_BAR_RATIO = 0.40;
const FIRST_BAR_W     = Math.round(VW * FIRST_BAR_RATIO);
const REST_BAR_W      = Math.floor((VW - FIRST_BAR_W) / 3);

// Tab constants (custom SVG below VexFlow notation)
const TAB_VB_W    = 900;
const TAB_STAFF_L = 20;
const TAB_STAFF_R = 885;
const STR_SP      = 13;
const STR_COUNT   = 6;

function tabEl(tag, attrs = {}, text) {
  const e = document.createElementNS('http://www.w3.org/2000/svg', tag);
  for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, String(v));
  if (text != null) e.textContent = text;
  return e;
}

function renderTab(tabDiv, bars) {
  tabDiv.innerHTML = '';

  const vbH = (STR_COUNT - 1) * STR_SP + 28;
  const svg = tabEl('svg', {
    viewBox: `0 0 ${TAB_VB_W} ${vbH}`,
    width: '100%',
    height: 'auto',
  });

  svg.appendChild(tabEl('rect', {
    x: 0, y: 0, width: TAB_VB_W, height: vbH,
    fill: 'var(--color-surface)', rx: 6,
  }));

  for (const [char, i] of [['T', 0], ['A', 1], ['B', 2]]) {
    svg.appendChild(tabEl('text', {
      x: 10, y: 8 + i * STR_SP,
      fill: 'var(--color-text-muted)', 'font-size': 11, 'font-weight': 700,
      'text-anchor': 'middle', 'dominant-baseline': 'middle',
    }, char));
  }

  for (let s = 0; s < STR_COUNT; s++) {
    svg.appendChild(tabEl('line', {
      x1: TAB_STAFF_L, y1: 8 + s * STR_SP,
      x2: TAB_STAFF_R, y2: 8 + s * STR_SP,
      stroke: 'var(--color-border)', 'stroke-width': 1,
    }));
  }

  const barW = (TAB_STAFF_R - TAB_STAFF_L) / 4;
  for (let i = 0; i <= 4; i++) {
    const x = TAB_STAFF_L + i * barW;
    svg.appendChild(tabEl('line', {
      x1: x, y1: 0, x2: x, y2: (STR_COUNT - 1) * STR_SP + 12,
      stroke: 'var(--color-border)', 'stroke-width': i === 0 || i === 4 ? 2 : 1,
    }));
  }

  const beatSpacing = barW / 5;
  for (let bi = 0; bi < bars.length; bi++) {
    for (let ni = 0; ni < bars[bi].length; ni++) {
      const note = bars[bi][ni];
      const x    = TAB_STAFF_L + bi * barW + beatSpacing * (ni + 1);
      const sy   = 8 + (note.string - 1) * STR_SP;
      const txt  = String(note.fret);
      const bgW  = txt.length > 1 ? 16 : 12;

      svg.appendChild(tabEl('rect', {
        x: x - bgW / 2, y: sy - 6, width: bgW, height: 12,
        fill: 'var(--color-surface)',
      }));
      svg.appendChild(tabEl('text', {
        x, y: sy,
        fill: 'var(--color-text)', 'font-size': 11, 'font-family': 'monospace',
        'text-anchor': 'middle', 'dominant-baseline': 'middle',
      }, txt));
    }
  }

  tabDiv.appendChild(svg);
}

/**
 * Renders bars as VexFlow notation into a new notation-wrapper div.
 * Does not attach the div to any parent — caller is responsible.
 *
 * @param {Array<Array<object>>} bars
 * @param {string} [timeSignature='4/4']
 * @returns {{ notationDiv: HTMLElement, staveLayout: Array<{ noteStartX: number, noteEndX: number }> }}
 */
function _renderNotation(bars, timeSignature = '4/4') {
  const tsConfig = getTimeSignatureConfig(timeSignature) || getTimeSignatureConfig('4/4');
  const { vfTimeSig, noteDuration, beatsPerBar } = tsConfig;
  const beatValue = noteDuration === 'e' ? 8 : 4;

  // position:relative so PlaybackBar can overlay its SVG cursor on top.
  const notationDiv = document.createElement('div');
  notationDiv.className = 'notation-wrapper';

  const renderer = new Renderer(notationDiv, Renderer.Backends.SVG);
  renderer.resize(VW, VH);
  const ctx = renderer.getContext();

  // Match dark theme
  const style = getComputedStyle(document.documentElement);
  const fg    = style.getPropertyValue('--color-text').trim() || '#eaeaea';
  ctx.setFillStyle(fg);
  ctx.setStrokeStyle(fg);

  // Make SVG responsive.
  // Set both attribute AND inline style — Firefox ignores CSS height:auto on SVG
  // when a pixel height attribute is present, so we must override both.
  const vfSvg = notationDiv.querySelector('svg');
  const applyResponsive = () => {
    if (!vfSvg) return;
    vfSvg.setAttribute('viewBox', `0 0 ${VW} ${VH}`);
    vfSvg.setAttribute('width', '100%');
    vfSvg.setAttribute('height', 'auto');
    vfSvg.style.width   = '100%';
    vfSvg.style.height  = 'auto';
    vfSvg.style.display = 'block';
  };
  applyResponsive();

  // ── Draw staves ─────────────────────────────────────────────────────────
  const staves = [];
  let x = 0;

  for (let bi = 0; bi < bars.length; bi++) {
    const w     = bi === 0 ? FIRST_BAR_W : REST_BAR_W;
    const stave = new Stave(x, STAVE_Y, w);

    if (bi === 0) stave.addClef('treble').addTimeSignature(vfTimeSig);
    if (bi === bars.length - 1) {
      // End barline – wrap in try/catch since enum values differ across VF versions
      try { stave.setEndBarType(3); } catch { /* VexFlow version compatibility */ }
    }

    stave.setContext(ctx).draw();
    staves.push(stave);
    x += w;
  }

  // ── Draw notes per bar ──────────────────────────────────────────────────
  for (let bi = 0; bi < bars.length; bi++) {
    const stave = staves[bi];
    const notes = bars[bi].map(n =>
      new StaveNote({ clef: 'treble', keys: [n.vfKey], duration: noteDuration })
    );

    const voice = new Voice({ num_beats: beatsPerBar, beat_value: beatValue });
    try { voice.setMode(Voice.Mode.SOFT); } catch { /* VexFlow version compatibility */ }
    voice.addTickables(notes);

    // Compute the actual note area: from getNoteStartX() to the right edge of the stave.
    // This correctly accounts for clef + time-signature width in bar 0, so notes
    // don't overflow into the next bar.
    const noteAreaW = stave.getX() + stave.getWidth() - stave.getNoteStartX();
    new Formatter().joinVoices([voice]).format([voice], noteAreaW * 0.90);
    voice.draw(ctx, stave);
  }

  // Re-apply responsive attributes after VexFlow finishes drawing
  // (VexFlow may reset width/height during render)
  applyResponsive();

  // ── Override VexFlow's hardcoded black to match dark theme ──────────────
  if (vfSvg) {
    vfSvg.querySelectorAll('[fill="black"],[fill="#000000"]')
      .forEach(el => el.setAttribute('fill', fg));
    vfSvg.querySelectorAll('[stroke="black"],[stroke="#000000"]')
      .forEach(el => el.setAttribute('stroke', fg));
    vfSvg.querySelectorAll('text')
      .forEach(el => {
        const f = el.getAttribute('fill');
        if (!f || f === 'black' || f === '#000000') el.setAttribute('fill', fg);
      });
  }

  // ── Collect stave layout for PlaybackBar ───────────────────────────────
  // noteStartX: absolute x where notes begin (after clef / time signature).
  // noteEndX:   absolute x at the right edge of the stave.
  const staveLayout = staves.map(stave => ({
    noteStartX: stave.getNoteStartX(),
    noteEndX:   stave.getX() + stave.getWidth(),
  }));

  return { notationDiv, staveLayout };
}

/**
 * Renders a 4-bar score into container (normal mode — clears existing content).
 *
 * @param {HTMLElement} container
 * @param {Array<Array<object>>} bars
 * @param {boolean} showTab
 * @param {string} [timeSignature='4/4']
 * @returns {{ notationDiv: HTMLElement, staveLayout: Array<{ noteStartX: number, noteEndX: number }> }}
 */
export function renderScore(container, bars, showTab, timeSignature = '4/4') {
  container.innerHTML = '';

  const { notationDiv, staveLayout } = _renderNotation(bars, timeSignature);
  container.appendChild(notationDiv);

  if (showTab) {
    const tabDiv = document.createElement('div');
    tabDiv.className = 'tab-wrapper';
    container.appendChild(tabDiv);
    renderTab(tabDiv, bars);
  }

  return { notationDiv, staveLayout };
}

/**
 * Appends a new row of bars to container (endless mode — does not clear existing content).
 * Each row is wrapped in a .score-row div so scroll position can be tracked per-row.
 *
 * @param {HTMLElement} container
 * @param {Array<Array<object>>} bars
 * @param {boolean} showTab
 * @param {string} [timeSignature='4/4']
 * @returns {{ notationDiv: HTMLElement, staveLayout: Array<{ noteStartX: number, noteEndX: number }>, rowDiv: HTMLElement }}
 */
export function appendRow(container, bars, showTab, timeSignature = '4/4') {
  const rowDiv = document.createElement('div');
  rowDiv.className = 'score-row';

  const { notationDiv, staveLayout } = _renderNotation(bars, timeSignature);
  rowDiv.appendChild(notationDiv);

  if (showTab) {
    const tabDiv = document.createElement('div');
    tabDiv.className = 'tab-wrapper';
    rowDiv.appendChild(tabDiv);
    renderTab(tabDiv, bars);
  }

  container.appendChild(rowDiv);
  return { notationDiv, staveLayout, rowDiv };
}
