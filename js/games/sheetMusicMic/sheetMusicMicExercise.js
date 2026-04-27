// Sheet-Music-Mic Exercise – controller
// Shows a 4-bar staff (like "Noten lesen"); user plays notes into the microphone.
// Correct notes turn green. Two modes:
//   easy – wrong notes do not penalise, just keep playing
//   hard – any wrong note restarts the current sequence from the beginning
// Encapsulates all state in a factory function.

import { generateBars, getFilteredNotes } from '../../shared/music/sheetMusicLogic.js';
import {
  classifyFrame,
  createMatchState,
  updateMatchState,
  getRecommendedFftSize,
} from '../../shared/audio/fastNoteMatcher.js';
import {
  createOnsetGateState,
  updateOnsetGate,
  isOnsetGateOpen,
  consumeOnsetGate,
} from '../../shared/audio/noteOnsetGate.js';
import { renderScoreWithStatus } from './sheetMusicMicSVG.js';
import { wireStringToggles, syncStringToggles, wireFretSlider, syncFretSlider } from '../../utils/settings.js';
import {
  resolveSheetMusicMicUI,
  syncSheetMusicMicUI,
  setMicListeningUI,
} from './sheetMusicMicUI.js';
import {
  createSheetMusicMicAudioSession,
  openSheetMusicMicAudioSession,
  closeSheetMusicMicAudioSession,
} from './sheetMusicMicAudioSession.js';
import { requestMicrophoneStream } from '../../shared/audio/microphoneService.js';

// ── Constants ─────────────────────────────────────────────────────────────────
const SUCCESS_PAUSE_MS      = 600; // pause after correct note before advancing
const WRONG_FEEDBACK_MS     = 900; // duration of wrong-note feedback in easy mode
const ANALYZE_INTERVAL_MS   = 50;  // frame cadence for the matching loop

