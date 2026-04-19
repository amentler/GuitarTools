/**
 * Web Component for exercise headers.
 * Usage: <gt-exercise-header title="Ton-Finder" score-type="points"></gt-exercise-header>
 */
class GtExerciseHeader extends HTMLElement {
  connectedCallback() {
    const title = this.getAttribute('title') || '';
    const scoreType = this.getAttribute('score-type'); // 'correct' or 'points' or null

    let scoreHtml = '';
    if (scoreType === 'correct') {
      scoreHtml = `
        <div class="score-display">
          Richtig: <span id="score-correct">0</span> von <span id="score-total">0</span>
        </div>
      `;
    } else if (scoreType === 'points') {
      scoreHtml = `
        <div class="score-display">
          Punkte: <span id="score-points">0</span> · Runden: <span id="score-rounds">0</span>
        </div>
      `;
    } else if (scoreType === 'simple') {
        scoreHtml = `
        <div class="score-display">
          <span id="score-value">0</span>
        </div>
      `;
    }

    this.innerHTML = `
      <div class="exercise-header">
        <a href="index.html" class="btn-back">← Zurück zum Menü</a>
        ${title ? `<h2 class="exercise-title-header">${title}</h2>` : ''}
        ${scoreHtml}
      </div>
    `;
  }
}

customElements.define('gt-exercise-header', GtExerciseHeader);
