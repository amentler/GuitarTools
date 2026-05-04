import {
  generateBars, getFilteredNotes, getTimeSignatureConfig,
  EndlessBarGenerator, calcScrollTarget,
} from './sheetMusicLogic.js';
import { renderScore, appendRow } from './sheetMusicSVG.js';
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
} from './sheetMusicReadingUI.js';
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
import { requestMicrophoneStream } from '../../shared/audio/microphoneService.js';
import {
  createAudioSessionState,
  openAudioSession,
  closeAudioSession,
} from '../../shared/audio/audioSessionService.js';

// Number of bars per rendered row (matches the 4-bar VexFlow layout).
const BARS_PER_ROW = 4;
// How many rows ahead of the current position to keep pre-rendered.
const LOOKAHEAD_ROWS = 2;
// Minimum notes in the pool before showing the "too few notes" warning.
const MIN_POOL_SIZE = 3;
const SUCCESS_PAUSE_MS = 600;
const ANALYZE_INTERVAL_MS = 50;

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
    onsetGateState: createOnsetGateState(),
    settings: {
      maxFret: 3,
      activeStrings: [0, 1, 2, 3, 4, 5],
    },
  };

  // ── Playback state ──────────────────────────────────────────────────────
  const playback    = new PlaybackController();
  const playbackBar = new PlaybackBar(); // used in normal mode only
  let   isPlaying   = false;

  // ── Endless mode state ──────────────────────────────────────────────────
  let endlessGen       = null;
  let allRowDivs       = [];
  let allPlaybackBars  = [];
  let allStaveLayouts  = [];

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

  function getNextNote() {
    let bi = state.currentBarIndex;
    let ni = state.currentBeatIndex + 1;
    if (bi < 0 || bi >= state.bars.length) return null;
    if (ni >= state.bars[bi].length) {
      bi++;
      ni = 0;
    }
    if (bi >= state.bars.length) return null;
    return state.bars[bi]?.[ni] ?? null;
  }

  function getNotePitch(note) {
    return note ? `${note.name}${note.octave}` : null;
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
    state.onsetGateState = createOnsetGateState();
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

  function updateCurrentNoteDisplay() {
    if (!ui?.currentNote) return;
    if (!state.active) {
      ui.currentNote.textContent = '–';
      return;
    }
    const note = getCurrentNote();
    if (note) {
      ui.currentNote.textContent = `${note.name}${note.octave}`;
    } else if (state.currentBarIndex === -1) {
      ui.currentNote.textContent = '✓';
    } else {
      ui.currentNote.textContent = '–';
    }
  }

  function updateFeedback(kind = null, text = '') {
    if (!ui?.feedback) return;
    ui.feedback.className = 'feedback-text';
    if (!state.active) {
      ui.feedback.textContent = '';
      return;
    }
    if (kind === 'correct') {
      ui.feedback.textContent = text || 'Richtig! ✓';
      ui.feedback.classList.add('correct');
      return;
    }
    if (kind === 'wrong') {
      ui.feedback.textContent = text || 'Falsch!';
      ui.feedback.classList.add('wrong');
      return;
    }
    ui.feedback.textContent = text;
  }

  function syncActiveUiVisibility() {
    if (!ui?.status || !ui?.permission) return;
    ui.status.classList.toggle('u-hidden', !state.active);
    if (!state.active) {
      ui.permission.classList.add('u-hidden');
    }
  }

  function renderCurrentScore() {
    if (state.endless && allRowDivs.length > 0) return;
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
    const recommended = getRecommendedFftSize(targetPitch, audioSession.audioCtx?.sampleRate ?? 44100);
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
      microphoneStream = await requestMicrophoneStream();
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
      updateFeedback();
      return;
    }

    state.currentBarIndex = -1;
    state.currentBeatIndex = -1;
    state.matchState = createMatchState();
    state.onsetGateState = consumeOnsetGate(state.onsetGateState);
    state.isLocked = false;
    renderCurrentScore();
    updateCurrentNoteDisplay();
    updateFeedback('correct', 'Alle Noten gespielt! ✓');
  }

  function handleCorrectNote() {
    state.matchState = createMatchState();
    state.onsetGateState = consumeOnsetGate(state.onsetGateState);

    const note = getCurrentNote();
    if (!note) return;
    if (note.status === 'correct' && isTimedRecognitionMode()) {
      return;
    }
    const acceptedPitch = getNotePitch(note);
    const nextNote = getNextNote();
    const repeatsSamePitch = getNotePitch(nextNote) === acceptedPitch;
    note.status = 'correct';

    renderCurrentScore();
    updateFeedback('correct');

    if (isTimedRecognitionMode()) {
      updateCurrentNoteDisplay();
      return;
    }

    if (repeatsSamePitch) {
      advanceToNextNote();
      applyTargetFftSize();
      renderCurrentScore();
      updateCurrentNoteDisplay();
      updateFeedback();
      return;
    }

    state.isLocked = true;
    clearSuccessTimeout();
    state.successTimeout = setTimeout(() => {
      state.successTimeout = null;
      state.isLocked = false;
      advanceToNextNote();
      if (state.currentBarIndex !== -1) {
        applyTargetFftSize();
        renderCurrentScore();
        updateCurrentNoteDisplay();
        updateFeedback();
      }
    }, SUCCESS_PAUSE_MS);
  }

  function analyzeFrame() {
    if (!state.active || !state.isListening || !audioSession.analyser || state.isLocked) return;

    const targetNote = getCurrentNote();
    if (!targetNote) return;

    const buffer = new Float32Array(audioSession.analyser.fftSize);
    audioSession.analyser.getFloatTimeDomainData(buffer);

    const gate = updateOnsetGate(state.onsetGateState, buffer);
    state.onsetGateState = gate.nextState;

    const targetPitch = `${targetNote.name}${targetNote.octave}`;
    const frameResult = classifyFrame(buffer, audioSession.audioCtx.sampleRate, targetPitch);
    let effective = frameResult.status === 'wrong'
      ? { ...frameResult, status: 'unsure' }
      : frameResult;

    if (!isOnsetGateOpen(state.onsetGateState)) {
      effective = { ...effective, status: 'unsure' };
    }

    const { nextState, event } = updateMatchState(state.matchState, effective);
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
    state.onsetGateState = consumeOnsetGate(state.onsetGateState);
    state.isLocked = false;
    renderCurrentScore();
    updateCurrentNoteDisplay();
    updateFeedback('correct', 'Durchlauf beendet.');
  }

  function restartTimedEndlessPass() {
    stopPlayback();
    regenerate();
    updateFeedback();
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
    state.onsetGateState = createOnsetGateState();
    state.isLocked = false;
    renderCurrentScore();
    updateCurrentNoteDisplay();
    updateFeedback();
    applyTargetFftSize();
  }

  async function setActiveMode(nextActive) {
    if (state.active === nextActive) return;
    state.active = nextActive;
    saveSheetMusicActive(state.active);
    syncSettingsUI();
    syncActiveUiVisibility();

    if (!state.active) {
      await stopListening();
      resetActiveSequenceState();
      renderCurrentScore();
      updateCurrentNoteDisplay();
      updateFeedback();
      return;
    }

    resetActiveSequenceState();
    renderCurrentScore();
    updateCurrentNoteDisplay();
    updateFeedback();
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
    updateCurrentNoteDisplay();
    if (state.active && state.isListening) {
      applyTargetFftSize();
    }
  }

  // ── Endless mode helpers ────────────────────────────────────────────────
  function appendEndlessRow() {
    const bars      = endlessGen.nextBatch(BARS_PER_ROW);
    const container = ui.container;
    const { notationDiv, staveLayout, rowDiv, vw } = appendRow(
      container, bars, state.showTab, state.timeSig,
    );
    const bar = new PlaybackBar();
    bar.render(notationDiv, staveLayout, vw);
    bar.hide();
    allRowDivs.push(rowDiv);
    allPlaybackBars.push(bar);
    allStaveLayouts.push(staveLayout);
  }

  function cleanupEndlessState() {
    allPlaybackBars.forEach(bar => bar.destroy());
    allRowDivs      = [];
    allPlaybackBars = [];
    allStaveLayouts = [];
    endlessGen      = null;
    const container = ui?.container;
    if (container) {
      container.classList.remove('score-container--endless');
      container.scrollTop = 0;
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

    playbackBar.show();
    playback.start(state.bpm, config.beatsPerBar, totalBeats);
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
    allRowDivs      = [];
    allPlaybackBars = [];
    allStaveLayouts = [];

    const config = getTimeSigConfig();
    endlessGen = new EndlessBarGenerator(config.beatsPerBar, getNotesPool());

    // Pre-render initial rows
    for (let i = 0; i < 1 + LOOKAHEAD_ROWS; i++) appendEndlessRow();

    // Show first row's playback bar
    allPlaybackBars[0].show();

    playback.onBeat(({ barIndex, beatIndex }) => {
      const rowIndex   = Math.floor(barIndex / BARS_PER_ROW);
      const barInRow   = barIndex % BARS_PER_ROW;

      // Show only the current row's playback bar
      allPlaybackBars.forEach((bar, i) => {
        if (i === rowIndex) bar.show(); else bar.hide();
      });

      // Move the playback bar within the current row
      if (allPlaybackBars[rowIndex]) {
        allPlaybackBars[rowIndex].moveToBeat(
          barInRow, beatIndex, config.beatsPerBar,
        );
      }

      // Auto-scroll when entering a new row
      if (barInRow === 0 && beatIndex === 0 && rowIndex > 0) {
        const rowDiv         = allRowDivs[rowIndex];
        const firstRowHeight = allRowDivs[0]?.offsetHeight || 240;
        if (rowDiv) {
          const scrollTarget = calcScrollTarget(
            rowIndex, firstRowHeight, container.clientHeight,
          );
          container.scrollTo({ top: scrollTarget, behavior: 'smooth' });
        }
      }

      // Pre-generate: ensure LOOKAHEAD_ROWS rows are rendered ahead
      while (allRowDivs.length <= rowIndex + LOOKAHEAD_ROWS) {
        appendEndlessRow();
      }
    });

    // 0 = no wrap (play forever)
    playback.start(state.bpm, config.beatsPerBar, 0);
  }

  function stopPlayback() {
    if (!isPlaying) return;
    isPlaying = false;
    playback.stop();

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
    syncActiveUiVisibility();
    updateCurrentNoteDisplay();
  }

  // ── Exercise lifecycle ──────────────────────────────────────────────────
  function mount() {
    ui = resolveSheetMusicUI(document);
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
        updateFeedback();
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
        regenerate();
      });

      // Fret range slider
      wireFretSlider(ui.fretSlider, ui.fretLabel, state.settings, () => {
        stopPlayback();
        if (state.endless) cleanupEndlessState();
        regenerate();
        updateFeedback();
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
          updateFeedback();
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

      wired = true;
    }

    syncSettingsUI();
    updateFeedback();
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