export function createSheetMusicMicFeature() {
  let intervalId = null;
  const audioSession = createSheetMusicMicAudioSession();

  // State (per-instance)
  let state = {
    bars:             [],
    currentBarIndex:  0,
    currentBeatIndex: 0,
    mode:             'easy',
    isListening:      false,
    matchState:       createMatchState(),
    onsetGateState:   createOnsetGateState(),
    isLocked:         false,
    score:            { correct: 0, total: 0 },
    settings: {
      maxFret:       3,
      activeStrings: [0, 1, 2, 3, 4, 5],
    },
  };

  let settingsWired = false;
  let ui = null;

  function getNotesPool() {
    return getFilteredNotes(state.settings.maxFret, state.settings.activeStrings);
  }

  // ── Score generation ──────────────────────────────────────────────────────
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
    state.onsetGateState   = createOnsetGateState();

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

  // ── Sequence navigation ───────────────────────────────────────────────────
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
    ui.startBtn.classList.remove('u-hidden');
    ui.stopBtn.classList.add('u-hidden');
  }

  function restartSequence() {
    for (const bar of state.bars) {
      for (const note of bar) note.status = 'pending';
    }
    state.currentBarIndex  = 0;
    state.currentBeatIndex = 0;
    state.score.correct    = 0;
    state.matchState       = createMatchState();
    state.onsetGateState   = consumeOnsetGate(state.onsetGateState);
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
   * the current target note.
   */
  function applyTargetFftSize() {
    if (!audioSession.analyser) return;
    const note = getCurrentNote();
    if (!note) return;
    const targetPitch = `${note.name}${note.octave}`;
    const recommended = getRecommendedFftSize(targetPitch, audioSession.audioCtx?.sampleRate ?? 44100);
    if (recommended !== audioSession.currentFftSize) {
      audioSession.analyser.fftSize = recommended;
      audioSession.currentFftSize = recommended;
    }
  }

  // ── Rendering ─────────────────────────────────────────────────────────────
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

  // ── Audio pipeline ────────────────────────────────────────────────────────
  async function startListening() {
    if (state.isListening) return;
    const activeUi = ui;

    state.matchState     = createMatchState();
    state.onsetGateState = createOnsetGateState();
    state.isLocked       = false;

    ui.permission.classList.remove('u-hidden');
    ui.permission.textContent   = 'Mikrofon-Zugriff wird benötigt…';

    try {
      audioSession.stream = await requestMicrophoneStream();
    } catch {
      ui.permission.textContent = 'Mikrofon nicht verfügbar. Bitte Zugriff erlauben.';
      return;
    }

    if (ui !== activeUi || !activeUi) {
      closeSheetMusicMicAudioSession(audioSession);
      return;
    }

    activeUi.permission.classList.add('u-hidden');

    // NOTE: This exercise uses its own AudioContext and AnalyserNode, separate
    // from the tuner. The pitch-detection pipeline here is optimised for speed
    // (responsive windows, fastNoteMatcher classifier) rather than precision.
    // The tuner uses a different pipeline with larger windows and stabilisation
    // heuristics. Sharing a single AnalyserNode would force one fftSize on both,
    // causing audio glitches and wrong latency/precision trade-offs.
    // See improvement.md §1.4 for the design rationale.
    openSheetMusicMicAudioSession(audioSession, audioSession.stream, AudioContext);
    if (ui !== activeUi || !ui) {
      closeSheetMusicMicAudioSession(audioSession);
      return;
    }
    applyTargetFftSize();

    state.isListening = true;
    intervalId = setInterval(analyzeFrame, ANALYZE_INTERVAL_MS);

    setMicListeningUI(activeUi, true);
    activeUi.feedback.textContent = '';
  }

  function stopListening() {
    clearInterval(intervalId);
    intervalId = null;
    closeSheetMusicMicAudioSession(audioSession);
    state.isListening = false;
  }

  // ── Pitch analysis ────────────────────────────────────────────────────────
  function analyzeFrame() {
    if (!audioSession.analyser || state.isLocked) return;

    const targetNote = getCurrentNote();
    if (!targetNote) return;

    const buffer = new Float32Array(audioSession.analyser.fftSize);
    audioSession.analyser.getFloatTimeDomainData(buffer);

    const gate = updateOnsetGate(state.onsetGateState, buffer);
    state.onsetGateState = gate.nextState;

    const targetPitch = `${targetNote.name}${targetNote.octave}`;
    const frameResult = classifyFrame(buffer, audioSession.audioCtx.sampleRate, targetPitch);

    // In easy mode we discard wrong frames so they neither advance nor reject.
    let effective = state.mode === 'easy' && frameResult.status === 'wrong'
      ? { ...frameResult, status: 'unsure' }
      : frameResult;

    if (!isOnsetGateOpen(state.onsetGateState)) {
      effective = { ...effective, status: 'unsure' };
    }

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
    state.onsetGateState = consumeOnsetGate(state.onsetGateState);

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
    state.onsetGateState = consumeOnsetGate(state.onsetGateState);
    updateFeedback('wrong');
    setTimeout(() => {
      state.isLocked = false;
      restartSequence();
    }, WRONG_FEEDBACK_MS);
  }

  // ── Settings ──────────────────────────────────────────────────────────────
  function syncSettingsUI() {
    syncSheetMusicMicUI(ui, state, syncFretSlider, syncStringToggles);
  }

  function wireSettings() {
    wireFretSlider(ui.slider, ui.sliderLabel, state.settings, () => {
      stopListening();
      generateNewBars();
      ui.startBtn.classList.remove('u-hidden');
      ui.stopBtn.classList.add('u-hidden');
    });

    wireStringToggles(
      ui.stringButtons,
      state.settings.activeStrings,
      () => {
        syncSettingsUI();
        stopListening();
        generateNewBars();
        setMicListeningUI(ui, false);
      },
    );

    ui.modeSelect.addEventListener('change', () => {
      state.mode = ui.modeSelect.value;
    });

    ui.newBarsBtn.addEventListener('click', () => {
      stopListening();
      generateNewBars();
      setMicListeningUI(ui, false);
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
      setMicListeningUI(ui, false);
    });
  }

  // ── Public API ────────────────────────────────────────────────────────────
  function mount() {
    ui = resolveSheetMusicMicUI(document);

    state = {
      bars:             [],
      currentBarIndex:  0,
      currentBeatIndex: 0,
      mode:             state.mode,
      isListening:      false,
      matchState:       createMatchState(),
      onsetGateState:   createOnsetGateState(),
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

    setMicListeningUI(ui, false);
    ui.feedback.textContent     = '';
    ui.permission.classList.add('u-hidden');
  }

  function unmount() {
    stopListening();
    ui = null;
  }

  return {
    mount,
    unmount,
    startExercise: mount,
    stopExercise: unmount,
  };
}
