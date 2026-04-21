/**
 * Web Component for menu entries.
 * Usage: <gt-menu-card icon="🎯" title="Griffbrett" subtitle="Töne erkennen" href="#fretboard"></gt-menu-card>
 */
class GtMenuCard extends HTMLElement {
  getIconMarkup(icon) {
    if (icon === 'triad-c-major') {
      return `
        <svg viewBox="0 0 44 32" aria-hidden="true" focusable="false">
          <g fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round">
            <line x1="3" y1="7"  x2="41" y2="7"></line>
            <line x1="3" y1="11" x2="41" y2="11"></line>
            <line x1="3" y1="15" x2="41" y2="15"></line>
            <line x1="3" y1="19" x2="41" y2="19"></line>
            <line x1="3" y1="23" x2="41" y2="23"></line>
          </g>
          <g fill="currentColor">
            <ellipse cx="19" cy="23" rx="3.5" ry="2.7"></ellipse>
            <ellipse cx="19" cy="19" rx="3.5" ry="2.7"></ellipse>
            <ellipse cx="19" cy="15" rx="3.5" ry="2.7"></ellipse>
          </g>
          <line x1="22.5" y1="15" x2="22.5" y2="6" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"></line>
        </svg>
      `;
    }

    if (icon === 'triad-double') {
      return `
        <svg viewBox="0 0 44 32" aria-hidden="true" focusable="false">
          <g fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round">
            <line x1="3" y1="7"  x2="41" y2="7"></line>
            <line x1="3" y1="11" x2="41" y2="11"></line>
            <line x1="3" y1="15" x2="41" y2="15"></line>
            <line x1="3" y1="19" x2="41" y2="19"></line>
            <line x1="3" y1="23" x2="41" y2="23"></line>
          </g>
          <g fill="currentColor">
            <ellipse cx="14" cy="21" rx="3.1" ry="2.4"></ellipse>
            <ellipse cx="14" cy="17" rx="3.1" ry="2.4"></ellipse>
            <ellipse cx="14" cy="13" rx="3.1" ry="2.4"></ellipse>
            <ellipse cx="30" cy="23" rx="3.1" ry="2.4"></ellipse>
            <ellipse cx="30" cy="19" rx="3.1" ry="2.4"></ellipse>
            <ellipse cx="30" cy="15" rx="3.1" ry="2.4"></ellipse>
          </g>
          <g stroke="currentColor" stroke-width="1.6" stroke-linecap="round">
            <line x1="17" y1="13" x2="17" y2="6"></line>
            <line x1="33" y1="15" x2="33" y2="8"></line>
          </g>
        </svg>
      `;
    }

    if (icon === 'triad-triple') {
      return `
        <svg viewBox="0 0 44 32" aria-hidden="true" focusable="false">
          <g fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round">
            <line x1="3" y1="7"  x2="41" y2="7"></line>
            <line x1="3" y1="11" x2="41" y2="11"></line>
            <line x1="3" y1="15" x2="41" y2="15"></line>
            <line x1="3" y1="19" x2="41" y2="19"></line>
            <line x1="3" y1="23" x2="41" y2="23"></line>
          </g>
          <g fill="currentColor">
            <ellipse cx="10" cy="21" rx="2.6" ry="2.1"></ellipse>
            <ellipse cx="10" cy="17" rx="2.6" ry="2.1"></ellipse>
            <ellipse cx="10" cy="13" rx="2.6" ry="2.1"></ellipse>
            <ellipse cx="22" cy="22" rx="2.6" ry="2.1"></ellipse>
            <ellipse cx="22" cy="18" rx="2.6" ry="2.1"></ellipse>
            <ellipse cx="22" cy="14" rx="2.6" ry="2.1"></ellipse>
            <ellipse cx="34" cy="23" rx="2.6" ry="2.1"></ellipse>
            <ellipse cx="34" cy="19" rx="2.6" ry="2.1"></ellipse>
            <ellipse cx="34" cy="15" rx="2.6" ry="2.1"></ellipse>
          </g>
          <g stroke="currentColor" stroke-width="1.4" stroke-linecap="round">
            <line x1="12.5" y1="13" x2="12.5" y2="7"></line>
            <line x1="24.5" y1="14" x2="24.5" y2="8"></line>
            <line x1="36.5" y1="15" x2="36.5" y2="9"></line>
          </g>
        </svg>
      `;
    }

    return icon;
  }

  connectedCallback() {
    const icon = this.getAttribute('icon') || '';
    const title = this.getAttribute('title') || '';
    const subtitle = this.getAttribute('subtitle') || '';
    const href = this.getAttribute('href') || '#';
    const id = this.getAttribute('id') ? `id="${this.getAttribute('id')}"` : '';
    const iconMarkup = this.getIconMarkup(icon);

    this.innerHTML = `
      <a href="${href}" ${id} class="exercise-card">
        <div class="card-icon">${iconMarkup}</div>
        <div class="card-content">
          <span class="card-title">${title}</span>
          ${subtitle ? `<span class="card-subtitle">${subtitle}</span>` : ''}
        </div>
      </a>
    `;

    // Prevent default if it's an internal hash link handled by app.js
    if (href.startsWith('#')) {
      const link = this.querySelector('a');
      link.addEventListener('click', (_e) => {
        // We let app.js handle the navigation via popstate or direct call if we keep the SPA logic
        // But for now, we just ensure it doesn't do a full reload if not needed.
      });
    }
  }
}

customElements.define('gt-menu-card', GtMenuCard);
