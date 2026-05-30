// SVG score renderer – VexFlow for notation, custom SVG for tab

import { Renderer, Stave, StaveNote, Voice, Formatter, Accidental } from 'https://cdn.jsdelivr.net/npm/vexflow@4.2.2/+esm';
import { getTimeSignatureConfig, calcFirstBarWidth } from './sheetMusicLogic.js';

// Fixed virtual canvas – CSS scales this to the actual container width.
const VH      = 240;   // extra height prevents clef-curl clipping above and ledger-line clipping below
const STAVE_Y = 80;    // y of top staff line (leaves 80 px for clef curl; low notes at ~155 px)

// Bar widths: REST_BAR_W is derived from the desired note area; FIRST_BAR_W is
// computed dynamically after VexFlow reports the actual clef+time-sig width so
// bar 0's note area equals that of bars 1–3 (no trailing-gap asymmetry).
const REST_BAR_W = 128;

// Tab constants (custom SVG below VexFlow notation)
const TAB_STAFF_TOP = 12;
const TAB_STAFF_BOTTOM_PAD = 26;
const TAB_LABEL_X = 12;
const TAB_LABEL_SIZE = 16;
const TAB_FRET_FONT_SIZE = 16;
const TAB_FRET_BOX_HEIGHT = 18;
const TAB_LINE_STROKE = 1.75;
const TAB_OUTER_BAR_STROKE = 2.75;
const TAB_INNER_BAR_STROKE = 1.75;
const STR_SP = 21;
const STR_COUNT = 6;
const STATUS_COLORS = {
  correct: '#2ecc71',
  wrong: '#e74c3c',
  current: '#ff6b35',
};

function tabEl(tag, attrs = {}, text) {
  const e = document.createElementNS('http://www.w3.org/2000/svg', tag);
  for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, String(v));
  if (text != null) e.textContent = text;
  return e;
}

