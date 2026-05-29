import {
  generateBars, generateArpeggioBars, getFilteredNotes, getTimeSignatureConfig, normalizeMajorKey,
} from './sheetMusicLogic.js';
import { renderScore } from './sheetMusicSVG.js';
import { PlaybackController } from './playbackController.js';
import { PlaybackBar } from './playbackBar.js';
import { wireFretSlider, syncFretSlider, wireMinFretSlider, syncMinFretSlider } from '../../utils/settings.js';
import {
  loadSheetMusicPrefs,
  saveSheetMusicActive,
  saveSheetMusicBpm,
  saveSheetMusicKey,
  saveSheetMusicTimeSig,
  saveSheetMusicShowTab,
  saveSheetMusicEndless,
  saveSheetMusicUseKey,
  saveSheetMusicArpeggio,
} from './sheetMusicReadingStorage.js';
import {
  resolveSheetMusicUI,
  syncSheetMusicUI,
  updateStrategyStatus,
  updateCurrentNoteDisplay,
  updateFeedback,
  syncActiveUiVisibility,
  renderBeatDots,
} from './sheetMusicReadingUI.js';
import { createRecordingUI } from './sheetMusicReadingRecordingUI.js';
import { createEndlessHelpers } from './sheetMusicReadingEndless.js';
import { setEssentiaSheetMusicStrategyInstance } from './sheetMusicRecognition.js';
import { createAudioSessionState } from '../../shared/audio/audioSessionService.js';
import { createRecorder } from './sheetMusicRecorder.js';
import { getEssentia } from '../chordExerciseEssentia/essentiaLoader.js';
import { createEssentiaSheetMusicStrategy } from './essentiaSheetMusicStrategy.js';
import { createListeningController } from './sheetMusicListening.js';
import { createNoteHandler } from './sheetMusicNoteHandler.js';
import { createPlaybackControl } from './sheetMusicPlaybackControl.js';

