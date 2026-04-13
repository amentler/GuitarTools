/**
 * akkordUebersicht.js
 * Static chord overview tool – displays all chords from the Akkord Trainer
 * grouped by category as non-interactive diagrams.
 */

import { registerExercise } from '../../exerciseRegistry.js';
import { CHORDS, CHORD_CATEGORIES } from '../../games/akkordTrainer/akkordLogic.js';
import { renderChordDiagram } from '../../games/akkordTrainer/akkordSVG.js';

const CATEGORY_LABELS = {
  simplified: 'Einsteiger (vereinfacht)',
  standard:   'Standard (CAGED)',
  extended:   'Weiterführend (7er, F)',
  sus_add:    'Sus & Add',
};

let rendered = false;

function render() {
  const container = document.getElementById('akkord-uebersicht-container');
  if (!container || rendered) return;

  for (const [catKey, chordNames] of Object.entries(CHORD_CATEGORIES)) {
    const section = document.createElement('div');
    section.className = 'akkord-uebersicht-section';

    const title = document.createElement('h3');
    title.className = 'akkord-uebersicht-section-title';
    title.textContent = CATEGORY_LABELS[catKey] ?? catKey;
    section.appendChild(title);

    const grid = document.createElement('div');
    grid.className = 'akkord-uebersicht-grid';

    for (const chordName of chordNames) {
      const positions = CHORDS[chordName];
      if (!positions) continue;

      const card = document.createElement('div');
      card.className = 'akkord-uebersicht-card';

      const nameEl = document.createElement('div');
      nameEl.className = 'akkord-uebersicht-name';
      nameEl.textContent = chordName;
      card.appendChild(nameEl);

      const diagramEl = document.createElement('div');
      diagramEl.className = 'akkord-uebersicht-diagram';
      renderChordDiagram(diagramEl, positions, null, null, () => {});
      card.appendChild(diagramEl);

      grid.appendChild(card);
    }

    section.appendChild(grid);
    container.appendChild(section);
  }

  rendered = true;
}

function startExercise() {
  render();
}

function stopExercise() {}

registerExercise('akkordUebersicht', {
  viewId:    'view-akkord-uebersicht',
  btnStartId: 'btn-start-akkord-uebersicht',
  btnBackId:  'btn-back-akkord-uebersicht',
  start: startExercise,
  stop:  stopExercise,
});
