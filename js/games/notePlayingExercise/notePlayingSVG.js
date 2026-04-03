// Single-note notation renderer for the note-playing exercise.
// Uses VexFlow to render a treble-clef staff with one whole note.

import {
  Renderer, Stave, StaveNote, Voice, Formatter, Accidental,
} from 'https://cdn.jsdelivr.net/npm/vexflow@4.2.2/+esm';

// ── Note → VexFlow key mapping ────────────────────────────────────────────────
// All 12 chromatic notes mapped to positions within the treble clef staff.
// Standard treble clef lines (bottom→top): E4, G4, B4, D5, F5
//   E4 = 1st line (lowest line on staff – not a ledger line)
//   F4 = 1st space
//   G4 = 2nd line, A4 = 2nd space, B4 = 3rd line
//   C5 = 3rd space, D5 = 4th line
// All 12 notes fit within the staff (no ledger lines needed).
const NOTE_TO_VF = {
  'C':  'c/5',
  'C#': 'c#/5',
  'D':  'd/5',
  'D#': 'd#/5',
  'E':  'e/4',
  'F':  'f/4',
  'F#': 'f#/4',
  'G':  'g/4',
  'G#': 'g#/4',
  'A':  'a/4',
  'A#': 'a#/4',
  'B':  'b/4',
};

// ── Virtual canvas dimensions ─────────────────────────────────────────────────
const VW      = 300;
const VH      = 150;
const STAVE_Y = 50;
const STAVE_X = 10;
const STAVE_W = VW - 20;

function applyDarkTheme(container) {
  const svg = container.querySelector('svg');
  if (!svg) return;

  const style = getComputedStyle(document.documentElement);
  const fg    = style.getPropertyValue('--color-text').trim() || '#eaeaea';

  svg.setAttribute('viewBox', `0 0 ${VW} ${VH}`);
  svg.setAttribute('width',   '100%');
  svg.setAttribute('height',  'auto');
  svg.style.width   = '100%';
  svg.style.height  = 'auto';
  svg.style.display = 'block';

  svg.querySelectorAll('[fill="black"],[fill="#000000"]')
    .forEach(el => el.setAttribute('fill', fg));
  svg.querySelectorAll('[stroke="black"],[stroke="#000000"]')
    .forEach(el => el.setAttribute('stroke', fg));
  svg.querySelectorAll('text').forEach(el => {
    const f = el.getAttribute('fill');
    if (!f || f === 'black' || f === '#000000') el.setAttribute('fill', fg);
  });
}

/**
 * Renders a single whole note in treble clef notation into `container`.
 * Clears `container` before rendering.
 *
 * @param {HTMLElement} container - Target DOM element.
 * @param {string|null} noteName  - Note name like 'C#', 'G', or null for empty staff.
 */
export function renderSingleNote(container, noteName) {
  container.innerHTML = '';

  const style = getComputedStyle(document.documentElement);
  const fg    = style.getPropertyValue('--color-text').trim() || '#eaeaea';

  const renderer = new Renderer(container, Renderer.Backends.SVG);
  renderer.resize(VW, VH);

  const ctx = renderer.getContext();
  ctx.setFillStyle(fg);
  ctx.setStrokeStyle(fg);

  const stave = new Stave(STAVE_X, STAVE_Y, STAVE_W);
  stave.addClef('treble');
  stave.setContext(ctx).draw();

  const vfKey = noteName ? NOTE_TO_VF[noteName] : null;
  if (vfKey) {
    const note = new StaveNote({ clef: 'treble', keys: [vfKey], duration: 'w' });

    if (noteName.endsWith('#')) {
      note.addModifier(new Accidental('#'));
    }

    const voice = new Voice({ num_beats: 4, beat_value: 4 });
    try { voice.setMode(Voice.Mode.SOFT); } catch { /* VexFlow version compat */ }
    voice.addTickables([note]);

    new Formatter().joinVoices([voice]).format([voice], STAVE_W - 60);
    voice.draw(ctx, stave);
  }

  applyDarkTheme(container);
}
