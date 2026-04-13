// Note-Playing Exercise – main controller
// Shows a target note; listens via microphone to verify the user plays it.
// Encapsulates all state in a factory function.

import { registerExercise } from '../../exerciseRegistry.js';
import {
  classifyFrame,
  createMatchState,
  updateMatchState,
  getRecommendedFftSize,
} from '../sheetMusicMic/fastNoteMatcher.js';
import { getRandomPitch, getPositionsForPitch } from './notePlayingLogic.js';
import { renderNoteOnStaff, renderNotePositionsTab } from './notePlayingSVG.js';

// ── Constants ─────────────────────────────────────────────────────────────────
const ANALYZE_INTERVAL_MS = 50; // matching-loop cadence

export function createNotePlayingExercise() {
  // Audio resources (per-instance)
  let audioCtx   = null;
  let analyser   = null;
  let stream     = null;
  let intervalId = null;
  let settingsWired = false;
  let currentFftSize = 0;

  // State (per-instance)
  let state = {
    targetNote:   null,
    matchState:   createMatchState(),
    isLocked:     false,
    hintLevel:    0,      // 0 = no hint, 1 = note name shown, 2 = tabs shown
    score:        { correct: 0 },
    advanceTimeout: null,
    settings: {
      maxFret:       5,
      activeStrings: [0, 1, 2, 3, 4, 5],
    },
  };

  // DOM refs (per-instance)
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

  // Tracks last rendered note to avoid unnecessary VexFlow re-renders.
  let lastRenderedDetected = null;

  // ── Public API ────────────────────────────────────────────────────────────

  async function startExercise() {
    resolveUI();

    // Cancel any in-flight advance timer
    if (state.advanceTimeout) {
      clearTimeout(state.advanceTimeout);
    }

    // Preserve settings across restarts; reset everything else
    state = {
      targetNote:     null,
      matchState:     createMatchState(),
      isLocked:       false,
      hintLevel:      0,
      score:          { correct: 0 },
      advanceTimeout: null,
      settings:       state.settings,
    };

    if (!settingsWired) {
      wireSettings();
      settingsWired = true;
    }
    syncSettingsUI();

    // Pick initial target note
    state.targetNote = getRandomPitch(null, state.settings.maxFret, state.settings.activeStrings);
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
    currentFftSize = 0;
    applyTargetFftSize();
    audioCtx.createMediaStreamSource(stream).connect(analyser);

    intervalId = setInterval(analyzeFrame, ANALYZE_INTERVAL_MS);
  }

  function stopExercise() {
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

    currentFftSize = 0;
    state.isLocked = false;
  }

  /**
   * Keeps AnalyserNode.fftSize in step with the recommended window for the
   * current target note.
   */
  function applyTargetFftSize() {
    if (!analyser) return;
    if (!state.targetNote) return;
    const recommended = getRecommendedFftSize(state.targetNote, audioCtx?.sampleRate ?? 44100);
    if (recommended !== currentFftSize) {
      analyser.fftSize = recommended;
      currentFftSize = recommended;
    }
  }

  // ── Settings wiring ───────────────────────────────────────────────────────

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
    state.matchState = createMatchState();
    state.hintLevel = 0;
    state.targetNote = getRandomPitch(null, state.settings.maxFret, state.settings.activeStrings);
    applyTargetFftSize();
    updateTargetDisplay();
    updateDetectedNote(null);
    updateFeedback(null);
  }

  // ── Pitch analysis frame ──────────────────────────────────────────────────

  function analyzeFrame() {
    if (!analyser || state.isLocked) return;
    if (!state.targetNote) return;

    const buffer = new Float32Array(analyser.fftSize);
    analyser.getFloatTimeDomainData(buffer);

    const frameResult = classifyFrame(buffer, audioCtx.sampleRate, state.targetNote);

    updateDetectedNote(frameResult.detectedPitch);

    const { nextState, event } = updateMatchState(state.matchState, frameResult);
    state.matchState = nextState;

    if (event === 'accept') {
      handleSuccess();
    }
  }

  function handleSuccess() {
    state.isLocked   = true;
    state.matchState = createMatchState();
    state.score.correct++;
    updateScore();
    // Always reveal the note name on success
    state.hintLevel = Math.max(state.hintLevel, 1);
    updateHintDisplay();
    updateFeedback('correct');

    state.advanceTimeout = setTimeout(() => {
      state.targetNote = getRandomPitch(
        state.targetNote,
        state.settings.maxFret,
        state.settings.activeStrings
      );
      state.matchState     = createMatchState();
      state.isLocked       = false;
      state.hintLevel      = 0;
      state.advanceTimeout = null;
      applyTargetFftSize();
      updateTargetDisplay();
      updateDetectedNote(null);
      updateFeedback(null);
    }, 1500);
  }

  // ── DOM update helpers ────────────────────────────────────────────────────

  function updateTargetDisplay() {
    if (!ui) return;
    renderNoteOnStaff(ui.notation, state.targetNote);
    // Reset hints
    ui.targetNote.textContent      = state.targetNote ?? '–';
    ui.targetNote.style.visibility = 'hidden';
    ui.tabContainer.style.display  = 'none';
    ui.tabContainer.innerHTML      = '';
    // Disable hint 2 until hint 1 is shown
    ui.hint1Btn.disabled = false;
    ui.hint2Btn.disabled = true;
    lastRenderedDetected = null;
  }

  function updateHintDisplay() {
    if (!ui) return;
    if (state.hintLevel >= 1) {
      ui.targetNote.style.visibility = 'visible';
      ui.hint2Btn.disabled = false;
    }
    if (state.hintLevel >= 2) {
      const positions = getPositionsForPitch(
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
    const norm = note ?? null;
    if (norm === lastRenderedDetected) return;
    lastRenderedDetected = norm;
    renderNoteOnStaff(ui.detectedNote, norm);
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

  return { startExercise, stopExercise };
}

// ── Self-registration ─────────────────────────────────────────────────────────
const notePlayingExercise = createNotePlayingExercise();
registerExercise('notePlaying', {
  viewId: 'view-note-play',
  btnStartId: 'btn-start-note-play',
  btnBackId: 'btn-back-note-play',
  start: notePlayingExercise.startExercise,
  stop: notePlayingExercise.stopExercise,
});
