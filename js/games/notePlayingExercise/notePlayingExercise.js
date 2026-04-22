// Note-Playing Exercise – main controller
// Shows a target note; listens via microphone to verify the user plays it.
// Encapsulates all state in a factory function.

import {
  classifyFrame,
  createMatchState,
  updateMatchState,
  getRecommendedFftSize,
} from '../sheetMusicMic/fastNoteMatcher.js';
import { getRandomPitch, getPositionsForPitch } from './notePlayingLogic.js';
import { renderNoteOnStaff, renderNotePositionsTab } from './notePlayingSVG.js';
import { wireStringToggles, syncStringToggles, wireFretSlider, syncFretSlider } from '../../utils/settings.js';

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
  let rootElement = null;

  function resolveUI() {
    ui = {
      permission:      rootElement?.querySelector('#note-play-permission'),
      notation:        rootElement?.querySelector('#note-play-notation'),
      targetNote:      rootElement?.querySelector('#note-play-target'),
      tabContainer:    rootElement?.querySelector('#note-play-tab'),
      hint1Btn:        rootElement?.querySelector('#note-play-hint1'),
      hint2Btn:        rootElement?.querySelector('#note-play-hint2'),
      skipBtn:         rootElement?.querySelector('#note-play-skip'),
      detectedNote:    rootElement?.querySelector('#note-play-detected'),
      feedback:        rootElement?.querySelector('#note-play-feedback'),
      score:           rootElement?.querySelector('#score-value'),
      slider:          rootElement?.querySelector('#note-play-fret-slider'),
      sliderLabel:     rootElement?.querySelector('#note-play-fret-label'),
    };
  }

  // Tracks last rendered note to avoid unnecessary VexFlow re-renders.
  let lastRenderedDetected = null;

  // ── Public API ────────────────────────────────────────────────────────────

  async function mount(root = document) {
    rootElement = root;
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

    // NOTE: This exercise uses its own AudioContext and AnalyserNode, separate
    // from the tuner. The pitch-detection pipeline here is optimised for speed
    // (responsive windows, fastNoteMatcher classifier) rather than precision.
    // The tuner uses a different pipeline with larger windows and stabilisation
    // heuristics. Sharing a single AnalyserNode would force one fftSize on both,
    // causing audio glitches and wrong latency/precision trade-offs.
    // See improvement.md §1.4 for the design rationale.
    audioCtx = new AudioContext();
    if (audioCtx.state === 'suspended') {
      await audioCtx.resume();
    }
    analyser = audioCtx.createAnalyser();
    currentFftSize = 0;
    applyTargetFftSize();
    audioCtx.createMediaStreamSource(stream).connect(analyser);

    intervalId = setInterval(analyzeFrame, ANALYZE_INTERVAL_MS);
  }

  function unmount() {
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
    rootElement = null;
    ui = null;
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
    wireFretSlider(ui.slider, ui.sliderLabel, state.settings, resetTargetNote);

    wireStringToggles(
      rootElement.querySelectorAll('#note-play-string-toggles .btn-string'),
      state.settings.activeStrings,
      resetTargetNote,
    );

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

    ui.skipBtn?.addEventListener('click', () => {
      skipToNextNote();
    });
  }

  function syncSettingsUI() {
    syncFretSlider(ui.slider, ui.sliderLabel, state.settings.maxFret);
    syncStringToggles(
      rootElement.querySelectorAll('#note-play-string-toggles .btn-string'),
      state.settings.activeStrings,
    );
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
      state.advanceTimeout = null;
      skipToNextNote();
    }, 1500);
  }

  function skipToNextNote() {
    if (!state.targetNote) return;

    if (state.advanceTimeout) {
      clearTimeout(state.advanceTimeout);
      state.advanceTimeout = null;
    }

    state.targetNote = getRandomPitch(
      state.targetNote,
      state.settings.maxFret,
      state.settings.activeStrings
    );
    state.matchState = createMatchState();
    state.isLocked = false;
    state.hintLevel = 0;
    applyTargetFftSize();
    updateTargetDisplay();
    updateDetectedNote(null);
    updateFeedback(null);
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

  return {
    mount,
    unmount,
    startExercise: mount,
    stopExercise: unmount,
  };
}
