import {
  generateBars, getFilteredNotes, getTimeSignatureConfig,
  EndlessBarGenerator,
} from './sheetMusicLogic.js';
import { renderScore } from './sheetMusicSVG.js';
import { PlaybackController } from './playbackController.js';
import { PlaybackBar } from './playbackBar.js';
import { wireStringToggles, syncStringToggles, wireFretSlider, syncFretSlider } from '../../utils/settings.js';
import {
  loadSheetMusicPrefs,
  saveSheetMusicActive,
  saveSheetMusicBpm,
  saveSheetMusicTimeSig,
  saveSheetMusicShowTab,
  saveSheetMusicEndless,
} from './sheetMusicReadingStorage.js';
import {
  resolveSheetMusicUI,
  syncSheetMusicUI,
  setPlaybackButtonState,
  updateStrategyStatus,
  updateCurrentNoteDisplay,
  updateFeedback,
  syncActiveUiVisibility,
  renderBeatDots,
  updateBeatDot,
  clearBeatDots,
  enumerateAndShowMics,
} from './sheetMusicReadingUI.js';
import { createRecordingUI } from './sheetMusicReadingRecordingUI.js';
import { createEndlessHelpers } from './sheetMusicReadingEndless.js';
import {
  createMatchState,
} from '../../shared/audio/fastNoteMatcher.js';
import { getSetting, SETTING_KEYS } from '../../shared/globalSettings.js';
import {
  classifySheetMusicFrame,
  resolveSheetMusicRecognitionStrategy,
  SHEET_MUSIC_CENTS_TOLERANCE,
  updateSheetMusicMatchState,
  setEssentiaSheetMusicStrategyInstance,
} from './sheetMusicRecognition.js';
import {
  resolveGuitarOnsetStrategy,
} from '../../shared/audio/guitarOnsetStrategies.js';
import { requestMicrophoneStream } from '../../shared/audio/microphoneService.js';
import {
  createAudioSessionState,
  openAudioSession,
  closeAudioSession,
} from '../../shared/audio/audioSessionService.js';
import { createRecorder } from './sheetMusicRecorder.js';
import { getEssentia } from '../chordExerciseEssentia/essentiaLoader.js';
import { createEssentiaSheetMusicStrategy } from './essentiaSheetMusicStrategy.js';

// Number of bars per rendered row (matches the 4-bar VexFlow layout).
const BARS_PER_ROW = 4;
const ENDLESS_VISIBLE_ROWS = 3;
const ENDLESS_SCROLL_TARGET_FRACTION = 0.33;
const ENDLESS_SCROLL_SHIFT_DELAY_MS = 420;
// Minimum notes in the pool before showing the "too few notes" warning.
const MIN_POOL_SIZE = 3;
const ANALYZE_INTERVAL_MS = 41;

// Preload Essentia WASM in the background so it is ready when the user starts.
getEssentia().then(ess => {
  setEssentiaSheetMusicStrategyInstance(createEssentiaSheetMusicStrategy(ess));
}).catch(err => {
  console.warn('[sheetMusicReading] Essentia nicht verfügbar:', err.message);
});

function resolveInjectedBars() {
  const injectedBars = globalThis.__GT_SHEET_MUSIC_READING_BARS__;
  if (typeof injectedBars === 'function') return injectedBars();
  return injectedBars ?? null;
}

