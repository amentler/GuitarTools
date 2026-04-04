// SVG score renderer for the Sheet-Music-Mic exercise.
// Extends sheetMusicSVG with per-note colour based on status:
//   'pending' → theme foreground (default)
//   'current' → accent colour (yellow/orange)
//   'correct' → green
//   'wrong'   → red

import { Renderer, Stave, StaveNote, Voice, Formatter } from 'https://cdn.jsdelivr.net/npm/vexflow@4.2.2/+esm';

// Fixed virtual canvas – same dimensions as sheetMusicSVG for visual consistency.
const VW           = 640;
const VH           = 240;
const STAVE_Y      = 80;
const FIRST_BAR_RATIO = 0.40;
const FIRST_BAR_W  = Math.round(VW * FIRST_BAR_RATIO);
const REST_BAR_W   = Math.floor((VW - FIRST_BAR_W) / 3);

const STATUS_COLORS = {
  correct: '#4caf50',
  wrong:   '#f44336',
  current: '#f5a623',
};

/**
 * Renders a 4-bar score with per-note colour based on each note's `status` field.
 * @param {HTMLElement} container
 * @param {Array<Array<{vfKey: string, status?: string, [key: string]: any}>>} bars
 */
export function renderScoreWithStatus(container, bars) {
  container.innerHTML = '';

  const notationDiv = document.createElement('div');
  notationDiv.className = 'notation-wrapper';
  container.appendChild(notationDiv);

  const renderer = new Renderer(notationDiv, Renderer.Backends.SVG);
  renderer.resize(VW, VH);
  const ctx = renderer.getContext();

  const style = getComputedStyle(document.documentElement);
  const fg    = style.getPropertyValue('--color-text').trim() || '#eaeaea';
  ctx.setFillStyle(fg);
  ctx.setStrokeStyle(fg);

  // ── Draw staves ────────────────────────────────────────────────────────
  const staves = [];
  let x = 0;

  for (let bi = 0; bi < bars.length; bi++) {
    const w     = bi === 0 ? FIRST_BAR_W : REST_BAR_W;
    const stave = new Stave(x, STAVE_Y, w);

    if (bi === 0) stave.addClef('treble').addTimeSignature('4/4');
    if (bi === bars.length - 1) {
      try { stave.setEndBarType(3); } catch { /* VexFlow version compatibility */ }
    }

    stave.setContext(ctx).draw();
    staves.push(stave);
    x += w;
  }

  // ── Draw notes per bar ─────────────────────────────────────────────────
  for (let bi = 0; bi < bars.length; bi++) {
    const stave = staves[bi];
    const notes = bars[bi].map(n => {
      const sn = new StaveNote({ clef: 'treble', keys: [n.vfKey], duration: 'q' });

      const color = STATUS_COLORS[n.status] ?? null;
      if (color) {
        try {
          sn.setStyle({ fillStyle: color, strokeStyle: color });
        } catch { /* ignore if unsupported */ }
        try {
          sn.setKeyStyle(0, { fillStyle: color, strokeStyle: color });
        } catch { /* ignore */ }
      }
      return sn;
    });

    const voice = new Voice({ num_beats: 4, beat_value: 4 });
    try { voice.setMode(Voice.Mode.SOFT); } catch { /* VexFlow version compatibility */ }
    voice.addTickables(notes);

    const noteAreaW = stave.getX() + stave.getWidth() - stave.getNoteStartX();
    new Formatter().joinVoices([voice]).format([voice], noteAreaW * 0.90);
    voice.draw(ctx, stave);
  }

  // ── Make SVG responsive ────────────────────────────────────────────────
  const vfSvg = notationDiv.querySelector('svg');
  if (vfSvg) {
    vfSvg.setAttribute('viewBox', `0 0 ${VW} ${VH}`);
    vfSvg.setAttribute('width', '100%');
    vfSvg.setAttribute('height', 'auto');
    vfSvg.style.width   = '100%';
    vfSvg.style.height  = 'auto';
    vfSvg.style.display = 'block';

    // Override VexFlow hardcoded black for dark theme (leave coloured notes alone)
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
