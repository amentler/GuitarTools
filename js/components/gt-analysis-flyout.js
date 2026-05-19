class GtAnalysisFlyout extends HTMLElement {
  static get observedAttributes() {
    return ['collapsed'];
  }

  connectedCallback() {
    this.classList.add('analysis-flyout');
    this._ensureContent();
    this._ensureToggle();
    this._syncState();
  }

  attributeChangedCallback() {
    this._syncState();
  }

  get collapsed() {
    return this.hasAttribute('collapsed');
  }

  set collapsed(value) {
    if (value) {
      this.setAttribute('collapsed', '');
    } else {
      this.removeAttribute('collapsed');
    }
  }

  _ensureContent() {
    const contentId = this.getAttribute('content-id');
    this._content = contentId
      ? this.querySelector(`#${CSS.escape(contentId)}`)
      : this.querySelector('.analysis-flyout-content');

    if (!this._content) {
      this._content = document.createElement('div');
      if (contentId) this._content.id = contentId;
      this.appendChild(this._content);
    }
    this._content.classList.add('analysis-flyout-content');
  }

  _ensureToggle() {
    const toggleId = this.getAttribute('toggle-id');
    this._toggle = toggleId
      ? this.querySelector(`#${CSS.escape(toggleId)}`)
      : this.querySelector('.analysis-flyout-toggle');

    if (!this._toggle) {
      this._toggle = document.createElement('button');
      this._toggle.type = 'button';
      if (toggleId) this._toggle.id = toggleId;
      this.insertBefore(this._toggle, this.firstElementChild);
    }

    this._toggle.classList.add('analysis-flyout-toggle');
    this._toggle.setAttribute('aria-controls', this._content.id || '');
    this._toggle.addEventListener('click', () => {
      this.collapsed = !this.collapsed;
      this.dispatchEvent(new CustomEvent('analysis-flyout-toggle', {
        bubbles: true,
        detail: { collapsed: this.collapsed },
      }));
    });
  }

  _syncState() {
    const collapsed = this.collapsed;
    const collapsedClass = this.getAttribute('collapsed-class');
    this.classList.toggle('analysis-flyout--collapsed', collapsed);
    if (collapsedClass) this.classList.toggle(collapsedClass, collapsed);

    if (this._toggle) {
      this._toggle.setAttribute('aria-expanded', collapsed ? 'false' : 'true');
      this._toggle.textContent = collapsed
        ? (this.getAttribute('expand-label') || '⌃')
        : (this.getAttribute('collapse-label') || '⌄');
    }
  }
}

if (!customElements.get('gt-analysis-flyout')) {
  customElements.define('gt-analysis-flyout', GtAnalysisFlyout);
}