export function createSheetMusicReadingFeature() {
  let wired = false;
  let ui = null;
  const prefs = loadSheetMusicPrefs();
  const audioSession = createAudioSessionState({ currentFftSize: 0 });
  let analyzeIntervalId = null;

  let state = {
    active: prefs.active,
    bars:    [],
    showTab: prefs.showTab,
    bpm: prefs.bpm,
    timeSig: prefs.timeSig,
    endless: prefs.endless,
    currentBarIndex: 0,
    currentBeatIndex: 0,
    isListening: false,
    isLocked: false,
    successTimeout: null,
    matchState: createMatchState(),
    onsetState: resolveGuitarOnsetStrategy(getSetting(SETTING_KEYS.SHEET_MUSIC_ONSET_STRATEGY)).createState(),
    awaitingOnset: true,
    selectedMicDeviceId: null,
    settings: {
      maxFret: 3,
      activeStrings: [0, 1, 2, 3, 4, 5],
    },
  };

  // ── Playback state ──────────────────────────────────────────────────────
  const playback    = new PlaybackController();
  const playbackBar = new PlaybackBar(); // used in normal mode only
  let   isPlaying   = false;

  // ── Recording state ─────────────────────────────────────────────────────
  const recorder = createRecorder();
  let savedRecordings = []; // Array<{ baseName, wav, manifest }>
  const { syncRecordingUI, startRecording, stopRecording, cancelRecording, downloadRecordings } = createRecordingUI({
    recorder, getSaved: () => savedRecordings, setSaved: v => { savedRecordings = v; },
    getAudioSession: () => audioSession, getUI: () => ui,
  });

  // ── Endless mode state ──────────────────────────────────────────────────
  const endlessS = { gen: null, rowDivs: [], playbackBars: [], staveLayouts: [], firstRowIndex: 0, shiftTimeoutId: null, pendingAsset: null };
  const { appendEndlessRow, clearEndlessShiftTimeout, shiftEndlessWindowToRow, cleanupEndlessState } =
    createEndlessHelpers(endlessS, () => state, () => ui, BARS_PER_ROW, ENDLESS_SCROLL_TARGET_FRACTION, ENDLESS_SCROLL_SHIFT_DELAY_MS);

  function getNotesPool() {
    return getFilteredNotes(state.settings.maxFret, state.settings.activeStrings);
  }

  function getTimeSigConfig() {
    return getTimeSignatureConfig(state.timeSig) || getTimeSignatureConfig('4/4');
  }

  function isTimedRecognitionMode() {
    return state.active && isPlaying;
  }

  function getCurrentNote() {
    const { currentBarIndex: bi, currentBeatIndex: ni } = state;
    if (bi < 0 || bi >= state.bars.length) return null;
    return state.bars[bi]?.[ni] ?? null;
  }

  function clearSuccessTimeout() {
    if (!state.successTimeout) return;
    clearTimeout(state.successTimeout);
    state.successTimeout = null;
  }

  function clearNoteStatuses() {
    for (const bar of state.bars) {
      for (const note of bar) {
        delete note.status;
      }
    }
  }

  function markCurrentNote() {
    if (!state.active) return;
    const note = getCurrentNote();
    if (note) note.status = 'current';
  }

  function resetActiveSequenceState() {
    clearSuccessTimeout();
    state.currentBarIndex = 0;
    state.currentBeatIndex = 0;
    state.matchState = createMatchState();
    state.onsetState = resolveGuitarOnsetStrategy(getSetting(SETTING_KEYS.SHEET_MUSIC_ONSET_STRATEGY)).createState();
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

  function renderCurrentScore() {
    if (state.endless && endlessS.rowDivs.length > 0) return;
    const result = renderScore(
      ui.container,
      state.bars,
      state.showTab,
      state.timeSig,
    );

    if (result?.notationDiv && result?.staveLayout) {
      playbackBar.render(result.notationDiv, result.staveLayout, result.vw);
      if (!isPlaying) playbackBar.hide();
    }
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

  async function stopListening() {
    clearInterval(analyzeIntervalId);
    analyzeIntervalId = null;
    clearSuccessTimeout();
    state.isListening = false;
    await closeAudioSession(audioSession, {
      reset: session => {
        session.currentFftSize = 0;
      },
    });
  }

  async function startListening() {
    if (state.isListening || !state.active) return;

    ui.permission.classList.remove('u-hidden');
    ui.permission.textContent = 'Mikrofon-Zugriff wird benötigt…';

    let microphoneStream;
    try {
      const audioConstraints = {
        noiseSuppression: false,
        echoCancellation: false,
        autoGainControl: false,
      };
      if (state.selectedMicDeviceId) {
        audioConstraints.deviceId = { ideal: state.selectedMicDeviceId };
      }
      microphoneStream = await requestMicrophoneStream({
        constraints: { audio: audioConstraints, video: false },
      });
    } catch {
      ui.permission.textContent = 'Mikrofon nicht verfügbar. Bitte Zugriff erlauben.';
      return;
    }

    try {
      await openAudioSession(audioSession, {
        stream: microphoneStream,
        fftSize: 4096,
        AudioContextCtor: AudioContext,
      });
    } catch {
      ui.permission.classList.remove('u-hidden');
      ui.permission.textContent = 'Audio-Kontext konnte nicht gestartet werden. Bitte Seite neu laden.';
      return;
    }

    ui.permission.classList.add('u-hidden');
    state.isListening = true;
    applyTargetFftSize();
    analyzeIntervalId = setInterval(analyzeFrame, ANALYZE_INTERVAL_MS);
    void enumerateAndShowMics(ui);
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
    state.matchState = createMatchState();
    state.awaitingOnset = true;

    const note = getCurrentNote();
    if (!note) return;
    if (note.status === 'correct' && isTimedRecognitionMode()) {
      return;
    }
    note.status = 'correct';

    renderCurrentScore();
    updateFeedback(ui, state, 'correct');

    if (isTimedRecognitionMode()) {
      updateCurrentNoteDisplay(ui, state, getCurrentNote());
      return;
    }

    advanceToNextNote();
    if (state.currentBarIndex === -1) {
      return;
    }
    applyTargetFftSize();
    renderCurrentScore();
    updateCurrentNoteDisplay(ui, state, getCurrentNote());
    updateFeedback(ui, state);
  }

  function analyzeFrame() {
    if (!state.active || !state.isListening || !audioSession.analyser || state.isLocked) return;

    const targetNote = getCurrentNote();
    if (!targetNote) return;

    const buffer = new Float32Array(audioSession.analyser.fftSize);
    audioSession.analyser.getFloatTimeDomainData(buffer);

    let frequencyData = null;
    if (typeof audioSession.analyser.getFloatFrequencyData === 'function') {
      frequencyData = new Float32Array(audioSession.analyser.frequencyBinCount ?? audioSession.analyser.fftSize / 2);
      // Changing this capture path requires regenerating the note-onset analyser goldens.
      audioSession.analyser.getFloatFrequencyData(frequencyData);
    }

    const onsetStrategy = resolveGuitarOnsetStrategy(getSetting(SETTING_KEYS.SHEET_MUSIC_ONSET_STRATEGY));
    const onset = onsetStrategy.update(state.onsetState, {
      frequencyData,
      samples: buffer,
    });
    state.onsetState = onset.nextState;
    if (onset.event === 'onset') {
      if (!state.awaitingOnset) {
        state.matchState = createMatchState();
      }
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

    if (state.awaitingOnset) {
      effective = { ...effective, status: 'unsure' };
    }

    const { nextState, event } = updateSheetMusicMatchState(state.matchState, effective);
    state.matchState = nextState;

    if (event === 'accept') {
      handleCorrectNote();
    }
  }

  function setTimedCurrentNote(barIndex, beatIndex) {
    const previous = getCurrentNote();
    if (previous?.status === 'current') {
      previous.status = 'pending';
    }

    state.currentBarIndex = barIndex;
    state.currentBeatIndex = beatIndex;

    const note = getCurrentNote();
    if (!note) return;
    if (note.status !== 'correct') {
      note.status = 'current';
    }
  }

  function finishTimedPass() {
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
    stopPlayback();
    regenerate();
    updateFeedback(ui, state);
    startPlayback();
  }

  function handleTimedBeat({ barIndex, beatIndex, globalBeat, totalBeats }) {
    if (!state.active) return;

    if (globalBeat >= totalBeats) {
      const previous = getCurrentNote();
      if (previous?.status === 'current') {
        previous.status = 'wrong';
      }

      if (state.endless) {
        restartTimedEndlessPass();
      } else {
        stopPlayback();
        finishTimedPass();
      }
      return;
    }

    const previous = getCurrentNote();
    const sameSlot = state.currentBarIndex === barIndex && state.currentBeatIndex === beatIndex;

    if (!sameSlot && previous?.status === 'current') {
      previous.status = 'wrong';
    }

    setTimedCurrentNote(barIndex, beatIndex);
    state.matchState = createMatchState();
    state.awaitingOnset = true;
    state.isLocked = false;
    renderCurrentScore();
    updateCurrentNoteDisplay(ui, state, getCurrentNote());
    updateFeedback(ui, state);
    applyTargetFftSize();
  }

  async function setActiveMode(nextActive) {
    if (state.active === nextActive) return;
    state.active = nextActive;
    saveSheetMusicActive(state.active);
    syncSettingsUI();
    syncActiveUiVisibility(ui, state);

    if (!state.active) {
      await stopListening();
      resetActiveSequenceState();
      renderCurrentScore();
      updateCurrentNoteDisplay(ui, state, getCurrentNote());
      updateFeedback(ui, state);
      return;
    }

    resetActiveSequenceState();
    renderCurrentScore();
    updateCurrentNoteDisplay(ui, state, getCurrentNote());
    updateFeedback(ui, state);
    startListening();
  }

  // ── Pool warning ────────────────────────────────────────────────────────
  function updatePoolWarning() {
    const el = ui?.poolWarning;
    if (el) el.hidden = getNotesPool().length >= MIN_POOL_SIZE;
  }

  // ── Score rendering (normal mode) ───────────────────────────────────────
  function regenerate() {
    updatePoolWarning();
    const config = getTimeSigConfig();
    const injectedBars = resolveInjectedBars();
    state.bars = Array.isArray(injectedBars)
      ? injectedBars.map(bar => bar.map(note => ({ ...note })))
      : generateBars(BARS_PER_ROW, config.beatsPerBar, getNotesPool());
    resetActiveSequenceState();
    renderCurrentScore();
    updateCurrentNoteDisplay(ui, state, getCurrentNote());
    if (state.active && state.isListening) {
      applyTargetFftSize();
    }
  }

  // ── BPM adjustment (used by keyboard shortcuts) ─────────────────────────
  function adjustBpm(delta) {
    const newBpm = Math.min(240, Math.max(40, state.bpm + delta));
    if (newBpm === state.bpm) return;
    state.bpm = newBpm;
    if (ui.bpmSlider) ui.bpmSlider.value = String(newBpm);
    if (ui.bpmLabel) ui.bpmLabel.textContent = String(newBpm);
    saveSheetMusicBpm(newBpm);
    playback.setBpm(newBpm);
  }

  // ── Playback control – normal mode ──────────────────────────────────────
  function startPlayback() {
    if (isPlaying) return;
    isPlaying = true;

    setPlaybackButtonState(ui.playBtn, true);

    const config     = getTimeSigConfig();
    const totalBeats = state.bars.length * config.beatsPerBar;

    playback.onBeat(({ barIndex, beatIndex, globalBeat }) => {
      if (state.active) {
        handleTimedBeat({ barIndex, beatIndex, globalBeat, totalBeats });
      }
      playbackBar.moveToBeat(barIndex, beatIndex, config.beatsPerBar);
    });

    playback.onTick(({ beatIndex }) => updateBeatDot(ui, beatIndex));

    // Immediately snap cursor to the first note so it's visible during count-in.
    playbackBar.show();
    playbackBar.moveToBeat(0, 0, config.beatsPerBar);

    playback.start(state.bpm, config.beatsPerBar, totalBeats, config.beatsPerBar);
  }

  // ── Playback control – endless mode ─────────────────────────────────────
  function startEndlessPlayback() {
    if (isPlaying) return;
    isPlaying = true;

    setPlaybackButtonState(ui.playBtn, true);

    const container = document.getElementById('score-container');
    container.innerHTML = '';
    container.classList.add('score-container--endless');

    // Reset endless state
    endlessS.rowDivs = [];
    endlessS.playbackBars = [];
    endlessS.staveLayouts = [];
    endlessS.firstRowIndex = 0;
    clearEndlessShiftTimeout();

    const config = getTimeSigConfig();
    endlessS.gen = new EndlessBarGenerator(config.beatsPerBar, getNotesPool());

    for (let i = 0; i < ENDLESS_VISIBLE_ROWS; i++) appendEndlessRow();

    // Show first row's playback bar and snap it to the first beat immediately.
    endlessS.playbackBars[0].show();
    endlessS.playbackBars[0].moveToBeat(0, 0, config.beatsPerBar);

    playback.onBeat(({ barIndex, beatIndex }) => {
      const rowIndex   = Math.floor(barIndex / BARS_PER_ROW);
      const barInRow   = barIndex % BARS_PER_ROW;
      const visibleRowIndex = rowIndex - endlessS.firstRowIndex;

      // Show only the current row's playback bar
      endlessS.playbackBars.forEach((bar, i) => {
        if (i === visibleRowIndex) bar.show(); else bar.hide();
      });

      // Move the playback bar within the current row
      if (endlessS.playbackBars[visibleRowIndex]) {
        endlessS.playbackBars[visibleRowIndex].moveToBeat(
          barInRow, beatIndex, config.beatsPerBar,
        );
      }

      if (barInRow === 0 && beatIndex === 0 && rowIndex > endlessS.firstRowIndex) {
        shiftEndlessWindowToRow(rowIndex);
      }
    });

    playback.onTick(({ beatIndex }) => updateBeatDot(ui, beatIndex));

    // 0 = no wrap (play forever)
    playback.start(state.bpm, config.beatsPerBar, 0, config.beatsPerBar);
  }

  function stopPlayback() {
    if (!isPlaying) return;
    isPlaying = false;
    playback.stop();
    clearBeatDots(ui);

    if (state.endless) {
      cleanupEndlessState();
    } else {
      playbackBar.hide();
    }

    setPlaybackButtonState(ui.playBtn, false);
  }

  function togglePlayback() {
    if (isPlaying) {
      stopPlayback();
      // After stopping endless mode, restore the normal 4-bar view
      if (state.endless) regenerate();
    } else {
      if (state.endless && !state.active) startEndlessPlayback(); else startPlayback();
    }
  }

  // ── Settings sync ───────────────────────────────────────────────────────
  function syncSettingsUI() {
    syncSheetMusicUI(ui, state, syncFretSlider, syncStringToggles, updatePoolWarning);
    syncActiveUiVisibility(ui, state);
    updateCurrentNoteDisplay(ui, state, getCurrentNote());
  }

  // ── Exercise lifecycle ──────────────────────────────────────────────────
  function mount() {
    ui = resolveSheetMusicUI(document);
    savedRecordings = [];
    const searchParams = new URLSearchParams(globalThis.location?.search ?? '');
    if (searchParams.get('active') === '1') {
      state.active = true;
    }
    regenerate();

    if (!wired) {
      // New bars
      ui.newBarsBtn.addEventListener('click', () => {
        stopPlayback();
        if (state.endless) cleanupEndlessState();
        regenerate();
        updateFeedback(ui, state);
      });

      ui.activeBtn.addEventListener('click', () => {
        void setActiveMode(!state.active);
      });

      // Tab toggle
      ui.showTabBtn.addEventListener('click', () => {
        state.showTab = !state.showTab;
        saveSheetMusicShowTab(state.showTab);
        ui.showTabBtn.classList.toggle('active', state.showTab);
        if (!isPlaying) {
          renderCurrentScore();
        }
      });

      // Endless mode toggle
      ui.endlessBtn.addEventListener('click', () => {
        stopPlayback();
        if (state.endless) cleanupEndlessState();
        state.endless = !state.endless;
        saveSheetMusicEndless(state.endless);
        ui.endlessBtn.classList.toggle('active', state.endless);
        regenerate();
      });

      // Play / Stop
      ui.playBtn.addEventListener('click', togglePlayback);

      // Recording controls
      ui.recordBtn?.addEventListener('click', () => void startRecording());
      ui.recordStopBtn?.addEventListener('click', () => void stopRecording(state));
      ui.recordCancelBtn?.addEventListener('click', cancelRecording);
      ui.downloadBtn?.addEventListener('click', downloadRecordings);
      ui.analyseBtn?.addEventListener('click', () => {
        window.location.href = '../audio-analyse/index.html';
      });
      ui.recordingsBtn?.addEventListener('click', () => {
        window.location.href = '../recordings/index.html';
      });

      // BPM slider
      ui.bpmSlider.addEventListener('input', () => {
        state.bpm = parseInt(ui.bpmSlider.value, 10);
        if (ui.bpmLabel) ui.bpmLabel.textContent = String(state.bpm);
        saveSheetMusicBpm(state.bpm);
        playback.setBpm(state.bpm);
      });

      // Time signature selector
      ui.timeSigSelect.addEventListener('change', e => {
        state.timeSig = e.target.value;
        saveSheetMusicTimeSig(state.timeSig);
        stopPlayback();
        if (state.endless) cleanupEndlessState();
        renderBeatDots(ui, state.timeSig);
        regenerate();
      });

      // Fret range slider
      wireFretSlider(ui.fretSlider, ui.fretLabel, state.settings, () => {
        stopPlayback();
        if (state.endless) cleanupEndlessState();
        regenerate();
        updateFeedback(ui, state);
      });

      // String toggles
      wireStringToggles(
        ui.stringButtons,
        state.settings.activeStrings,
        () => {
          syncSettingsUI();
          stopPlayback();
          if (state.endless) cleanupEndlessState();
          regenerate();
          updateFeedback(ui, state);
        },
      );

      // Keyboard shortcuts (scoped to active view)
      document.addEventListener('keydown', e => {
        if (!ui.view?.classList.contains('active')) return;
        if (['INPUT', 'SELECT', 'TEXTAREA'].includes(e.target.tagName)) return;
        switch (e.code) {
          case 'Space':
            e.preventDefault();
            togglePlayback();
            break;
          case 'ArrowUp':
            e.preventDefault();
            adjustBpm(5);
            break;
          case 'ArrowDown':
            e.preventDefault();
            adjustBpm(-5);
            break;
          case 'KeyR':
            document.getElementById('btn-new-bars')?.click();
            break;
          case 'KeyT':
            document.getElementById('btn-show-tab')?.click();
            break;
          case 'KeyE':
            document.getElementById('btn-endless-mode')?.click();
            break;
        }
      });

      // Pause when the browser tab loses focus (avoids desync)
      document.addEventListener('visibilitychange', () => {
        if (document.hidden && isPlaying) {
          stopPlayback();
          if (state.endless) regenerate();
        }
      });

      // Microphone selection
      ui.micSelect?.addEventListener('change', async () => {
        state.selectedMicDeviceId = ui.micSelect.value || null;
        if (state.isListening) {
          await stopListening();
          await startListening();
        }
      });

      wired = true;
    }

    syncSettingsUI();
    syncRecordingUI();
    renderBeatDots(ui, state.timeSig);
    updateFeedback(ui, state);
    updateStrategyStatus();
    if (ui.permission) {
      ui.permission.classList.add('u-hidden');
      ui.permission.textContent = '';
    }
    if (state.active) {
      startListening();
    }
  }

  function unmount() {
    stopPlayback();
    if (state.endless) cleanupEndlessState();
    void stopListening();
    ui = null;
  }

  return {
    mount,
    unmount,
    startExercise: mount,
    stopExercise: unmount,
  };
}
