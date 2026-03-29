// SVG score renderer – VexFlow for notation, custom SVG for tab

const VEXFLOW_CDN = 'https://cdn.jsdelivr.net/npm/vexflow@4.2.2/build/cjs/vexflow-min.js';

// Tab constants (custom SVG below VexFlow notation)
const TAB_VB_W   = 815;
const TAB_STAFF_L = 20;
const TAB_STAFF_R = 805;
const STR_SP     = 13;
const STR_COUNT  = 6;

function tabEl(tag, attrs = {}, text) {
  const e = document.createElementNS('http://www.w3.org/2000/svg', tag);
  for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, String(v));
  if (text != null) e.textContent = text;
  return e;
}

function noteX(bar, beat, barW, firstBarW) {
  // First bar is wider (clef + time sig take space)
  const x = bar === 0
    ? firstBarW * 0.35 + beat * (firstBarW * 0.65 / 4)
    : firstBarW + (bar - 1) * barW + barW * 0.15 + beat * (barW * 0.85 / 4);
  return x;
}

/** Renders custom SVG tab section into tabDiv. */
function renderTab(tabDiv, bars, totalW) {
  tabDiv.innerHTML = '';

  const vbH = (STR_COUNT - 1) * STR_SP + 28;
  const svg = tabEl('svg', {
    viewBox: `0 0 ${TAB_VB_W} ${vbH}`,
    width: '100%',
    height: 'auto',
  });

  // Background
  svg.appendChild(tabEl('rect', {
    x: 0, y: 0, width: TAB_VB_W, height: vbH,
    fill: 'var(--color-surface)', rx: 6,
  }));

  // "T A B" label on first 3 string lines
  for (const [char, i] of [['T', 0], ['A', 1], ['B', 2]]) {
    svg.appendChild(tabEl('text', {
      x: 10, y: 4 + i * STR_SP,
      fill: 'var(--color-text-muted)', 'font-size': 11, 'font-weight': 700,
      'text-anchor': 'middle', 'dominant-baseline': 'middle',
    }, char));
  }

  // 6 string lines
  for (let s = 0; s < STR_COUNT; s++) {
    svg.appendChild(tabEl('line', {
      x1: TAB_STAFF_L, y1: 4 + s * STR_SP,
      x2: TAB_STAFF_R, y2: 4 + s * STR_SP,
      stroke: 'var(--color-border)', 'stroke-width': 1,
    }));
  }

  // Bar dividers (approximate alignment with notation above)
  const barW = (TAB_STAFF_R - TAB_STAFF_L) / 4;
  for (let i = 0; i <= 4; i++) {
    const x = TAB_STAFF_L + i * barW;
    svg.appendChild(tabEl('line', {
      x1: x, y1: 0, x2: x, y2: (STR_COUNT - 1) * STR_SP + 8,
      stroke: 'var(--color-border)', 'stroke-width': i === 0 || i === 4 ? 2 : 1,
    }));
  }

  // Fret numbers – evenly spaced within each bar
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

  const { Renderer, Stave, StaveNote, Voice, Formatter } = window.VexFlow;

  // ── Notation section (VexFlow) ──────────────────────────────────────────
  const notationDiv = document.createElement('div');
  notationDiv.className = 'notation-wrapper';
  container.appendChild(notationDiv);

  const totalW   = container.clientWidth || 800;
  const height   = 180;
  const renderer = new Renderer(notationDiv, Renderer.Backends.SVG);
  renderer.resize(totalW, height);

  const ctx = renderer.getContext();

  // Match dark theme
  const style  = getComputedStyle(document.documentElement);
  const fg     = style.getPropertyValue('--color-text').trim()    || '#eaeaea';
  const muted  = style.getPropertyValue('--color-text-muted').trim() || '#8892a4';
  ctx.setFillStyle(fg);
  ctx.setStrokeStyle(fg);
  ctx.setFont('Arial', 10, '');

  // Style the VexFlow SVG to match the app
  const vfSvg = notationDiv.querySelector('svg');
  if (vfSvg) {
    vfSvg.style.background = 'transparent';
    vfSvg.style.display    = 'block';
    vfSvg.style.width      = '100%';
    vfSvg.style.height     = 'auto';
  }

  // Layout: first bar is wider because it holds the clef + time signature
  const firstBarW = Math.round(totalW * 0.29);
  const restBarW  = Math.round((totalW - firstBarW) / 3);
  const staveY    = 30;

  const staves = [];
  let currentX = 0;

  for (let bi = 0; bi < bars.length; bi++) {
    const w = bi === 0 ? firstBarW : restBarW;
    const stave = new Stave(currentX, staveY, w);
    if (bi === 0) stave.addClef('treble').addTimeSignature('4/4');
    stave.setContext(ctx).draw();
    staves.push(stave);
    currentX += w;
  }

  // Close with double bar on last stave
  staves[3].setEndBarType(3); // DOUBLE = 3

  // Draw notes per bar
  for (let bi = 0; bi < bars.length; bi++) {
    const notes = bars[bi].map(n =>
      new StaveNote({ clef: 'treble', keys: [n.vfKey], duration: 'q' })
    );

    const voice = new Voice({ num_beats: 4, beat_value: 4 });
    voice.setMode(Voice.Mode.SOFT); // don't throw on beat mismatch
    voice.addTickables(notes);

    const w = bi === 0 ? firstBarW : restBarW;
    new Formatter().joinVoices([voice]).format([voice], w - 25);
    voice.draw(ctx, staves[bi]);
  }

  // Override VexFlow's hardcoded black fills/strokes to match theme
  if (vfSvg) {
    vfSvg.querySelectorAll('[fill="black"], [fill="#000000"]')
      .forEach(el => el.setAttribute('fill', fg));
    vfSvg.querySelectorAll('[stroke="black"], [stroke="#000000"]')
      .forEach(el => el.setAttribute('stroke', fg));
    // Time signature and clef labels
    vfSvg.querySelectorAll('text')
      .forEach(el => { if (!el.getAttribute('fill') || el.getAttribute('fill') === 'black') el.setAttribute('fill', fg); });
  }

  // ── Tab section (custom SVG) ────────────────────────────────────────────
  if (showTab) {
    const tabDiv = document.createElement('div');
    tabDiv.className = 'tab-wrapper';
    container.appendChild(tabDiv);
    renderTab(tabDiv, bars, totalW);
  }
}
