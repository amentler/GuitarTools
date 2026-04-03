// Note-Playing Exercise – main controller
// Shows a target note; listens via microphone to verify the user plays it.

import { detectPitch, frequencyToNote, pushAndMedian } from '../../tools/guitarTuner/tunerLogic.js';
import { getRandomNote, getPositionsForNote } from './notePlayingLogic.js';
import { renderNoteOnStaff, renderNotePositionsTab } from './notePlayingSVG.js';

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
  targetNote:   null,
  matchStreak:  0,
  isLocked:     false,
  hintLevel:    0,      // 0 = no hint, 1 = note name shown, 2 = tabs shown
  score:        { correct: 0 },
  advanceTimeout: null,
  settings: {
    maxFret:       5,
    activeStrings: [0, 1, 2, 3, 4, 5],
  },
};

// ── DOM refs ──────────────────────────────────────────────────────────────────
let ui = null;

function resolveUI() {
  ui = {
    permission:      document.getElementById('note-play-permission'),
    notation:        document.getElementById('note-play-notation'),
    targetNote:      document.getElementById('note-play-target'),
    tabContainer:    document.getElementById('note-play-tab'),
    hint1Btn:        document.getElementById('note-play-hint1'),
    hint2Btn:        document.getElementById('note-play-hint2'),
    detectedNote:    document.getElementById('note-play-detected'),
    feedback:        document.getElementById('note-play-feedback'),
    score:           document.getElementById('note-play-score'),
    slider:          document.getElementById('note-play-fret-slider'),
    sliderLabel:     document.getElementById('note-play-fret-label'),
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
    targetNote:     null,
    matchStreak:    0,
    isLocked:       false,
    hintLevel:      0,
    score:          { correct: 0 },
    advanceTimeout: null,
    settings:       state.settings,
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

  ui.hint1Btn.addEventListener('click', () => {
    if (state.hintLevel < 1) {
      state.hintLevel = 1;
      updateHintDisplay();
    }
  });

  ui.hint2Btn.addEventListener('click', () => {
    if (state.hintLevel < 2) {
      state.hintLevel = 2;
      updateHintDisplay();
    }
  });
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
  state.isLocked = false;
  state.matchStreak = 0;
  state.hintLevel = 0;
  state.targetNote = getRandomNote(null, state.settings.maxFret, state.settings.activeStrings);
  updateTargetDisplay();
  updateDetectedNote(null);
  updateFeedback(null);
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
  const { note }  = frequencyToNote(medianHz);

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
  state.isLocked   = true;
  state.matchStreak = 0;
  state.score.correct++;
  updateScore();
  // Always reveal the note name on success
  state.hintLevel = Math.max(state.hintLevel, 1);
  updateHintDisplay();
  updateFeedback('correct');

  state.advanceTimeout = setTimeout(() => {
    state.targetNote = getRandomNote(
      state.targetNote,
      state.settings.maxFret,
      state.settings.activeStrings
    );
    state.matchStreak    = 0;
    state.isLocked       = false;
    state.hintLevel      = 0;
    state.advanceTimeout = null;
    updateTargetDisplay();
    updateDetectedNote(null);
    updateFeedback(null);
  }, 1500);
}

// ── DOM update helpers ────────────────────────────────────────────────────────

// Tracks last rendered note to avoid unnecessary VexFlow re-renders
let lastRenderedDetected = undefined;

function updateTargetDisplay() {
  if (!ui) return;
  renderNoteOnStaff(ui.notation, state.targetNote);
  // Reset hints
  ui.targetNote.textContent   = state.targetNote ?? '–';
  ui.targetNote.style.visibility = 'hidden';
  ui.tabContainer.style.display  = 'none';
  ui.tabContainer.innerHTML      = '';
  // Disable hint 2 until hint 1 is shown
  ui.hint1Btn.disabled = false;
  ui.hint2Btn.disabled = true;
  lastRenderedDetected = undefined;
}

function updateHintDisplay() {
  if (!ui) return;
  if (state.hintLevel >= 1) {
    ui.targetNote.style.visibility = 'visible';
    ui.hint2Btn.disabled = false;
  }
  if (state.hintLevel >= 2) {
    const positions = getPositionsForNote(
      state.targetNote,
      state.settings.maxFret,
      state.settings.activeStrings,
    );
    renderNotePositionsTab(ui.tabContainer, positions);
    ui.tabContainer.style.display = 'block';
  }
}

function updateDetectedNote(note) {
  if (!ui) return;
  if (note === lastRenderedDetected) return;
  lastRenderedDetected = note;
  renderNoteOnStaff(ui.detectedNote, note);
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
