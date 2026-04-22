import { renderFretboard } from './gt-fretboard-render.js';
import { getNoteAtPosition } from '../../domain/fretboard/fretboardLogic.js';

/**
 * <gt-fretboard> – reusable interactive fretboard Web Component.
 *
 * Attributes (reflected as properties):
 *   frets        {number}  – Highest fret to display (default: 5).
 *   interactive  {boolean} – If present, positions are clickable.
 *
 * JS-only properties (complex data, not suitable as HTML attributes):
 *   positions    {Array<{stringIndex, fret, state?}>}
 *     Marks positions on the fretboard. `state` can be:
 *     'selected' | 'correct' | 'wrong' | 'missed'
 *   activeStrings {number[]}
 *     Indices of active strings (0 = low E, 5 = high E). Default: all 6.
 *
 * Events:
 *   fret-select  – Dispatched when a position is clicked (interactive only).
 *     detail: { stringIndex: number, fret: number, note: string }
 */
export class GtFretboard extends HTMLElement {
  constructor() {
    super();
    this._positions = [];
    this._activeStrings = [0, 1, 2, 3, 4, 5];
  }

  static get observedAttributes() {
    return ['frets', 'interactive'];
  }

  // ── Reflected attributes ────────────────────────────────────────────────────

  get frets() {
    const val = parseInt(this.getAttribute('frets'), 10);
    return Number.isFinite(val) ? val : 5;
  }

  set frets(val) {
    this.setAttribute('frets', String(val));
  }

  get interactive() {
    return this.hasAttribute('interactive');
  }

  set interactive(val) {
    if (val) this.setAttribute('interactive', '');
    else this.removeAttribute('interactive');
  }

  // ── JS-only properties ──────────────────────────────────────────────────────

  get positions() {
    return this._positions;
  }

  set positions(val) {
    this._positions = Array.isArray(val) ? val : [];
    this._render();
  }

  get activeStrings() {
    return this._activeStrings;
  }

  set activeStrings(val) {
    this._activeStrings = Array.isArray(val) ? val : [0, 1, 2, 3, 4, 5];
    this._render();
  }

  // ── Lifecycle ───────────────────────────────────────────────────────────────

  connectedCallback() {
    this._render();
  }

  attributeChangedCallback() {
    this._render();
  }

  // ── Internal ────────────────────────────────────────────────────────────────

  _render() {
    renderFretboard(this, {
      maxFret: this.frets,
      activeStrings: this._activeStrings,
      positions: this._positions,
      interactive: this.interactive,
      onSelect: (stringIndex, fret) => {
        const note = getNoteAtPosition(stringIndex, fret);
        this.dispatchEvent(new CustomEvent('fret-select', {
          detail: { stringIndex, fret, note },
          bubbles: true,
          composed: true,
        }));
      },
    });
  }
}

customElements.define('gt-fretboard', GtFretboard);
