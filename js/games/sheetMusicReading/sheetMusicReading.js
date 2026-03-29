import { generateBars } from './sheetMusicLogic.js';
import { renderScore }  from './sheetMusicSVG.js';

let wired = false;

let state = {
  bars:    [],
  showTab: false,
};

export function startExercise() {
  state.bars = generateBars();
  renderScore(
    document.getElementById('score-container'),
    state.bars,
    state.showTab,
  );

  if (!wired) {
    document.getElementById('btn-new-bars').addEventListener('click', () => {
      state.bars = generateBars();
      renderScore(
        document.getElementById('score-container'),
        state.bars,
        state.showTab,
      );
    });

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

    wired = true;
  }

  // Sync tab toggle button state
  document.getElementById('btn-show-tab')
    .classList.toggle('active', state.showTab);
}

export function stopExercise() {
  // Nothing to tear down (no audio, no timers)
}
