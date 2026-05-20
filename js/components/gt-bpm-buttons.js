/**
 * <gt-bpm-buttons> — BPM adjustment button row (-5, -1, +1, +5).
 *
 * Fires a `bpm-delta` event on each click.
 *
 * Events:
 *   bpm-delta — CustomEvent, detail: { delta: number }  (-5, -1, +1, +5)
 */

export class GtBpmButtons extends HTMLElement {
  connectedCallback() {
    this.classList.add('bpm-buttons');
    this.innerHTML = [-5, -1, +1, +5].map(d =>
      `<button class="btn-bpm" data-delta="${d}">${d > 0 ? '+' : ''}${d}</button>`
    ).join('');
    this.addEventListener('click', this._handleClick.bind(this));
  }

  _handleClick(e) {
    const btn = e.target.closest('.btn-bpm');
    if (!btn) return;
    const delta = parseInt(btn.dataset.delta, 10);
    this.dispatchEvent(new CustomEvent('bpm-delta', {
      detail: { delta },
      bubbles: true,
    }));
  }
}

customElements.define('gt-bpm-buttons', GtBpmButtons);
