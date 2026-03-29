// SVG score renderer – VexFlow for notation, custom SVG for tab

import { Renderer, Stave, StaveNote, Voice, Formatter } from 'https://cdn.jsdelivr.net/npm/vexflow@4.2.2/+esm';

// Fixed virtual canvas – CSS scales this to the actual container width.
// Using a wider-than-screen virtual width makes notes appear smaller on screen
// while keeping VexFlow's default coordinate system intact.
const VW      = 1000;  // virtual canvas width
const VH      = 220;   // virtual canvas height
const STAVE_Y = 85;    // y of top staff line (leaves room for clef curl above)

// First bar is wider to accommodate clef + time signature glyphs.
const FIRST_BAR_RATIO = 0.27;
const FIRST_BAR_W     = Math.round(VW * FIRST_BAR_RATIO);
const REST_BAR_W      = Math.round((VW - FIRST_BAR_W) / 3);

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
      x: 10, y: 4 + i * STR_SP,
      fill: 'var(--color-text-muted)', 'font-size': 11, 'font-weight': 700,
      'text-anchor': 'middle', 'dominant-baseline': 'middle',
    }, char));
  }

  for (let s = 0; s < STR_COUNT; s++) {
    svg.appendChild(tabEl('line', {
      x1: TAB_STAFF_L, y1: 4 + s * STR_SP,
      x2: TAB_STAFF_R, y2: 4 + s * STR_SP,
      stroke: 'var(--color-border)', 'stroke-width': 1,
    }));
  }

  const barW = (TAB_STAFF_R - TAB_STAFF_L) / 4;
  for (let i = 0; i <= 4; i++) {
    const x = TAB_STAFF_L + i * barW;
    svg.appendChild(tabEl('line', {
      x1: x, y1: 0, x2: x, y2: (STR_COUNT - 1) * STR_SP + 8,
      stroke: 'var(--color-border)', 'stroke-width': i === 0 || i === 4 ? 2 : 1,
    }));
  }

  const beatSpacing = barW / 5;
  for (let bi = 0; bi < bars.length; bi++) {
    for (let ni = 0; ni < bars[bi].length; ni++) {
      const note = bars[bi][ni];
      const x    = TAB_STAFF_L + bi * barW + beatSpacing * (ni + 1);
      const sy   = 4 + (note.string - 1) * STR_SP;
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
 * Renders the 4-bar score into container using VexFlow for notation
 * and custom SVG for the optional tab section below.
 * @param {HTMLElement} container
 * @param {Array<Array<object>>} bars
 * @param {boolean} showTab
 */
export function renderScore(container, bars, showTab) {
  container.innerHTML = '';

  // ── Notation section (VexFlow) ──────────────────────────────────────────
  const notationDiv = document.createElement('div');
  notationDiv.className = 'notation-wrapper';
  container.appendChild(notationDiv);

  const renderer = new Renderer(notationDiv, Renderer.Backends.SVG);
  renderer.resize(VW, VH);
  const ctx = renderer.getContext();

  // Match dark theme
  const style = getComputedStyle(document.documentElement);
  const fg    = style.getPropertyValue('--color-text').trim() || '#eaeaea';
  ctx.setFillStyle(fg);
  ctx.setStrokeStyle(fg);

  // Make SVG responsive: fix viewBox so CSS `width:100%; height:auto` scales correctly
  const vfSvg = notationDiv.querySelector('svg');
  if (vfSvg) {
    vfSvg.setAttribute('viewBox', `0 0 ${VW} ${VH}`);
    vfSvg.setAttribute('width', '100%');
    vfSvg.removeAttribute('height');
    vfSvg.style.display = 'block';
    vfSvg.style.height  = 'auto';
  }

  // ── Draw staves ─────────────────────────────────────────────────────────
  const staves = [];
  let x = 0;

  for (let bi = 0; bi < bars.length; bi++) {
    const w     = bi === 0 ? FIRST_BAR_W : REST_BAR_W;
    const stave = new Stave(x, STAVE_Y, w);

    if (bi === 0) stave.addClef('treble').addTimeSignature('4/4');
    if (bi === bars.length - 1) {
      // End barline – wrap in try/catch since enum values differ across VF versions
      try { stave.setEndBarType(3); } catch (_) {}
    }

    stave.setContext(ctx).draw();
    staves.push(stave);
    x += w;
  }

  // ── Draw notes per bar ──────────────────────────────────────────────────
  for (let bi = 0; bi < bars.length; bi++) {
    const notes = bars[bi].map(n =>
      new StaveNote({ clef: 'treble', keys: [n.vfKey], duration: 'q' })
    );

    const voice = new Voice({ num_beats: 4, beat_value: 4 });
    try { voice.setMode(Voice.Mode.SOFT); } catch (_) {}
    voice.addTickables(notes);

    const w = bi === 0 ? FIRST_BAR_W : REST_BAR_W;
    // Use w*0.7 as formatter width → notes cluster more tightly within each bar
    new Formatter().joinVoices([voice]).format([voice], w * 0.7);
    voice.draw(ctx, staves[bi]);
  }

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

  // ── Tab section (custom SVG) ────────────────────────────────────────────
  if (showTab) {
    const tabDiv = document.createElement('div');
    tabDiv.className = 'tab-wrapper';
    container.appendChild(tabDiv);
    renderTab(tabDiv, bars);
  }
}
