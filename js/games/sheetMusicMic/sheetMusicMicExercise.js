// Sheet-Music-Mic Exercise – controller
// Shows a 4-bar staff (like "Noten lesen"); user plays notes into the microphone.
// Correct notes turn green. Two modes:
//   easy – wrong notes do not penalise, just keep playing
//   hard – any wrong note restarts the current sequence from the beginning

import { generateBars, getFilteredNotes } from '../sheetMusicReading/sheetMusicLogic.js';
import { detectPitch, frequencyToNote, pushAndMedian } from '../../tools/guitarTuner/tunerLogic.js';
import { renderScoreWithStatus } from './sheetMusicMicSVG.js';

// ── Constants ─────────────────────────────────────────────────────────────────
const MATCH_STREAK_REQUIRED = 3;  // consecutive correct frames to accept a note
const WRONG_STREAK_REQUIRED = 3;  // consecutive wrong frames to trigger hard-mode reset
const SUCCESS_PAUSE_MS      = 600; // pause after correct note before advancing
const WRONG_FEEDBACK_MS     = 900; // duration of wrong-note feedback in easy mode

// ── Module-level audio resources ──────────────────────────────────────────────
let audioCtx   = null;
let analyser   = null;
let stream     = null;
let intervalId = null;

const freqHistory = [];

// ── Module-level state ────────────────────────────────────────────────────────
let state = {
  bars:             [],
  currentBarIndex:  0,
  currentBeatIndex: 0,
  mode:             'easy',
  isListening:      false,
  matchStreak:      0,
  wrongStreak:      0,
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
  state.matchStreak      = 0;
  state.wrongStreak      = 0;

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
  state.matchStreak      = 0;
  state.wrongStreak      = 0;
  state.isLocked         = false;
  markCurrentNote();
  updateScore();
  renderCurrentState();
  updateCurrentNoteDisplay();
  updateFeedback(null);
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

  freqHistory.length = 0;
  state.matchStreak  = 0;
  state.wrongStreak  = 0;
  state.isLocked     = false;

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
  analyser.fftSize = 2048;
  audioCtx.createMediaStreamSource(stream).connect(analyser);

  state.isListening = true;
  intervalId = setInterval(analyzeFrame, 100);

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

  state.isListening = false;
  freqHistory.length = 0;
}

// ── Pitch analysis ────────────────────────────────────────────────────────────
function analyzeFrame() {
  if (!analyser || state.isLocked) return;

  const buffer = new Float32Array(analyser.fftSize);
  analyser.getFloatTimeDomainData(buffer);

  const hz = detectPitch(buffer, audioCtx.sampleRate);

  if (hz === null) {
    state.matchStreak = 0;
    state.wrongStreak = 0;
    return;
  }

  const medianHz         = pushAndMedian(freqHistory, hz);
  const { note, octave } = frequencyToNote(medianHz);

  const targetNote = getCurrentNote();
  if (!targetNote) return;

  if (note === targetNote.name && octave === targetNote.octave) {
    state.matchStreak++;
    state.wrongStreak = 0;
    if (state.matchStreak >= MATCH_STREAK_REQUIRED) {
      handleCorrectNote();
    }
  } else {
    state.matchStreak = 0;
    if (state.mode === 'hard') {
      state.wrongStreak++;
      if (state.wrongStreak >= WRONG_STREAK_REQUIRED) {
        state.wrongStreak = 0;
        handleWrongNote();
      }
    }
  }
}

function handleCorrectNote() {
  state.isLocked = true;
  state.matchStreak = 0;
  state.wrongStreak = 0;

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
      renderCurrentState();
      updateCurrentNoteDisplay();
      updateFeedback(null);
    }
  }, SUCCESS_PAUSE_MS);
}

function handleWrongNote() {
  // Hard mode only: restart the sequence after a brief delay
  state.isLocked = true;
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
    matchStreak:      0,
    wrongStreak:      0,
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