// Number of bars per rendered row (matches the 4-bar VexFlow layout).
const BARS_PER_ROW = 4;
const ENDLESS_SCROLL_TARGET_FRACTION = 0.33;
const ENDLESS_SCROLL_SHIFT_DELAY_MS = 420;
const ALL_STRING_INDICES = [0, 1, 2, 3, 4, 5];

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
    matchState: null,
    onsetState: null,
    awaitingOnset: true,
    selectedMicDeviceId: null,
    settings: {
      maxFret: 3,
      minFret: 0,
      key: normalizeMajorKey(prefs.key),
      activeStrings: [0, 1, 2, 3, 4, 5],
      useKey: prefs.useKey,
      arpeggio: prefs.arpeggio,
    },
  };

  // ── Playback state ──────────────────────────────────────────────────────
  const playback    = new PlaybackController();
  const playbackBar = new PlaybackBar(); // used in normal mode only

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
    const filtered = getFilteredNotes(
      state.settings.maxFret,
      state.settings.activeStrings,
      state.settings.minFret,
      state.settings.key,
      state.settings.useKey,
    );
    if (filtered.length > 0) return filtered;
    return getFilteredNotes(8, ALL_STRING_INDICES, 0, state.settings.key, state.settings.useKey);
  }

  function getTimeSigConfig() {
    return getTimeSignatureConfig(state.timeSig) || getTimeSignatureConfig('4/4');
  }

  // ── Note handler (groups 1-partial + 4) ────────────────────────────────
  const noteHandler = createNoteHandler({
    state,
    audioSession,
    getUI: () => ui,
    isTimedRecognitionMode: () => state.active && playbackControl.isPlaying(),
    renderCurrentScore: () => renderCurrentScore(),
    regenerate: () => regenerate(),
    onStopPlayback: () => playbackControl.stopPlayback(),
    onStartPlayback: () => playbackControl.startPlayback(),
  });

  // ── Playback control (group 6) ──────────────────────────────────────────
  const playbackControl = createPlaybackControl({
    state,
    getUI: () => ui,
    playback,
    playbackBar,
    endlessS,
    appendEndlessRow,
    clearEndlessShiftTimeout,
    shiftEndlessWindowToRow,
    cleanupEndlessState,
    getNotesPool,
    getTimeSigConfig,
    onTimedBeat: noteHandler.handleTimedBeat,
    regenerate: () => regenerate(),
    BARS_PER_ROW,
  });

  // ── Listening controller (group 3) ──────────────────────────────────────
  const listeningController = createListeningController({
    state,
    audioSession,
    getUI: () => ui,
    onAnalyzeFrame: noteHandler.analyzeFrame,
    onApplyFftSize: noteHandler.applyTargetFftSize,
    onClearSuccessTimeout: noteHandler.clearSuccessTimeout,
  });

  // ── Score rendering (normal mode) ───────────────────────────────────────
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
      if (!playbackControl.isPlaying()) playbackBar.hide();
    }
  }

  // ── Score/bars management ───────────────────────────────────────────────
  function regenerate() {
    const config = getTimeSigConfig();
    const injectedBars = resolveInjectedBars();
    if (Array.isArray(injectedBars)) {
      state.bars = injectedBars.map(bar => bar.map(note => ({ ...note })));
    } else if (state.settings.arpeggio) {
      state.bars = generateArpeggioBars(BARS_PER_ROW, config.beatsPerBar, getNotesPool(), state.settings.key);
    } else {
      state.bars = generateBars(BARS_PER_ROW, config.beatsPerBar, getNotesPool());
    }
    noteHandler.resetActiveSequenceState();
    renderCurrentScore();
    updateCurrentNoteDisplay(ui, state, noteHandler.getCurrentNote());
    if (state.active && state.isListening) {
      noteHandler.applyTargetFftSize();
    }
  }

  // ── Settings sync ───────────────────────────────────────────────────────
  function syncSettingsUI() {
    syncSheetMusicUI(ui, state, syncFretSlider, syncMinFretSlider);
    syncActiveUiVisibility(ui, state);
    updateCurrentNoteDisplay(ui, state, noteHandler.getCurrentNote());
  }

  // ── Active mode ─────────────────────────────────────────────────────────
  async function setActiveMode(nextActive) {
    if (state.active === nextActive) return;
    state.active = nextActive;
    saveSheetMusicActive(state.active);
    syncSettingsUI();
    syncActiveUiVisibility(ui, state);

    if (!state.active) {
      await listeningController.stopListening();
      noteHandler.resetActiveSequenceState();
      renderCurrentScore();
      updateCurrentNoteDisplay(ui, state, noteHandler.getCurrentNote());
      updateFeedback(ui, state);
      return;
    }

    noteHandler.resetActiveSequenceState();
    renderCurrentScore();
    updateCurrentNoteDisplay(ui, state, noteHandler.getCurrentNote());
    updateFeedback(ui, state);
    listeningController.startListening();
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
      ui.newBarsBtn.addEventListener('click', () => {
        playbackControl.stopPlayback();
        if (state.endless) cleanupEndlessState();
        regenerate();
        updateFeedback(ui, state);
      });

      ui.activeBtn.addEventListener('click', () => {
        void setActiveMode(!state.active);
      });

      ui.showTabBtn.addEventListener('click', () => {
        state.showTab = !state.showTab;
        saveSheetMusicShowTab(state.showTab);
        ui.showTabBtn.classList.toggle('active', state.showTab);
        if (!playbackControl.isPlaying()) renderCurrentScore();
      });

      ui.endlessBtn.addEventListener('click', () => {
        playbackControl.stopPlayback();
        if (state.endless) cleanupEndlessState();
        state.endless = !state.endless;
        saveSheetMusicEndless(state.endless);
        ui.endlessBtn.classList.toggle('active', state.endless);
        regenerate();
      });

      ui.playBtn.addEventListener('click', playbackControl.togglePlayback);

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

      ui.bpmSlider.addEventListener('input', () => {
        state.bpm = parseInt(ui.bpmSlider.value, 10);
        if (ui.bpmLabel) ui.bpmLabel.textContent = String(state.bpm);
        saveSheetMusicBpm(state.bpm);
        playback.setBpm(state.bpm);
      });

      ui.timeSigSelect.addEventListener('change', e => {
        state.timeSig = e.target.value;
        saveSheetMusicTimeSig(state.timeSig);
        playbackControl.stopPlayback();
        if (state.endless) cleanupEndlessState();
        renderBeatDots(ui, state.timeSig);
        regenerate();
      });

      ui.keySelect?.addEventListener('change', e => {
        state.settings.key = normalizeMajorKey(e.target.value);
        saveSheetMusicKey(state.settings.key);
        playbackControl.stopPlayback();
        if (state.endless) cleanupEndlessState();
        regenerate();
        updateFeedback(ui, state);
        syncSettingsUI();
      });

      ui.useKeyCheckbox?.addEventListener('change', () => {
        state.settings.useKey = ui.useKeyCheckbox.checked;
        saveSheetMusicUseKey(state.settings.useKey);
        playbackControl.stopPlayback();
        if (state.endless) cleanupEndlessState();
        regenerate();
        updateFeedback(ui, state);
        syncSettingsUI();
      });

      ui.arpeggioCheckbox?.addEventListener('change', () => {
        state.settings.arpeggio = ui.arpeggioCheckbox.checked;
        saveSheetMusicArpeggio(state.settings.arpeggio);
        playbackControl.stopPlayback();
        if (state.endless) cleanupEndlessState();
        regenerate();
        updateFeedback(ui, state);
        syncSettingsUI();
      });

      wireFretSlider(ui.fretSlider, ui.fretLabel, state.settings, () => {
        playbackControl.stopPlayback();
        if (state.endless) cleanupEndlessState();
        regenerate();
        updateFeedback(ui, state);
        syncSettingsUI();
      }, ui.minFretSlider);

      wireMinFretSlider(ui.minFretSlider, ui.fretLabel, state.settings, ui.fretSlider, () => {
        playbackControl.stopPlayback();
        if (state.endless) cleanupEndlessState();
        regenerate();
        updateFeedback(ui, state);
        syncSettingsUI();
      });

      document.querySelector('#sheet-music-string-toggles').addEventListener('string-change', ({ detail }) => {
        state.settings.activeStrings = detail.activeStrings;
        syncSettingsUI();
        playbackControl.stopPlayback();
        if (state.endless) cleanupEndlessState();
        regenerate();
        updateFeedback(ui, state);
      });

      document.addEventListener('keydown', e => {
        if (!ui.view?.classList.contains('active')) return;
        if (['INPUT', 'SELECT', 'TEXTAREA'].includes(e.target.tagName)) return;
        switch (e.code) {
          case 'Space':
            e.preventDefault();
            playbackControl.togglePlayback();
            break;
          case 'ArrowUp':
            e.preventDefault();
            playbackControl.adjustBpm(5);
            break;
          case 'ArrowDown':
            e.preventDefault();
            playbackControl.adjustBpm(-5);
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

      document.addEventListener('visibilitychange', () => {
        if (document.hidden && playbackControl.isPlaying()) {
          playbackControl.stopPlayback();
          if (state.endless) regenerate();
        }
      });

      ui.micSelect?.addEventListener('change', async () => {
        state.selectedMicDeviceId = ui.micSelect.value || null;
        if (state.isListening) {
          await listeningController.stopListening();
          await listeningController.startListening();
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
      listeningController.startListening();
    }
  }

  function unmount() {
    playbackControl.stopPlayback();
    if (state.endless) cleanupEndlessState();
    void listeningController.stopListening();
    ui = null;
  }

  return {
    mount,
    unmount,
    startExercise: mount,
    stopExercise: unmount,
  };
}