function accidentalFromVfKey(vfKey) {
  const match = /^([a-g])([#b])\//.exec(vfKey ?? '');
  return match?.[2] ?? null;
}

function renderTab(tabDiv, bars, staveLayout = [], viewBoxWidth = REST_BAR_W * Math.max(bars.length, 1)) {
  tabDiv.innerHTML = '';

  const safeBarCount = Math.max(bars.length, 1);
  const fallbackViewBoxWidth = REST_BAR_W * safeBarCount;
  const safeViewBoxWidth = Number.isFinite(viewBoxWidth) && viewBoxWidth > 0
    ? viewBoxWidth
    : fallbackViewBoxWidth;
  const staffBottomY = TAB_STAFF_TOP + (STR_COUNT - 1) * STR_SP;
  const barLineBottomY = staffBottomY + 8;
  const vbH = staffBottomY + TAB_STAFF_BOTTOM_PAD;
  const svg = tabEl('svg', {
    viewBox: `0 0 ${safeViewBoxWidth} ${vbH}`,
    width: '100%',
    height: 'auto',
  });

  svg.appendChild(tabEl('rect', {
    x: 0, y: 0, width: safeViewBoxWidth, height: vbH,
    fill: 'var(--color-surface)', rx: 8,
  }));

  for (let s = 0; s < STR_COUNT; s++) {
    svg.appendChild(tabEl('line', {
      x1: 0, y1: TAB_STAFF_TOP + s * STR_SP,
      x2: safeViewBoxWidth, y2: TAB_STAFF_TOP + s * STR_SP,
      stroke: 'var(--color-border)', 'stroke-width': TAB_LINE_STROKE,
    }));
  }

  for (const [char, i] of [['T', 0], ['A', 1], ['B', 2]]) {
    svg.appendChild(tabEl('text', {
      x: TAB_LABEL_X, y: TAB_STAFF_TOP + i * STR_SP,
      fill: 'var(--color-text-muted)', 'font-size': TAB_LABEL_SIZE, 'font-weight': 700,
      'text-anchor': 'middle', 'dominant-baseline': 'middle',
    }, char));
  }

  const fallbackBarWidth = safeViewBoxWidth / safeBarCount;
  for (let i = 0; i <= bars.length; i++) {
    const x = i === bars.length
      ? safeViewBoxWidth
      : (staveLayout[i]?.barStartX ?? (fallbackBarWidth * i));
    svg.appendChild(tabEl('line', {
      x1: x, y1: 0, x2: x, y2: barLineBottomY,
      stroke: 'var(--color-border)',
      'stroke-width': i === 0 || i === bars.length ? TAB_OUTER_BAR_STROKE : TAB_INNER_BAR_STROKE,
    }));
  }

  for (let bi = 0; bi < bars.length; bi++) {
    const layout = staveLayout[bi] ?? {};
    const fallbackBarStartX = fallbackBarWidth * bi;
    const fallbackBarEndX = fallbackBarStartX + fallbackBarWidth;
    const barStartX = layout.barStartX ?? fallbackBarStartX;
    const barEndX = layout.barEndX ?? fallbackBarEndX;
    const noteStartX = layout.noteStartX ?? barStartX;
    const noteEndX = layout.noteEndX ?? barEndX;
    const usableStartX = Number.isFinite(noteStartX) ? noteStartX : barStartX;
    const usableEndX = Number.isFinite(noteEndX) && noteEndX > usableStartX ? noteEndX : barEndX;
    const noteSlotWidth = (usableEndX - usableStartX) / Math.max(bars[bi].length, 1);
    for (let ni = 0; ni < bars[bi].length; ni++) {
      const note = bars[bi][ni];
      const x = usableStartX + noteSlotWidth * (ni + 0.5);
      const sy = TAB_STAFF_TOP + (note.string - 1) * STR_SP;
      const txt = String(note.fret);
      const bgW = txt.length > 1 ? 22 : 16;
      const color = STATUS_COLORS[note.status] ?? null;

      svg.appendChild(tabEl('rect', {
        x: x - bgW / 2, y: sy - (TAB_FRET_BOX_HEIGHT / 2), width: bgW, height: TAB_FRET_BOX_HEIGHT,
        fill: 'var(--color-surface)',
      }));
      svg.appendChild(tabEl('text', {
        x, y: sy,
        fill: color ?? 'var(--color-text)', 'font-size': TAB_FRET_FONT_SIZE, 'font-family': 'monospace',
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
 * @param {string[]|null} [barLabels] - Optional chord names to display above each bar
 * @returns {{ notationDiv: HTMLElement, staveLayout: Array<{ noteStartX: number, noteEndX: number }>, vw: number }}
 */
function _renderNotation(bars, timeSignature = '4/4', barLabels = null) {
  const tsConfig = getTimeSignatureConfig(timeSignature) || getTimeSignatureConfig('4/4');
  const { vfTimeSig, noteDuration, beatsPerBar } = tsConfig;
  const beatValue = noteDuration === 'e' ? 8 : 4;
  const vexflowDuration = noteDuration === 'e' ? '8' : noteDuration;

  // Probe VexFlow to get the actual clef+time-sig width (tsw) and the bare
  // leading margin (marginW) for the current time signature, without drawing.
  const probeBar0 = new Stave(0, 0, 9999).addClef('treble').addTimeSignature(vfTimeSig);
  const probeBar1 = new Stave(0, 0, 9999);
  const tsw     = probeBar0.getNoteStartX();   // ≈ 90 for 4/4
  const marginW = probeBar1.getNoteStartX();   // ≈ 10 (bare stave margin)

  const firstBarW = calcFirstBarWidth(tsw, REST_BAR_W, marginW);
  const actualVW  = firstBarW + (bars.length - 1) * REST_BAR_W;

  // position:relative so PlaybackBar can overlay its SVG cursor on top.
  const notationDiv = document.createElement('div');
  notationDiv.className = 'notation-wrapper';

  const renderer = new Renderer(notationDiv, Renderer.Backends.SVG);
  renderer.resize(actualVW, VH);
  const ctx = renderer.getContext();

  // Match dark theme
  const style = getComputedStyle(document.documentElement);
  const fg    = style.getPropertyValue('--color-text').trim() || '#2d2d2d';
  ctx.setFillStyle(fg);
  ctx.setStrokeStyle(fg);

  // Make SVG responsive.
  // removeAttribute('height') strips VexFlow's pixel height so CSS height:auto
  // takes effect in all browsers (Firefox ignores style.height when the attribute is present).
  const vfSvg = notationDiv.querySelector('svg');
  const applyResponsive = () => {
    if (!vfSvg) return;
    vfSvg.setAttribute('viewBox', `0 0 ${actualVW} ${VH}`);
    vfSvg.setAttribute('width', '100%');
    vfSvg.removeAttribute('height');
    vfSvg.style.width   = '100%';
    vfSvg.style.height  = 'auto';
    vfSvg.style.display = 'block';
  };
  applyResponsive();

  // ── Draw staves ─────────────────────────────────────────────────────────
  const staves = [];
  let x = 0;

  for (let bi = 0; bi < bars.length; bi++) {
    const w     = bi === 0 ? firstBarW : REST_BAR_W;
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
  // All bars now have the same note area (REST_BAR_W - marginW) because
  // firstBarW was computed via calcFirstBarWidth to equalise the trailing gap.
  const uniformNoteArea = REST_BAR_W - marginW;

  for (let bi = 0; bi < bars.length; bi++) {
    const stave = staves[bi];
    const notes = bars[bi].map(n => {
      const staveNote = new StaveNote({ clef: 'treble', keys: [n.vfKey], duration: vexflowDuration });
      const accidental = accidentalFromVfKey(n.vfKey);
      if (accidental) {
        staveNote.addModifier(new Accidental(accidental), 0);
      }
      const color = STATUS_COLORS[n.status] ?? null;
      if (color) {
        try {
          staveNote.setStyle({ fillStyle: color, strokeStyle: color });
        } catch { /* ignore if unsupported */ }
        try {
          staveNote.setKeyStyle(0, { fillStyle: color, strokeStyle: color });
        } catch { /* ignore */ }
      }
      return staveNote;
    });

    const voice = new Voice({ num_beats: beatsPerBar, beat_value: beatValue });
    try { voice.setMode(Voice.Mode.SOFT); } catch { /* VexFlow version compatibility */ }
    voice.addTickables(notes);

    new Formatter().joinVoices([voice]).format([voice], uniformNoteArea * 0.90);
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
  // noteEndX:   noteStartX + uniformNoteArea (same for every bar).
  const { layout: staveLayout } = staves.reduce((acc, stave, barIndex) => {
    const barWidth = barIndex === 0 ? firstBarW : REST_BAR_W;
    const nextBarStartX = acc.barStartX + barWidth;
    acc.layout.push({
      barStartX: acc.barStartX,
      barEndX: nextBarStartX,
      noteStartX: stave.getNoteStartX(),
      noteEndX: stave.getNoteStartX() + uniformNoteArea,
    });
    acc.barStartX = nextBarStartX;
    return acc;
  }, { barStartX: 0, layout: [] });

  // ── Render optional chord labels above each bar ─────────────────────────
  if (barLabels && barLabels.length > 0 && vfSvg) {
    let barX = 0;
    for (let bi = 0; bi < bars.length; bi++) {
      const label = barLabels[bi];
      if (!label) { barX += bi === 0 ? firstBarW : REST_BAR_W; continue; }
      const barW = bi === 0 ? firstBarW : REST_BAR_W;
      const cx = barX + barW / 2;
      const textEl = document.createElementNS('http://www.w3.org/2000/svg', 'text');
      textEl.setAttribute('x', String(cx));
      textEl.setAttribute('y', '16');
      textEl.setAttribute('text-anchor', 'middle');
      textEl.setAttribute('dominant-baseline', 'middle');
      textEl.setAttribute('font-size', '15');
      textEl.setAttribute('font-weight', 'bold');
      textEl.setAttribute('fill', fg);
      textEl.textContent = label;
      vfSvg.appendChild(textEl);
      barX += barW;
    }
  }

  return { notationDiv, staveLayout, vw: actualVW };
}

/**
 * Renders a 4-bar score into container (normal mode — clears existing content).
 *
 * @param {HTMLElement} container
 * @param {Array<Array<object>>} bars
 * @param {boolean} showTab
 * @param {string} [timeSignature='4/4']
 * @param {string[]|null} [barLabels] - Optional chord names to display above each bar
 * @returns {{ notationDiv: HTMLElement, staveLayout: Array<{ noteStartX: number, noteEndX: number }>, vw: number }}
 */
export function renderScore(container, bars, showTab, timeSignature = '4/4', barLabels = null) {
  container.innerHTML = '';

  const { notationDiv, staveLayout, vw } = _renderNotation(bars, timeSignature, barLabels);
  container.appendChild(notationDiv);

  if (showTab) {
    const tabDiv = document.createElement('div');
    tabDiv.className = 'tab-wrapper';
    container.appendChild(tabDiv);
    renderTab(tabDiv, bars, staveLayout, vw);
  }

  return { notationDiv, staveLayout, vw };
}

/**
 * Appends a new row of bars to container (endless mode — does not clear existing content).
 * Each row is wrapped in a .score-row div so scroll position can be tracked per-row.
 *
 * @param {HTMLElement} container
 * @param {Array<Array<object>>} bars
 * @param {boolean} showTab
 * @param {string} [timeSignature='4/4']
 * @param {string[]|null} [barLabels] - Optional chord names to display above each bar
 * @returns {{ notationDiv: HTMLElement, staveLayout: Array<{ noteStartX: number, noteEndX: number }>, rowDiv: HTMLElement, vw: number }}
 */
export function appendRow(container, bars, showTab, timeSignature = '4/4', barLabels = null) {
  const rowDiv = document.createElement('div');
  rowDiv.className = 'score-row';

  const { notationDiv, staveLayout, vw } = _renderNotation(bars, timeSignature, barLabels);
  rowDiv.appendChild(notationDiv);

  if (showTab) {
    const tabDiv = document.createElement('div');
    tabDiv.className = 'tab-wrapper';
    rowDiv.appendChild(tabDiv);
    renderTab(tabDiv, bars, staveLayout, vw);
  }

  container.appendChild(rowDiv);
  return { notationDiv, staveLayout, rowDiv, vw };
}
