/**
 * playbackBar.js
 * SVG overlay that shows a vertical playback bar (cursor) moving across the
 * sheet music in sync with the metronome.
 *
 * Coordinates are in VexFlow viewBox units (default: 640 × 240).
 * The overlay SVG is positioned absolutely over the notation wrapper div,
 * so the notation wrapper must have `position: relative`.
 */

/**
 * Calculates the x-position of a beat in VexFlow viewBox coordinates.
 * Evenly distributes beat positions across the note area of the given bar.
 *
 * @param {Array<{ noteStartX: number, noteEndX: number }>} staveLayout
 *        One entry per bar; values are absolute x in viewBox units.
 * @param {number} barIndex   0-based bar index
 * @param {number} beatIndex  0-based beat index within the bar
 * @param {number} beatsPerBar
 * @returns {number|null}  x in viewBox units, or null if barIndex is out of range
 */
export function calcBeatX(staveLayout, barIndex, beatIndex, beatsPerBar) {
  if (!staveLayout || barIndex < 0 || barIndex >= staveLayout.length) return null;
  const { noteStartX } = staveLayout[barIndex];
  // Use the narrowest note area across all bars so every bar gets the same
  // beat step width. Bar 0 has a wider area (clef + time signature take up
  // space), which would otherwise make its notes appear more spread out.
  const uniformNoteArea = Math.min(...staveLayout.map(b => b.noteEndX - b.noteStartX));
  return noteStartX + (beatIndex / beatsPerBar) * uniformNoteArea;
}

/**
 * Manages the visual playback bar overlay.
 */
export class PlaybackBar {
  constructor() {
    /** @type {SVGSVGElement|null} */
    this._svg = null;
    /** @type {SVGRectElement|null} */
    this._rect = null;
    /** @type {Array<{ noteStartX: number, noteEndX: number }>|null} */
    this._staveLayout = null;
    this._vw = 640;
    this._vh = 240;
  }

  /**
   * Creates (or replaces) the SVG overlay inside the given container.
   * The container must have `position: relative` for the overlay to work.
   *
   * @param {HTMLElement} container - The notation wrapper div
   * @param {Array<{ noteStartX: number, noteEndX: number }>} staveLayout
   * @param {number} [vw=640]  VexFlow viewBox width
   * @param {number} [vh=240]  VexFlow viewBox height
   */
  render(container, staveLayout, vw = 640, vh = 240) {
    // Remove any previous overlay
    this._svg?.remove();

    this._staveLayout = staveLayout;
    this._vw = vw;
    this._vh = vh;

    const ns = 'http://www.w3.org/2000/svg';
    const svg = document.createElementNS(ns, 'svg');
    svg.setAttribute('viewBox', `0 0 ${vw} ${vh}`);
    svg.setAttribute('width', '100%');
    svg.setAttribute('height', 'auto');
    svg.setAttribute('aria-hidden', 'true');
    svg.classList.add('playback-bar-svg');

    // Thin vertical rect (2 viewBox units wide) as the cursor
    const rect = document.createElementNS(ns, 'rect');
    rect.setAttribute('x', '0');
    rect.setAttribute('y', '0');
    rect.setAttribute('width', '2');
    rect.setAttribute('height', String(vh));
    rect.setAttribute('fill', 'var(--color-accent, #e8334a)');
    rect.setAttribute('opacity', '0.7');
    rect.classList.add('playback-rect');

    svg.appendChild(rect);
    container.appendChild(svg);

    this._svg = svg;
    this._rect = rect;
  }

  /**
   * Moves the playback bar to the position of the given beat.
   * Adjusts the CSS transition duration to match the current beat interval.
   *
   * @param {number} barIndex
   * @param {number} beatIndex
   * @param {number} beatsPerBar
   * @param {number} [beatDurationSec=0.5]  Duration of one beat in seconds
   */
  moveToBeat(barIndex, beatIndex, beatsPerBar, beatDurationSec = 0.5) {
    if (!this._rect || !this._staveLayout) return;
    const x = calcBeatX(this._staveLayout, barIndex, beatIndex, beatsPerBar);
    if (x === null) return;

    // Transition duration = 80% of the beat interval so the bar always reaches
    // the target before the next beat fires (prevents drift accumulation).
    const transitionSec = (beatDurationSec * 0.8).toFixed(3);
    this._rect.style.transition = `x ${transitionSec}s linear`;
    this._rect.setAttribute('x', String(x));
  }

  /** Shows the overlay (called when playback starts). */
  show() {
    if (this._svg) this._svg.classList.remove('playback-bar-hidden');
  }

  /** Hides the overlay (called when playback stops). */
  hide() {
    if (this._svg) this._svg.classList.add('playback-bar-hidden');
  }

  /** Removes the overlay SVG from the DOM entirely. */
  destroy() {
    this._svg?.remove();
    this._svg  = null;
    this._rect = null;
    this._staveLayout = null;
  }
}
