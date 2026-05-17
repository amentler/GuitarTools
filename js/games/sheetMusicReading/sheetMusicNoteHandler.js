import { createMatchState } from '../../shared/audio/fastNoteMatcher.js';
import { getSetting, SETTING_KEYS } from '../../shared/globalSettings.js';
import {
  classifySheetMusicFrame,
  resolveSheetMusicRecognitionStrategy,
  SHEET_MUSIC_CENTS_TOLERANCE,
  updateSheetMusicMatchState,
} from './sheetMusicRecognition.js';
import { resolveGuitarOnsetStrategy } from '../../shared/audio/guitarOnsetStrategies.js';
import {
  createLiveXGBoostOnsetState,
  updateLiveXGBoostOnsetDetector,
} from '../../shared/audio/liveXGBoostOnsetDetector.js';
import { updateCurrentNoteDisplay, updateFeedback } from './sheetMusicReadingUI.js';
import { createGlobalDebugStore } from '../../shared/debug/index.js';
import { ONSET_LIVE_ANALYZE_INTERVAL_MS } from '../../shared/audio/onsetPipelineConfig.js';

const LIVE_XGBOOST_DEBUG_INTERVAL_FRAMES = 120;

export function createNoteHandler({
  state, audioSession, getUI, isTimedRecognitionMode,
  renderCurrentScore, regenerate, onStopPlayback, onStartPlayback,
}) {
  const debugStore = createGlobalDebugStore();
  let analyzeFrameInFlight = false;
  let droppedAnalyzeFrames = 0;

  function readBrowserMemory() {
    const memory = globalThis.performance?.memory;
    if (!memory) return null;
    return {
      usedJSHeapSize: memory.usedJSHeapSize ?? null,
      totalJSHeapSize: memory.totalJSHeapSize ?? null,
      jsHeapSizeLimit: memory.jsHeapSizeLimit ?? null,
    };
  }

  function logLiveXGBoostPerf(onset) {
    const frames = onset.nextState?.perf?.frames ?? 0;
    if (!debugStore.isEnabled() || frames === 0 || frames % LIVE_XGBOOST_DEBUG_INTERVAL_FRAMES !== 0) return;
    debugStore.addEntry('live-xgboost:perf', {
      frames,
      elapsedMs: Number(onset.elapsedMs.toFixed(3)),
      averageElapsedMs: Number(onset.averageElapsedMs.toFixed(3)),
      maxElapsedMs: Number(onset.maxElapsedMs.toFixed(3)),
      intervalMs: ONSET_LIVE_ANALYZE_INTERVAL_MS,
      overInterval: onset.elapsedMs > ONSET_LIVE_ANALYZE_INTERVAL_MS,
      hardwareConcurrency: globalThis.navigator?.hardwareConcurrency ?? null,
      droppedAnalyzeFrames,
      probability: Number(onset.probability.toFixed(4)),
      memory: readBrowserMemory(),
    }, { source: 'sheetMusicReading' });
  }
  function getCurrentNote() {
    const { currentBarIndex: bi, currentBeatIndex: ni } = state;
    if (bi < 0 || bi >= state.bars.length) return null;
    return state.bars[bi]?.[ni] ?? null;
  }

  function markCurrentNote() {
    if (!state.active) return;
    const note = getCurrentNote();
    if (note) note.status = 'current';
  }

  function clearNoteStatuses() {
    for (const bar of state.bars) {
      for (const note of bar) {
        delete note.status;
      }
    }
  }

  function clearSuccessTimeout() {
    if (!state.successTimeout) return;
    clearTimeout(state.successTimeout);
    state.successTimeout = null;
  }

  function applyTargetFftSize() {
    if (!audioSession.analyser || !state.active) return;
    const note = getCurrentNote();
    if (!note) return;
    const targetPitch = `${note.name}${note.octave}`;
    const strategy = resolveSheetMusicRecognitionStrategy(
      getSetting(SETTING_KEYS.SHEET_MUSIC_RECOGNITION_STRATEGY),
    );
    const recommended = strategy.getRecommendedFftSize(targetPitch, audioSession.audioCtx?.sampleRate ?? 44100);
    if (recommended !== audioSession.currentFftSize) {
      audioSession.analyser.fftSize = recommended;
      audioSession.currentFftSize = recommended;
    }
  }

  async function prepareOnsetState() {
    const onsetStrategy = resolveGuitarOnsetStrategy(getSetting(SETTING_KEYS.SHEET_MUSIC_ONSET_STRATEGY));
    if (onsetStrategy.offlineDetector !== 'xgboost') {
      state.onsetState = onsetStrategy.createState();
      return;
    }

    const startedAt = performance.now();
    try {
      state.onsetState = await createLiveXGBoostOnsetState({
        baseStrategyKey: onsetStrategy.baseStrategyKey,
      });
      debugStore.addEntry('live-xgboost:init', {
        elapsedMs: Number((performance.now() - startedAt).toFixed(3)),
        hardwareConcurrency: globalThis.navigator?.hardwareConcurrency ?? null,
        memory: readBrowserMemory(),
      }, { source: 'sheetMusicReading' });
    } catch (err) {
      const fallback = resolveGuitarOnsetStrategy(onsetStrategy.baseStrategyKey);
      state.onsetState = fallback.createState();
      debugStore.addEntry('live-xgboost:init-failed', {
        message: err?.message ?? String(err),
        fallbackStrategyKey: fallback.key,
      }, { source: 'sheetMusicReading', level: 'warn' });
    }
  }

  function resetActiveSequenceState() {
    clearSuccessTimeout();
    state.currentBarIndex = 0;
    state.currentBeatIndex = 0;
    state.matchState = createMatchState();
    state.onsetState = null;
    void prepareOnsetState();
    state.awaitingOnset = true;
    state.isLocked = false;

    if (!state.active) {
      clearNoteStatuses();
      return;
    }

    for (const bar of state.bars) {
      for (const note of bar) {
        note.status = 'pending';
      }
    }
    markCurrentNote();
  }

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
    state.currentBarIndex = bi;
    state.currentBeatIndex = ni;
    markCurrentNote();
  }

  function handleSequenceComplete() {
    const ui = getUI();
    if (state.endless && !isTimedRecognitionMode()) {
      regenerate();
      applyTargetFftSize();
      updateFeedback(ui, state);
      return;
    }

    state.currentBarIndex = -1;
    state.currentBeatIndex = -1;
    state.matchState = createMatchState();
    state.awaitingOnset = true;
    state.isLocked = false;
    renderCurrentScore();
    updateCurrentNoteDisplay(ui, state, getCurrentNote());
    updateFeedback(ui, state, 'correct', 'Alle Noten gespielt! ✓');
  }

  function handleCorrectNote() {
    const ui = getUI();
    state.matchState = createMatchState();
    state.awaitingOnset = true;

    const note = getCurrentNote();
    if (!note) return;
    if (note.status === 'correct' && isTimedRecognitionMode()) return;
    note.status = 'correct';

    renderCurrentScore();
    updateFeedback(ui, state, 'correct');

    if (isTimedRecognitionMode()) {
      updateCurrentNoteDisplay(ui, state, getCurrentNote());
      return;
    }

    advanceToNextNote();
    if (state.currentBarIndex === -1) return;
    applyTargetFftSize();
    renderCurrentScore();
    updateCurrentNoteDisplay(ui, state, getCurrentNote());
    updateFeedback(ui, state);
  }

  async function analyzeFrame() {
    if (analyzeFrameInFlight) {
      droppedAnalyzeFrames++;
      return;
    }
    analyzeFrameInFlight = true;
    try {
      await analyzeFrameInternal();
    } finally {
      analyzeFrameInFlight = false;
    }
  }

  async function analyzeFrameInternal() {
    if (!state.active || !state.isListening || !audioSession.analyser || state.isLocked) return;

    const targetNote = getCurrentNote();
    if (!targetNote) return;
    if (!state.onsetState) return;

    const buffer = new Float32Array(audioSession.analyser.fftSize);
    audioSession.analyser.getFloatTimeDomainData(buffer);

    let frequencyData = null;
    if (typeof audioSession.analyser.getFloatFrequencyData === 'function') {
      frequencyData = new Float32Array(audioSession.analyser.frequencyBinCount ?? audioSession.analyser.fftSize / 2);
      // Changing this capture path requires regenerating the note-onset analyser goldens.
      audioSession.analyser.getFloatFrequencyData(frequencyData);
    }

    const onsetStrategy = resolveGuitarOnsetStrategy(getSetting(SETTING_KEYS.SHEET_MUSIC_ONSET_STRATEGY));
    const useLiveXGBoost = onsetStrategy.offlineDetector === 'xgboost'
      && state.onsetState?.model
      && state.onsetState?.baseStrategy;
    let onset;
    if (useLiveXGBoost) {
      onset = await updateLiveXGBoostOnsetDetector(state.onsetState, {
        frequencyData,
        samples: buffer,
        sampleRate: audioSession.audioCtx.sampleRate,
      });
    } else {
      const fallbackStrategy = resolveGuitarOnsetStrategy(onsetStrategy.baseStrategyKey ?? onsetStrategy.key);
      onset = fallbackStrategy.update(state.onsetState, { frequencyData, samples: buffer });
    }
    state.onsetState = onset.nextState;
    if (useLiveXGBoost) logLiveXGBoostPerf(onset);
    if (onset.event === 'onset') {
      if (!state.awaitingOnset) state.matchState = createMatchState();
      state.awaitingOnset = false;
    }

    const targetPitch = `${targetNote.name}${targetNote.octave}`;
    const frameResult = classifySheetMusicFrame(buffer, audioSession.audioCtx.sampleRate, targetPitch, {
      tolerateCents: SHEET_MUSIC_CENTS_TOLERANCE,
      strategyKey: getSetting(SETTING_KEYS.SHEET_MUSIC_RECOGNITION_STRATEGY),
    });
    let effective = frameResult.status === 'wrong'
      ? { ...frameResult, status: 'unsure' }
      : frameResult;

    if (state.awaitingOnset) effective = { ...effective, status: 'unsure' };

    const { nextState, event } = updateSheetMusicMatchState(state.matchState, effective);
    state.matchState = nextState;

    if (event === 'accept') handleCorrectNote();
  }

  function setTimedCurrentNote(barIndex, beatIndex) {
    const previous = getCurrentNote();
    if (previous?.status === 'current') previous.status = 'pending';

    state.currentBarIndex = barIndex;
    state.currentBeatIndex = beatIndex;

    const note = getCurrentNote();
    if (!note) return;
    if (note.status !== 'correct') note.status = 'current';
  }

  function finishTimedPass() {
    const ui = getUI();
    state.currentBarIndex = -1;
    state.currentBeatIndex = -1;
    state.matchState = createMatchState();
    state.awaitingOnset = true;
    state.isLocked = false;
    renderCurrentScore();
    updateCurrentNoteDisplay(ui, state, getCurrentNote());
    updateFeedback(ui, state, 'correct', 'Durchlauf beendet.');
  }

  function restartTimedEndlessPass() {
    const ui = getUI();
    onStopPlayback();
    regenerate();
    updateFeedback(ui, state);
    onStartPlayback();
  }

  function handleTimedBeat({ barIndex, beatIndex, globalBeat, totalBeats }) {
    const ui = getUI();
    if (!state.active) return;

    if (globalBeat >= totalBeats) {
      const previous = getCurrentNote();
      if (previous?.status === 'current') previous.status = 'wrong';

      if (state.endless) {
        restartTimedEndlessPass();
      } else {
        onStopPlayback();
        finishTimedPass();
      }
      return;
    }

    const previous = getCurrentNote();
    const sameSlot = state.currentBarIndex === barIndex && state.currentBeatIndex === beatIndex;
    if (!sameSlot && previous?.status === 'current') previous.status = 'wrong';

    setTimedCurrentNote(barIndex, beatIndex);
    state.matchState = createMatchState();
    state.awaitingOnset = true;
    state.isLocked = false;
    renderCurrentScore();
    updateCurrentNoteDisplay(ui, state, getCurrentNote());
    updateFeedback(ui, state);
    applyTargetFftSize();
  }

  return {
    getCurrentNote,
    resetActiveSequenceState,
    applyTargetFftSize,
    clearSuccessTimeout,
    analyzeFrame,
    handleTimedBeat,
  };
}
