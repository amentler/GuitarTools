// Sheet-Music-Mic Exercise – controller
// Shows a 4-bar staff (like "Noten lesen"); user plays notes into the microphone.
// Correct notes turn green. Two modes:
//   easy – wrong notes do not penalise, just keep playing
//   hard – any wrong note restarts the current sequence from the beginning

import { registerExercise } from '../../exerciseRegistry.js';
import { generateBars, getFilteredNotes } from '../sheetMusicReading/sheetMusicLogic.js';
import {
  classifyFrame,
  createMatchState,
  updateMatchState,
  getRecommendedFftSize,
} from './fastNoteMatcher.js';
import { renderScoreWithStatus } from './sheetMusicMicSVG.js';

// ── Constants ─────────────────────────────────────────────────────────────────
const SUCCESS_PAUSE_MS      = 600; // pause after correct note before advancing
const WRONG_FEEDBACK_MS     = 900; // duration of wrong-note feedback in easy mode
const ANALYZE_INTERVAL_MS   = 50;  // frame cadence for the matching loop

// ── Module-level audio resources ──────────────────────────────────────────────
let audioCtx   = null;
let analyser   = null;
let stream     = null;
let intervalId = null;
let currentFftSize = 0;

// ── Module-level state ────────────────────────────────────────────────────────
let state = {
  bars:             [],
  currentBarIndex:  0,
  currentBeatIndex: 0,
  mode:             'easy',
  isListening:      false,
  matchState:       createMatchState(),
  isLocked:         false,
  score:            { correct: 0, total: 0 },
  settings: {
    maxFret:       3,
    activeStrings: [0, 1, 2, 3, 4, 5],
  },
};

let settingsWired = false;
let ui = null;

// ── UI helpers ────────────────────────────────────────────────────────────────
function resolveUI() {
  ui = {
    permission:   document.getElementById('sheet-mic-permission'),
    scoreEl:      document.getElementById('sheet-mic-score'),
    container:    document.getElementById('sheet-mic-score-container'),
    startBtn:     document.getElementById('sheet-mic-start-btn'),
    stopBtn:      document.getElementById('sheet-mic-stop-btn'),
    newBarsBtn:   document.getElementById('sheet-mic-new-bars'),
    feedback:     document.getElementById('sheet-mic-feedback'),
    currentNote:  document.getElementById('sheet-mic-current-note'),
    modeSelect:   document.getElementById('sheet-mic-mode'),
    slider:       document.getElementById('sheet-mic-fret-slider'),
    sliderLabel:  document.getElementById('sheet-mic-fret-label'),
  };
}

function getNotesPool() {
  return getFilteredNotes(state.settings.maxFret, state.settings.activeStrings);
}

// ── Score generation ──────────────────────────────────────────────────────────
function generateNewBars() {
  const pool    = getNotesPool();
  const rawBars = generateBars(4, 4, pool);

  // Attach a mutable `status` to each note object (shallow copy to avoid mutating the pool)
  state.bars = rawBars.map(bar =>
    bar.map(note => ({ ...note, status: 'pending' }))
  );

  state.currentBarIndex  = 0;
  state.currentBeatIndex = 0;
  state.score.correct    = 0;
  state.score.total      = state.bars.reduce((s, b) => s + b.length, 0);
  state.matchState       = createMatchState();

  markCurrentNote();
  renderCurrentState();
  updateScore();
  updateCurrentNoteDisplay();
}

function markCurrentNote() {
  const { currentBarIndex: bi, currentBeatIndex: ni } = state;
  if (bi >= 0 && bi < state.bars.length) {
    state.bars[bi][ni].status = 'current';
  }
}

function getCurrentNote() {
  const { currentBarIndex: bi, currentBeatIndex: ni } = state;
  if (bi < 0 || bi >= state.bars.length) return null;
  return state.bars[bi][ni] ?? null;
}

// ── Sequence navigation ───────────────────────────────────────────────────────
function advanceToNextNote() {
  let bi = state.currentBarIndex;
  let ni = state.currentBeatIndex + 1;
  if (ni >= state.bars[bi].length) {
    bi++;
    ni = 0;
  }
  if (bi >= state.bars.length) {
    handleSequenceComplete();
    return;
  }
  state.currentBarIndex  = bi;
  state.currentBeatIndex = ni;
  markCurrentNote();
}

