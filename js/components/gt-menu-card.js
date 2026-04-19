/**
 * Web Component for menu entries.
 * Usage: <gt-menu-card icon="🎯" title="Griffbrett" subtitle="Töne erkennen" href="#fretboard"></gt-menu-card>
 */
class GtMenuCard extends HTMLElement {
  connectedCallback() {
    const icon = this.getAttribute('icon') || '';
    const title = this.getAttribute('title') || '';
    const subtitle = this.getAttribute('subtitle') || '';
    const href = this.getAttribute('href') || '#';
    const id = this.getAttribute('id') ? `id="${this.getAttribute('id')}"` : '';

    this.innerHTML = `
      <a href="${href}" ${id} class="exercise-card">
        <div class="card-icon">${icon}</div>
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
