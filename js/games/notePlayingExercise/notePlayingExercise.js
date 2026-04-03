// Note-Playing Exercise – main controller
// Shows a target note in treble-clef notation; listens via microphone to verify
// the user plays it. Two progressive hints are available: note name, then tabs.

import { detectPitch, frequencyToNote, pushAndMedian } from '../../tools/guitarTuner/tunerLogic.js';
import { getRandomNote, getPositionsForNote } from './notePlayingLogic.js';
import { renderSingleNote } from './notePlayingSVG.js';

// ── Constants ─────────────────────────────────────────────────────────────────
// Number of consecutive matching frames required to register a correct answer
const MATCH_STREAK_REQUIRED = 3;

// ── Module-level audio resources ──────────────────────────────────────────────
let audioCtx   = null;
let analyser   = null;
let stream     = null;
let intervalId = null;
let settingsWired = false;

const freqHistory = [];

// ── State ─────────────────────────────────────────────────────────────────────
let state = {
  targetNote:       null,
  matchStreak:      0,
  isLocked:         false,
  hintLevel:        0,        // 0 = none, 1 = note name shown, 2 = tabs shown
  lastDetectedNote: undefined, // last note rendered in the detected-notation staff
  score:            { correct: 0 },
  advanceTimeout:   null,
  settings: {
    maxFret:       5,
    activeStrings: [0, 1, 2, 3, 4, 5],
  },
};

// ── DOM refs ──────────────────────────────────────────────────────────────────
let ui = null;

function resolveUI() {
  ui = {
    permission:        document.getElementById('note-play-permission'),
    notation:          document.getElementById('note-play-notation'),
    targetNote:        document.getElementById('note-play-target'),
    hintFretboard:     document.getElementById('note-play-hint-fretboard'),
    hint1Btn:          document.getElementById('note-play-hint-1'),
    hint2Btn:          document.getElementById('note-play-hint-2'),
    detectedNotation:  document.getElementById('note-play-detected-notation'),
    feedback:          document.getElementById('note-play-feedback'),
    score:             document.getElementById('note-play-score'),
    slider:            document.getElementById('note-play-fret-slider'),
    sliderLabel:       document.getElementById('note-play-fret-label'),
  };
}

// ── Public API ────────────────────────────────────────────────────────────────

export async function startExercise() {
  resolveUI();

  // Cancel any in-flight advance timer
  if (state.advanceTimeout) {
    clearTimeout(state.advanceTimeout);
  }

  // Preserve settings across restarts; reset everything else
  state = {
    targetNote:       null,
    matchStreak:      0,
    isLocked:         false,
    hintLevel:        0,
    lastDetectedNote: undefined,
    score:            { correct: 0 },
    advanceTimeout:   null,
    settings:         state.settings,
  };

  freqHistory.length = 0;

  if (!settingsWired) {
    wireSettings();
    settingsWired = true;
  }
  syncSettingsUI();

  // Pick initial target note
  state.targetNote = getRandomNote(null, state.settings.maxFret, state.settings.activeStrings);
  updateTargetDisplay();
  updateDetectedNote(null);
  updateFeedback(null);
  updateScore();

  // Request microphone access
  ui.permission.style.display = 'block';
  ui.permission.textContent = 'Mikrofon-Zugriff wird benötigt…';

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

  intervalId = setInterval(analyzeFrame, 100);
}

export function stopExercise() {
  clearInterval(intervalId);
  intervalId = null;

  if (state.advanceTimeout) {
    clearTimeout(state.advanceTimeout);
    state.advanceTimeout = null;
  }

  if (stream) {
    stream.getTracks().forEach(t => t.stop());
    stream = null;
  }

  if (audioCtx) {
    audioCtx.close();
    audioCtx = null;
    analyser = null;
  }

  freqHistory.length = 0;
  state.isLocked = false;
}

// ── Settings wiring ───────────────────────────────────────────────────────────

function wireSettings() {
  ui.slider.addEventListener('input', () => {
    state.settings.maxFret = parseInt(ui.slider.value, 10);
    updateFretLabel();
    resetTargetNote();
  });

  document.querySelectorAll('#note-play-string-toggles .btn-string').forEach(btn => {
    btn.addEventListener('click', () => {
      const idx    = parseInt(btn.dataset.string, 10);
      const active = state.settings.activeStrings;

      if (active.includes(idx)) {
        if (active.length > 1) {
          active.splice(active.indexOf(idx), 1);
          btn.classList.remove('active');
        }
      } else {
        active.push(idx);
        active.sort((a, b) => a - b);
        btn.classList.add('active');
      }

      resetTargetNote();
    });
  });

  ui.hint1Btn.addEventListener('click', showHint1);
  ui.hint2Btn.addEventListener('click', showHint2);
}