function handleSequenceComplete() {
  state.currentBarIndex  = -1;
  state.currentBeatIndex = -1;
  stopListening();
  renderCurrentState();
  updateCurrentNoteDisplay();
  ui.feedback.textContent  = `Alle Noten gespielt! ${state.score.correct}/${state.score.total} richtig. 🎉`;
  ui.feedback.className    = 'feedback-text correct';
  ui.startBtn.style.display = 'inline-block';
  ui.stopBtn.style.display  = 'none';
}

function restartSequence() {
  for (const bar of state.bars) {
    for (const note of bar) note.status = 'pending';
  }
  state.currentBarIndex  = 0;
  state.currentBeatIndex = 0;
  state.score.correct    = 0;
  state.matchState       = createMatchState();
  state.isLocked         = false;
  markCurrentNote();
  updateScore();
  renderCurrentState();
  updateCurrentNoteDisplay();
  applyTargetFftSize();
  updateFeedback(null);
}

/**
 * Ensures the AnalyserNode's fftSize matches the recommended window for
 * the current target note. Called whenever the target changes. Skips the
 * assignment when the size is already correct so the Web Audio node does
 * not click.
 */
function applyTargetFftSize() {
  if (!analyser) return;
  const note = getCurrentNote();
  if (!note) return;
  const targetPitch = `${note.name}${note.octave}`;
  const recommended = getRecommendedFftSize(targetPitch, audioCtx?.sampleRate ?? 44100);
  if (recommended !== currentFftSize) {
    analyser.fftSize = recommended;
    currentFftSize = recommended;
  }
}

// ── Rendering ─────────────────────────────────────────────────────────────────
function renderCurrentState() {
  if (!ui) return;
  renderScoreWithStatus(ui.container, state.bars);
}

function updateScore() {
  if (!ui) return;
  ui.scoreEl.textContent = `${state.score.correct} / ${state.score.total}`;
}

function updateCurrentNoteDisplay() {
  if (!ui) return;
  const note = getCurrentNote();
  if (note) {
    ui.currentNote.textContent = `${note.name}${note.octave}`;
  } else if (state.currentBarIndex === -1) {
    ui.currentNote.textContent = '✓';
  } else {
    ui.currentNote.textContent = '–';
  }
}

function updateFeedback(kind) {
  if (!ui) return;
  ui.feedback.className = 'feedback-text';
  if (kind === 'correct') {
    ui.feedback.textContent = 'Richtig! ✓';
    ui.feedback.classList.add('correct');
  } else if (kind === 'wrong') {
    ui.feedback.textContent = state.mode === 'hard' ? 'Falsch! Neustart…' : 'Falsch!';
    ui.feedback.classList.add('wrong');
  } else {
    ui.feedback.textContent = '';
  }
}

// ── Audio pipeline ────────────────────────────────────────────────────────────
async function startListening() {
  if (state.isListening) return;

  state.matchState = createMatchState();
  state.isLocked   = false;

  ui.permission.style.display = 'block';
  ui.permission.textContent   = 'Mikrofon-Zugriff wird benötigt…';

  try {
    stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
  } catch {
    ui.permission.textContent = 'Mikrofon nicht verfügbar. Bitte Zugriff erlauben.';
    return;
  }

  ui.permission.style.display = 'none';

  audioCtx = new AudioContext();
  analyser = audioCtx.createAnalyser();
  currentFftSize = 0;
  applyTargetFftSize();
  audioCtx.createMediaStreamSource(stream).connect(analyser);

  state.isListening = true;
  intervalId = setInterval(analyzeFrame, ANALYZE_INTERVAL_MS);

  ui.startBtn.style.display = 'none';
  ui.stopBtn.style.display  = 'inline-block';
  ui.feedback.textContent   = '';
}

function stopListening() {
  clearInterval(intervalId);
  intervalId = null;

  if (stream) {
    stream.getTracks().forEach(t => t.stop());
    stream = null;
  }

  if (audioCtx) {
    audioCtx.close();
    audioCtx = null;
    analyser = null;
  }

  currentFftSize = 0;
  state.isListening = false;
}

