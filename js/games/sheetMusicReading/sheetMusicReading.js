import { registerExercise } from '../../exerciseRegistry.js';
import { generateBars, getFilteredNotes } from './sheetMusicLogic.js';
import { renderScore }  from './sheetMusicSVG.js';
import { wireStringToggles, syncStringToggles, wireFretSlider, syncFretSlider } from '../../utils/settings.js';

export function createSheetMusicExercise() {
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
    syncFretSlider(slider, label, state.settings.maxFret);
    syncStringToggles(
      document.querySelectorAll('#sheet-music-string-toggles .btn-string'),
      state.settings.activeStrings,
    );
  }

  function startExercise() {
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
      wireFretSlider(slider, label, state.settings, regenerate);

      // String toggles
      wireStringToggles(
        document.querySelectorAll('#sheet-music-string-toggles .btn-string'),
        state.settings.activeStrings,
        () => { syncSettingsUI(); regenerate(); },
      );

      wired = true;
    }

    // Sync button + settings UI state
    document.getElementById('btn-show-tab')
      .classList.toggle('active', state.showTab);
    syncSettingsUI();
  }

  function stopExercise() {
    // Nothing to tear down (no audio, no timers)
  }

  return { startExercise, stopExercise };
}

// ── Self-registration ─────────────────────────────────────────────────────────
const sheetMusicExercise = createSheetMusicExercise();
registerExercise('sheetMusic', {
  viewId: 'view-sheet-music',
  btnStartId: 'btn-start-sheet-music',
  btnBackId: 'btn-back-sheet-music',
  start: sheetMusicExercise.startExercise,
  stop: sheetMusicExercise.stopExercise,
});
