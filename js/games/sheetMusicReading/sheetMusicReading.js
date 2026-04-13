import { registerExercise } from '../../exerciseRegistry.js';
import { generateBars, getFilteredNotes } from './sheetMusicLogic.js';
import { renderScore }  from './sheetMusicSVG.js';

let wired = false;

let state = {
  bars:    [],
  showTab: false,
  settings: {
    maxFret: 3,
    activeStrings: [0, 1, 2, 3, 4, 5],
  },
};

function getNotesPool() {
  return getFilteredNotes(state.settings.maxFret, state.settings.activeStrings);
}

function regenerate() {
  state.bars = generateBars(4, 4, getNotesPool());
  renderScore(
    document.getElementById('score-container'),
    state.bars,
    state.showTab,
  );
}

function syncSettingsUI() {
  const slider = document.getElementById('sheet-music-fret-range-slider');
  const label  = document.getElementById('sheet-music-fret-range-label');
  slider.value = state.settings.maxFret;
  label.textContent = state.settings.maxFret === 0 ? 'Nur Leer' : `0 – ${state.settings.maxFret}`;

  document.querySelectorAll('#sheet-music-string-toggles .btn-string').forEach(btn => {
    const idx = parseInt(btn.dataset.string, 10);
    btn.classList.toggle('active', state.settings.activeStrings.includes(idx));
  });
}

export function startExercise() {
  regenerate();

  if (!wired) {
    document.getElementById('btn-new-bars').addEventListener('click', regenerate);

    document.getElementById('btn-show-tab').addEventListener('click', () => {
      state.showTab = !state.showTab;
      document.getElementById('btn-show-tab')
        .classList.toggle('active', state.showTab);
      renderScore(
        document.getElementById('score-container'),
        state.bars,
        state.showTab,
      );
    });

    // Fret range slider
    const slider = document.getElementById('sheet-music-fret-range-slider');
    const label  = document.getElementById('sheet-music-fret-range-label');
    slider.addEventListener('input', () => {
      state.settings.maxFret = parseInt(slider.value, 10);
      label.textContent = state.settings.maxFret === 0 ? 'Nur Leer' : `0 – ${state.settings.maxFret}`;
      regenerate();
    });

    // String toggles
    document.querySelectorAll('#sheet-music-string-toggles .btn-string').forEach(btn => {
      btn.addEventListener('click', () => {
        const idx    = parseInt(btn.dataset.string, 10);
        const active = state.settings.activeStrings;
        if (active.includes(idx)) {
          if (active.length > 1) active.splice(active.indexOf(idx), 1);
        } else {
          active.push(idx);
          active.sort((a, b) => a - b);
        }
        syncSettingsUI();
        regenerate();
      });
    });

    wired = true;
  }

  // Sync button + settings UI state
  document.getElementById('btn-show-tab')
    .classList.toggle('active', state.showTab);
  syncSettingsUI();
}

export function stopExercise() {
  // Nothing to tear down (no audio, no timers)
}

// ── Self-registration ─────────────────────────────────────────────────────────
registerExercise('sheetMusic', {
  viewId: 'view-sheet-music',
  btnStartId: 'btn-start-sheet-music',
  btnBackId: 'btn-back-sheet-music',
  start: startExercise,
  stop: stopExercise,
});