// ── Pitch analysis ────────────────────────────────────────────────────────────
function analyzeFrame() {
  if (!analyser || state.isLocked) return;

  const targetNote = getCurrentNote();
  if (!targetNote) return;

  const buffer = new Float32Array(analyser.fftSize);
  analyser.getFloatTimeDomainData(buffer);

  const targetPitch = `${targetNote.name}${targetNote.octave}`;
  const frameResult = classifyFrame(buffer, audioCtx.sampleRate, targetPitch);

  // In easy mode we discard wrong frames so they neither advance nor reject.
  const effective = state.mode === 'easy' && frameResult.status === 'wrong'
    ? { ...frameResult, status: 'unsure' }
    : frameResult;

  const { nextState, event } = updateMatchState(state.matchState, effective);
  state.matchState = nextState;

  if (event === 'accept') {
    handleCorrectNote();
  } else if (event === 'reject' && state.mode === 'hard') {
    handleWrongNote();
  }
}

function handleCorrectNote() {
  state.isLocked = true;
  state.matchState = createMatchState();

  const note = getCurrentNote();
  if (note) note.status = 'correct';

  state.score.correct++;
  updateScore();
  renderCurrentState();
  updateFeedback('correct');

  setTimeout(() => {
    state.isLocked = false;
    advanceToNextNote();
    if (state.currentBarIndex !== -1) {
      applyTargetFftSize();
      renderCurrentState();
      updateCurrentNoteDisplay();
      updateFeedback(null);
    }
  }, SUCCESS_PAUSE_MS);
}

function handleWrongNote() {
  // Hard mode only: restart the sequence after a brief delay
  state.isLocked = true;
  state.matchState = createMatchState();
  updateFeedback('wrong');
  setTimeout(() => {
    state.isLocked = false;
    restartSequence();
  }, WRONG_FEEDBACK_MS);
}

// ── Settings ──────────────────────────────────────────────────────────────────
function syncSettingsUI() {
  ui.slider.value = state.settings.maxFret;
  updateFretLabel();
  document.querySelectorAll('#sheet-mic-string-toggles .btn-string').forEach(btn => {
    const idx = parseInt(btn.dataset.string, 10);
    btn.classList.toggle('active', state.settings.activeStrings.includes(idx));
  });
  ui.modeSelect.value = state.mode;
}

function updateFretLabel() {
  ui.sliderLabel.textContent =
    state.settings.maxFret === 0 ? 'Nur Leer' : `0 – ${state.settings.maxFret}`;
}

function wireSettings() {
  ui.slider.addEventListener('input', () => {
    state.settings.maxFret = parseInt(ui.slider.value, 10);
    updateFretLabel();
    stopListening();
    generateNewBars();
    ui.startBtn.style.display = 'inline-block';
    ui.stopBtn.style.display  = 'none';
  });

  document.querySelectorAll('#sheet-mic-string-toggles .btn-string').forEach(btn => {
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
      stopListening();
      generateNewBars();
      ui.startBtn.style.display = 'inline-block';
      ui.stopBtn.style.display  = 'none';
    });
  });

  ui.modeSelect.addEventListener('change', () => {
    state.mode = ui.modeSelect.value;
  });

  ui.newBarsBtn.addEventListener('click', () => {
    stopListening();
    generateNewBars();
    ui.startBtn.style.display = 'inline-block';
    ui.stopBtn.style.display  = 'none';
    ui.feedback.textContent   = '';
  });

  ui.startBtn.addEventListener('click', () => {
    // Reset sequence state before (re-)listening
    if (!state.isListening) {
      restartSequence();
    }
    startListening();
  });

  ui.stopBtn.addEventListener('click', () => {
    stopListening();
    ui.startBtn.style.display = 'inline-block';
    ui.stopBtn.style.display  = 'none';
  });
}

// ── Public API ────────────────────────────────────────────────────────────────
export function startExercise() {
  resolveUI();

  state = {
    bars:             [],
    currentBarIndex:  0,
    currentBeatIndex: 0,
    mode:             state.mode,
    isListening:      false,
    matchState:       createMatchState(),
    isLocked:         false,
    score:            { correct: 0, total: 0 },
    settings:         state.settings,
  };

  if (!settingsWired) {
    wireSettings();
    settingsWired = true;
  }

  syncSettingsUI();
  generateNewBars();

  ui.startBtn.style.display   = 'inline-block';
  ui.stopBtn.style.display    = 'none';
  ui.feedback.textContent     = '';
  ui.permission.style.display = 'none';
}

export function stopExercise() {
  stopListening();
}

// ── Self-registration ─────────────────────────────────────────────────────────
registerExercise('sheetMic', {
  viewId: 'view-sheet-mic',
  btnStartId: 'btn-start-sheet-mic',
  btnBackId: 'btn-back-sheet-mic',
  start: startExercise,
  stop: stopExercise,
});
