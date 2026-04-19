import { registerExercise } from '../../exerciseRegistry.js';
import { CHORDS, CHORD_META } from '../../data/akkordData.js';
import { renderChordDiagram } from '../../games/akkordTrainer/akkordSVG.js';

const ROOT_ORDER = ['A', 'C', 'D', 'E', 'F', 'G', 'H'];
const TYPE_ORDER = ['Dur', 'Moll', 'Dom7', 'Maj7', 'Min7', 'Dim', 'Sus', 'Add'];

const filter = { rootNote: '', chordType: '' };
let initialized = false;

function getFilteredChords() {
  return Object.keys(CHORDS)
    .filter(name => {
      const meta = CHORD_META[name];
      if (!meta) return false;
      const rootMatch = !filter.rootNote  || meta.rootNote  === filter.rootNote;
      const typeMatch = !filter.chordType || meta.chordType === filter.chordType;
      return rootMatch && typeMatch;
    })
    .sort((a, b) => {
      const ma = CHORD_META[a], mb = CHORD_META[b];
      const rootDiff = ROOT_ORDER.indexOf(ma.rootNote) - ROOT_ORDER.indexOf(mb.rootNote);
      if (rootDiff !== 0) return rootDiff;
      return TYPE_ORDER.indexOf(ma.chordType) - TYPE_ORDER.indexOf(mb.chordType);
    });
}

function renderGrid() {
  const container = document.getElementById('akkord-uebersicht-container');
  if (!container) return;
  container.innerHTML = '';

  const names = getFilteredChords();

  if (names.length === 0) {
    const empty = document.createElement('p');
    empty.className = 'akkord-uebersicht-empty';
    empty.textContent = 'Keine Akkorde für diese Auswahl.';
    container.appendChild(empty);
    return;
  }

  const grid = document.createElement('div');
  grid.className = 'akkord-uebersicht-grid';

  for (const chordName of names) {
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
    renderChordDiagram(diagramEl, positions, null, null, () => {}, true);
    card.appendChild(diagramEl);

    grid.appendChild(card);
  }

  container.appendChild(grid);
}

function initFilters() {
  if (initialized) return;

  for (const [groupId, filterKey] of [['filter-root', 'rootNote'], ['filter-type', 'chordType']]) {
    const group = document.getElementById(groupId);
    if (!group) continue;
    group.addEventListener('click', e => {
      const btn = e.target.closest('.akkord-filter-btn');
      if (!btn) return;
      group.querySelectorAll('.akkord-filter-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      filter[filterKey] = btn.dataset.value;
      renderGrid();
    });
  }

  initialized = true;
}

function startExercise() {
  initFilters();
  renderGrid();
}

function stopExercise() {}

registerExercise('akkordUebersicht', {
  viewId:     'view-akkord-uebersicht',
  btnStartId: 'btn-start-akkord-uebersicht',
  btnBackId:  'btn-back-akkord-uebersicht',
  start: startExercise,
  stop:  stopExercise,
});
