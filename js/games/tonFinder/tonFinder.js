import { registerExercise } from '../../exerciseRegistry.js';
import { getAllPositions, getNotePool, evaluateRound, positionKey } from './tonFinderLogic.js';
import { wireStringToggles, syncStringToggles, wireFretSlider, syncFretSlider } from '../../utils/settings.js';

export function createTonFinderExercise() {
  let settingsWired = false;
  let state = {
    settings: {
      maxFret: 5,
      activeStrings: [0, 1, 2, 3, 4, 5],
      difficulty: 'all',
    },
    notePool: [],
    targetNote: null,
    selected: new Set(),
    resultMap: new Map(),
    score: { points: 0, rounds: 0 },
    locked: false,
  };

  let ui;

  function resolveUI() {
    ui = {
      fretboard: document.getElementById('ton-finder-svg'),
      targetNote: document.getElementById('ton-finder-target-note'),
      feedback: document.getElementById('ton-finder-feedback'),
      scorePoints: document.getElementById('score-points'),
      scoreRounds: document.getElementById('score-rounds'),
      slider: document.getElementById('ton-finder-fret-range-slider'),
      sliderLabel: document.getElementById('ton-finder-fret-range-label'),
      finishButton: document.getElementById('btn-ton-finder-finish'),
      nextButton: document.getElementById('btn-ton-finder-next'),
      difficulty: document.getElementById('ton-finder-difficulty'),
    };
  }

  function startExercise() {
    resolveUI();
    state = {
      settings: state.settings,
      notePool: getNotePool(state.settings.difficulty),
      targetNote: null,
      selected: new Set(),
      resultMap: new Map(),
      score: { points: 0, rounds: 0 },
      locked: false,
    };

    if (!settingsWired) {
      wireSettings();
      settingsWired = true;
    }
    syncSettingsUI();
    startNextRound();
    updateScore();
  }

  function stopExercise() {
    state.locked = true;
  }

  function wireSettings() {
    const slider = document.getElementById('ton-finder-fret-range-slider');
    const sliderLabel = document.getElementById('ton-finder-fret-range-label');

    wireFretSlider(slider, sliderLabel, state.settings, startNextRound);

    wireStringToggles(
      document.querySelectorAll('#ton-finder-string-toggles .btn-string'),
      state.settings.activeStrings,
      () => { syncSettingsUI(); startNextRound(); },
    );

    ui.difficulty.addEventListener('change', () => {
      state.settings.difficulty = ui.difficulty.value;
      state.notePool = getNotePool(state.settings.difficulty);
      startNextRound();
    });

    ui.finishButton.addEventListener('click', finishRound);
    ui.nextButton.addEventListener('click', startNextRound);

    ui.fretboard.addEventListener('fret-select', event => {
      onPositionToggle(event.detail.stringIndex, event.detail.fret);
    });
  }

  function syncSettingsUI() {
    syncFretSlider(ui.slider, ui.sliderLabel, state.settings.maxFret);
    ui.difficulty.value = state.settings.difficulty;
    syncStringToggles(
      document.querySelectorAll('#ton-finder-string-toggles .btn-string'),
      state.settings.activeStrings,
    );
  }

  function startNextRound() {
    state.notePool = getNotePool(state.settings.difficulty);
    const idx = Math.floor(Math.random() * state.notePool.length);
    state.targetNote = state.notePool[idx];
    state.selected = new Set();
    state.resultMap = new Map();
    state.locked = false;

    ui.targetNote.textContent = state.targetNote;
    ui.feedback.textContent = '';
    ui.feedback.className = 'feedback-text';
    ui.nextButton.disabled = true;
    ui.finishButton.disabled = false;
    render();
  }

  function render() {
    const fretboard = ui.fretboard;
    fretboard.frets = state.settings.maxFret;
    fretboard.activeStrings = state.settings.activeStrings;

    const positions = [];
    for (const [key, result] of state.resultMap) {
      const [si, f] = parseKey(key);
      positions.push({ stringIndex: si, fret: f, state: result });
    }
    for (const key of state.selected) {
      if (!state.resultMap.has(key)) {
        const [si, f] = parseKey(key);
        positions.push({ stringIndex: si, fret: f, state: 'selected' });
      }
    }
    fretboard.positions = positions;
  }

  function parseKey(key) {
    return key.split(':').map(Number);
  }

  function onPositionToggle(stringIndex, fret) {
    if (state.locked) return;
    const key = positionKey(stringIndex, fret);
    if (state.selected.has(key)) state.selected.delete(key);
    else state.selected.add(key);
    render();
  }

  function finishRound() {
    if (state.locked) return;

    const correctPositions = getAllPositions(
      state.targetNote,
      state.settings.maxFret,
      state.settings.activeStrings
    );

    const evaluation = evaluateRound(state.selected, correctPositions);
    const roundPoints = Math.max(0, evaluation.correct - evaluation.wrong);
    state.score.points += roundPoints;
    state.score.rounds += 1;
    updateScore();

    const correctKeys = new Set(correctPositions.map(pos => positionKey(pos.string, pos.fret)));
    state.resultMap = new Map();

    for (const key of state.selected) {
      if (correctKeys.has(key)) state.resultMap.set(key, 'correct');
      else state.resultMap.set(key, 'wrong');
    }
    for (const key of correctKeys) {
      if (!state.selected.has(key)) state.resultMap.set(key, 'missed');
    }

    state.locked = true;
    ui.finishButton.disabled = true;
    ui.nextButton.disabled = false;
    ui.feedback.textContent = `Richtig: ${evaluation.correct} · Verpasst: ${evaluation.missed} · Falsch: ${evaluation.wrong} · Runde: +${roundPoints}`;
    ui.feedback.className = 'feedback-text';

    render();
  }

  function updateScore() {
    ui.scorePoints.textContent = state.score.points;
    ui.scoreRounds.textContent = state.score.rounds;
  }

  return { startExercise, stopExercise };
}

// ── Self-registration ─────────────────────────────────────────────────────────
const tonFinderExercise = createTonFinderExercise();
registerExercise('tonFinder', {
  viewId: 'view-ton-finder',
  btnStartId: 'btn-start-ton-finder',
  btnBackId: 'btn-back-ton-finder',
  start: tonFinderExercise.startExercise,
  stop: tonFinderExercise.stopExercise,
});