function syncSettingsUI() {
  ui.slider.value = state.settings.maxFret;
  updateFretLabel();

  document.querySelectorAll('#note-play-string-toggles .btn-string').forEach(btn => {
    const idx = parseInt(btn.dataset.string, 10);
    btn.classList.toggle('active', state.settings.activeStrings.includes(idx));
  });
}

function updateFretLabel() {
  ui.sliderLabel.textContent =
    state.settings.maxFret === 0 ? 'Nur Leer' : `0 – ${state.settings.maxFret}`;
}

function resetTargetNote() {
  if (state.advanceTimeout) {
    clearTimeout(state.advanceTimeout);
    state.advanceTimeout = null;
  }
  state.isLocked    = false;
  state.matchStreak = 0;
  state.targetNote  = getRandomNote(null, state.settings.maxFret, state.settings.activeStrings);
  hideHints();
  updateTargetDisplay();
  updateDetectedNote(null);
  updateFeedback(null);
}

// ── Hint system ───────────────────────────────────────────────────────────────

function showHint1() {
  state.hintLevel = Math.max(state.hintLevel, 1);
  if (ui) {
    ui.targetNote.textContent  = state.targetNote ?? '–';
    ui.targetNote.style.display = '';
  }
}

function showHint2() {
  showHint1();
  state.hintLevel = 2;
  if (!ui) return;

  const positions = getPositionsForNote(
    state.targetNote,
    state.settings.maxFret,
    state.settings.activeStrings,
  );
  ui.hintFretboard.frets         = state.settings.maxFret;
  ui.hintFretboard.activeStrings = [...state.settings.activeStrings];
  ui.hintFretboard.positions     = positions.map(p => ({
    stringIndex: p.stringIndex,
    fret:        p.fret,
    state:       'selected',
  }));
  ui.hintFretboard.style.display = '';
}

function hideHints() {
  state.hintLevel = 0;
  if (ui) {
    ui.targetNote.style.display    = 'none';
    ui.hintFretboard.style.display = 'none';
  }
}

// Shows the note name without changing hintLevel (used on success).
function showNoteName() {
  if (ui) {
    ui.targetNote.textContent  = state.targetNote ?? '–';
    ui.targetNote.style.display = '';
  }
}

// ── Pitch analysis frame ──────────────────────────────────────────────────────

function analyzeFrame() {
  if (!analyser || state.isLocked) return;

  const buffer = new Float32Array(analyser.fftSize);
  analyser.getFloatTimeDomainData(buffer);

  const hz = detectPitch(buffer, audioCtx.sampleRate);

  if (hz === null) {
    state.matchStreak = 0;
    updateDetectedNote(null);
    return;
  }

  const medianHz = pushAndMedian(freqHistory, hz);
  const { note } = frequencyToNote(medianHz);

  updateDetectedNote(note);

  if (note === state.targetNote) {
    state.matchStreak++;
    if (state.matchStreak >= MATCH_STREAK_REQUIRED) {
      handleSuccess();
    }
  } else {
    state.matchStreak = 0;
  }
}

function handleSuccess() {
  state.isLocked    = true;
  state.matchStreak = 0;
  state.score.correct++;
  updateScore();
  showNoteName();
  updateFeedback('correct');

  state.advanceTimeout = setTimeout(() => {
    state.targetNote = getRandomNote(
      state.targetNote,
      state.settings.maxFret,
      state.settings.activeStrings,
    );
    state.matchStreak    = 0;
    state.isLocked       = false;
    state.advanceTimeout = null;
    hideHints();
    updateTargetDisplay();
    updateDetectedNote(null);
    updateFeedback(null);
  }, 1500);
}

// ── DOM update helpers ────────────────────────────────────────────────────────

function updateTargetDisplay() {
  if (!ui) return;
  renderSingleNote(ui.notation, state.targetNote);
}

function updateDetectedNote(note) {
  if (!ui) return;
  // Skip re-render if the displayed note hasn't changed
  if (note === state.lastDetectedNote) return;
  state.lastDetectedNote = note;
  renderSingleNote(ui.detectedNotation, note);
}

function updateFeedback(kind) {
  if (!ui) return;
  ui.feedback.className = 'feedback-text';
  if (kind === 'correct') {
    ui.feedback.textContent = 'Richtig! ✓';
    ui.feedback.classList.add('correct');
  } else {
    ui.feedback.textContent = '';
  }
}

function updateScore() {
  if (ui) ui.score.textContent = state.score.correct;
}

