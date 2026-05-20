/**
 * <gt-string-toggles> — guitar string toggle button row.
 *
 * Renders six buttons (E2–E4). The user can toggle any string on/off
 * (at least one must stay active). Fires a `string-change` event on each toggle.
 *
 * Properties:
 *   activeStrings {number[]} — get or set the active string indices (0–5).
 *
 * Events:
 *   string-change — CustomEvent, detail: { activeStrings: number[] }
 */

const STRING_LABELS = ['E2', 'A2', 'D3', 'G3', 'B3', 'E4'];

export class GtStringToggles extends HTMLElement {
  constructor() {
    super();
    this._active = [0, 1, 2, 3, 4, 5];
  }

  connectedCallback() {
    this.classList.add('string-toggles');
    this.innerHTML = STRING_LABELS.map((label, i) =>
      `<button class="btn-string active" data-string="${i}">${label}</button>`
    ).join('');
    this.addEventListener('click', this._handleClick.bind(this));
  }

  _handleClick(e) {
    const btn = e.target.closest('.btn-string');
    if (!btn) return;
    const idx = parseInt(btn.dataset.string, 10);
    if (this._active.includes(idx)) {
      if (this._active.length > 1) {
        this._active.splice(this._active.indexOf(idx), 1);
        btn.classList.remove('active');
      }
    } else {
      this._active.push(idx);
      this._active.sort((a, b) => a - b);
      btn.classList.add('active');
    }
    this.dispatchEvent(new CustomEvent('string-change', {
      detail: { activeStrings: [...this._active] },
      bubbles: true,
    }));
  }

  get activeStrings() {
    return [...this._active];
  }

  set activeStrings(arr) {
    this._active = [...arr].sort((a, b) => a - b);
    this.querySelectorAll('.btn-string').forEach(btn => {
      btn.classList.toggle('active', this._active.includes(parseInt(btn.dataset.string, 10)));
    });
  }
}

customElements.define('gt-string-toggles', GtStringToggles);
