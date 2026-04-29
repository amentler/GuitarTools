/**
 * akkordfolgenTrainer.js
 * Chord Progression Trainer – plays through a chord progression in a chosen key
 * while a metronome ticks. After each strum, the microphone analyses the spectrum
 * to verify the correct chord is being played before marking it as done.
 */

import { MetronomeLogic } from '../../shared/audio/metronomeLogic.js';
import {
  buildProgression,
  generateRandomProgression,
  createBeatChordSync,
  PROGRESSIONS,
  MAJOR_KEYS,
} from './akkordfolgenLogic.js';
import { CHORDS } from '../../data/akkordData.js';
import { GUITAR_MIN_RMS, analyzeInputLevel } from '../../shared/audio/inputLevel.js';
import { detectPeaksFromSpectrum, identifyNotesFromPeaks } from '../../domain/chords/chordDetectionLogic.js';
import { getExpectedNoteClasses, matchDetectedNotes } from './akkordfolgenChordMatcher.js';
import {
  resolveAkkordfolgenUI,
  showAkkordfolgenSetup,
  showAkkordfolgenActive,
  showAkkordfolgenSummary,
  setAkkordfolgenFeedback,
} from './akkordfolgenUI.js';
import {
  createAkkordfolgenAudioSession,
  openAkkordfolgenAudioSession,
  closeAkkordfolgenAudioSession,
} from './akkordfolgenAudioSession.js';
import { requestMicrophoneStream } from '../../shared/audio/microphoneService.js';

// ── Constants ─────────────────────────────────────────────────────────────────

const FFT_SIZE              = 4096;
const LISTEN_INTERVAL_MS   = 50;
const RMS_SPIKE_MULTIPLIER = 2.5;
const STRUM_COOLDOWN_MS    = 1500;  // cooldown after a correct strum
const WRONG_COOLDOWN_MS    = 700;   // shorter cooldown to allow quick retry
const ATTACK_SETTLE_MS     = 150;   // wait after strum onset for transient to decay
const ANALYSIS_FRAMES      = 5;     // FFT frames to collect after strum
const FRAME_INTERVAL_MS    = 50;    // ms between analysis frames
const GUITAR_MIN_FREQUENCY = 70;    // Hz
const GUITAR_MAX_FREQUENCY = 1200;  // Hz
const MIN_DB_THRESHOLD     = -55;   // dB floor for peak detection
const MIN_CONFIDENCE       = 0.6;   // fraction of expected notes that must be detected

const delay = ms => new Promise(resolve => setTimeout(resolve, ms));

// ── Factory ───────────────────────────────────────────────────────────────────

export function createAkkordfolgenTrainerFeature() {
  const audioSession   = createAkkordfolgenAudioSession();
  let listenIntervalId = null;
  let strumCooldown   = false;
  let strumCooldownId = null;
  // Monotonically-increasing token; incremented to cancel in-flight chord analysis.
  let analysisToken   = 0;

  // ── Metronome ────────────────────────────────────────────────────────────────
  let metronome = null;

  // ── Exercise state ───────────────────────────────────────────────────────────
  let state = {
    key:                'G',
    progressionIndex:   0,
    isRandom:           false,
    progression:        [],         // [{ name, numeral, degree }]
    currentIndex:       0,
    isRunning:          false,
    bpm:                80,
    beatsPerChord:      4,
    strummedThisChord:  false,      // true once the player correctly plays the current chord
    score:              { rounds: 0, played: 0, missed: 0 },
    startTime:          null,
  };

  let settingsWired = false;
  let ui = null;

  // ── UI resolution ─────────────────────────────────────────────────────────

  function resolveUI() {
    ui = resolveAkkordfolgenUI(document);
  }

  // ── Phase management ──────────────────────────────────────────────────────

  function showSetup()   { showAkkordfolgenSetup(ui); }
  function showActive()  { showAkkordfolgenActive(ui); }
  function showSummary() { showAkkordfolgenSummary(ui); }

  // ── Settings wiring ───────────────────────────────────────────────────────

  function wireSettings() {
    ui.keySelect.addEventListener('change', () => { state.key = ui.keySelect.value; });

    ui.progressionList.addEventListener('click', e => {
      const btn = e.target.closest('[data-prog-idx]');
      if (!btn) return;
      state.progressionIndex = parseInt(btn.dataset.progIdx, 10);
      state.isRandom = false;
      refreshProgressionButtons();
    });

    ui.randomBtn.addEventListener('click', () => {
      state.isRandom = true;
      refreshProgressionButtons();
    });

    ui.bpmSlider.addEventListener('input', () => {
      state.bpm = parseInt(ui.bpmSlider.value, 10);
      ui.bpmLabel.textContent = state.bpm;
    });

    for (const [btn, delta] of [
      [ui.bpmMinus5, -5], [ui.bpmMinus1, -1],
      [ui.bpmPlus1,  +1], [ui.bpmPlus5, +5],
    ]) {
      btn.addEventListener('click', () => {
        state.bpm = Math.max(40, Math.min(200, state.bpm + delta));
        ui.bpmSlider.value = state.bpm;
        ui.bpmLabel.textContent = state.bpm;
      });
    }

    ui.beatsSelect.addEventListener('change', () => {
      state.beatsPerChord = parseInt(ui.beatsSelect.value, 10);
    });

    ui.startBtn.addEventListener('click', () => { beginExercise(); });
    ui.stopBtn.addEventListener('click',  () => { stopActiveExercise(); });
    ui.againBtn.addEventListener('click', () => { beginExercise(); });
    ui.newBtn.addEventListener('click',   () => { showSetup(); });
  }

  function refreshProgressionButtons() {
    ui.progressionList.querySelectorAll('[data-prog-idx]').forEach(btn => {
      btn.classList.toggle('active', !state.isRandom && parseInt(btn.dataset.progIdx, 10) === state.progressionIndex);
    });
    ui.randomBtn.classList.toggle('active', state.isRandom);
  }

  function syncSettingsUI() {
    ui.keySelect.value = state.key;
    ui.bpmSlider.value = state.bpm;
    ui.bpmLabel.textContent = state.bpm;
    ui.beatsSelect.value = state.beatsPerChord;
    refreshProgressionButtons();
  }

  // ── Population of static UI lists ────────────────────────────────────────

  function populateKeySelect() {
    if (ui.keySelect.children.length > 0) return;
    MAJOR_KEYS.forEach(k => {
      const opt = document.createElement('option');
      opt.value = k.key;
      opt.textContent = k.label;
      ui.keySelect.appendChild(opt);
    });
    ui.keySelect.value = state.key;
  }

  function populateProgressionList() {
    if (ui.progressionList.children.length > 0) return;
    PROGRESSIONS.forEach((prog, i) => {
      const btn = document.createElement('button');
      btn.className = 'btn-mode aft-prog-btn';
      btn.dataset.progIdx = i;
      btn.textContent = prog.name;
      ui.progressionList.appendChild(btn);
    });
    refreshProgressionButtons();
  }

  // ── Exercise start / stop ─────────────────────────────────────────────────

  async function beginExercise() {
    const activeUi = ui;
    state.progression = state.isRandom
      ? generateRandomProgression(state.key)
      : buildProgression(state.key, state.progressionIndex);

    if (state.progression.length === 0) return;

    state.score      = { rounds: 0, played: 0, missed: 0 };
    state.currentIndex = 0;
    state.isRunning  = true;
    state.startTime  = Date.now();

    showActive();
    renderProgressionStrip();
    renderBeatDots();

    if (ui.permission) {
      ui.permission.classList.remove('u-hidden');
      ui.permission.textContent = 'Mikrofon-Zugriff wird benötigt…';
    }


    // Initialise metronome AudioContext immediately (user gesture is still active here).
    metronome = new MetronomeLogic();
    metronome.init();
    const activeMetronome = metronome;

    try {
      audioSession.stream = await requestMicrophoneStream();
    } catch {
      if (ui.permission) ui.permission.textContent = 'Mikrofon nicht verf\u00FCgbar. Bitte Zugriff erlauben.';
      state.isRunning = false;
      cleanup();
      showSetup();
      return;
    }

    if (!state.isRunning || ui !== activeUi || metronome !== activeMetronome) {
      closeAkkordfolgenAudioSession(audioSession);
      return;
    }

    if (activeUi?.permission) activeUi.permission.classList.add('u-hidden');

    await openAkkordfolgenAudioSession(audioSession, audioSession.stream, AudioContext, FFT_SIZE);

    if (!state.isRunning || ui !== activeUi || metronome !== activeMetronome) {
      closeAkkordfolgenAudioSession(audioSession);
      return;
    }

    activeMetronome.setBpm(state.bpm);
    activeMetronome.setBeatsPerMeasure(state.beatsPerChord);

    const beatSync = createBeatChordSync();
    activeMetronome.onBeat = beatNumber => {
      highlightBeat(beatNumber);
      if (!beatSync.onBeat(beatNumber) || !state.isRunning) return;
      if (!state.strummedThisChord) {
        state.score.missed++;
        markCard(state.currentIndex, 'missed');
      }
      advanceChord();
    };
    activeMetronome.start();

    startStrumDetection();
    showChordAtIndex(0);
  }

  function stopActiveExercise() {
    if (!state.isRunning) return;
    state.isRunning = false;
    cleanup();
    showSummaryPanel();
  }

  function cleanup() {
    if (listenIntervalId) { clearInterval(listenIntervalId); listenIntervalId = null; }
    if (strumCooldownId)  { clearTimeout(strumCooldownId);  strumCooldownId = null; }
    strumCooldown = false;
    analysisToken++;   // cancel any in-flight analysis

    if (metronome) { metronome.stop(); metronome = null; }

    closeAkkordfolgenAudioSession(audioSession);
  }

  // ── Chord display ─────────────────────────────────────────────────────────

  function showChordAtIndex(index) {
    if (!state.isRunning) return;

    state.currentIndex        = index;
    state.strummedThisChord   = false;

    const chord = state.progression[index];
    if (!chord) return;

    updateStripHighlight(index);
    ui.currentChordName.textContent = chord.name;
    ui.currentNumeral.textContent   = chord.numeral;
    setFeedback('');

    // Chord diagram – only when the chord name exists verbatim in the database
    const positions = CHORDS[chord.name];
    if (positions && ui.chordDiagram) {
      ui.chordDiagram.classList.remove('u-hidden');
      ui.chordDiagram.positions = positions.map(p => ({
        stringIndex: p.string - 1,
        fret: p.muted ? 0 : p.fret,
        state: p.muted ? 'muted' : 'selected',
        label: p.finger ? String(p.finger) : null
      }));
    } else if (ui.chordDiagram) {
      ui.chordDiagram.classList.add('u-hidden');
      ui.chordDiagram.positions = [];
    }
  }

  function advanceChord() {
    if (!state.isRunning) return;

    // Cancel any pending chord analysis and reset strum gate for the new chord.
    analysisToken++;
    strumCooldown = false;
    if (strumCooldownId) { clearTimeout(strumCooldownId); strumCooldownId = null; }

    const next = state.currentIndex + 1;
    if (next >= state.progression.length) {
      state.score.rounds++;
      showChordAtIndex(0);
    } else {
      showChordAtIndex(next);
    }
  }

  // ── Strum detection ───────────────────────────────────────────────────────

  function startStrumDetection() {
    strumCooldown = false;
    const buffer       = new Float32Array(audioSession.analyser.fftSize);
    const rmsThreshold = RMS_SPIKE_MULTIPLIER * GUITAR_MIN_RMS;

    listenIntervalId = setInterval(() => {
      if (!audioSession.analyser || strumCooldown || !state.isRunning) return;
      audioSession.analyser.getFloatTimeDomainData(buffer);
      const { rms } = analyzeInputLevel(buffer);
      if (rms > rmsThreshold) {
        strumCooldown = true;
        analyzeChordAfterStrum(++analysisToken);
      }
    }, LISTEN_INTERVAL_MS);
  }

  async function analyzeChordAfterStrum(token) {
    await delay(ATTACK_SETTLE_MS);
    if (token !== analysisToken || !state.isRunning || !audioSession.analyser || !audioSession.audioCtx) return;

    const targetChord = state.progression[state.currentIndex];
    const sampleRate  = audioSession.audioCtx.sampleRate;
    const freqBuffer  = new Float32Array(audioSession.analyser.frequencyBinCount);
    const detected    = new Set();

    for (let frame = 0; frame < ANALYSIS_FRAMES; frame++) {
      if (token !== analysisToken || !state.isRunning || !audioSession.analyser) break;
      audioSession.analyser.getFloatFrequencyData(freqBuffer);
      const peaks = detectPeaksFromSpectrum(
        freqBuffer, sampleRate,
        GUITAR_MIN_FREQUENCY, GUITAR_MAX_FREQUENCY, MIN_DB_THRESHOLD,
      );
      identifyNotesFromPeaks(peaks).forEach(n => detected.add(n.note));
      if (frame < ANALYSIS_FRAMES - 1) await delay(FRAME_INTERVAL_MS);
    }

    // Analysis cancelled or exercise stopped while collecting frames
    if (token !== analysisToken || !state.isRunning) return;
    // Chord advanced by metronome while we were analysing
    if (state.progression[state.currentIndex] !== targetChord) return;

    const expectedNotes = getExpectedNoteClasses(targetChord.name);
    if (expectedNotes.length === 0) {
      // Chord not in theory database (should not happen) – accept any strum as fallback
      strumCooldownId = setTimeout(() => { strumCooldown = false; }, STRUM_COOLDOWN_MS);
      handleCorrectStrum();
      return;
    }

    const { confidence } = matchDetectedNotes([...detected], targetChord.name);

    if (confidence >= MIN_CONFIDENCE) {
      strumCooldownId = setTimeout(() => { strumCooldown = false; }, STRUM_COOLDOWN_MS);
      handleCorrectStrum();
    } else {
      setFeedback('Falscher Akkord', 'wrong');
      strumCooldownId = setTimeout(() => {
        if (state.isRunning) setFeedback('');
        strumCooldown = false;
        strumCooldownId = null;
      }, WRONG_COOLDOWN_MS);
    }
  }

  function handleCorrectStrum() {
    if (!state.isRunning || state.strummedThisChord) return;
    state.score.played++;
    state.strummedThisChord = true;
    markCard(state.currentIndex, 'played');
    setFeedback('\u2713 Gespielt!', 'correct');
    // Chord advances on the next beat 0 (metronome onBeat), not via a timer.
  }

  // ── Progression strip ─────────────────────────────────────────────────────

  function renderProgressionStrip() {
    ui.progressionDisplay.innerHTML = '';
    state.progression.forEach((chord, i) => {
      const card = document.createElement('div');
      card.className = 'aft-chord-card';
      card.id        = `aft-card-${i}`;
      card.innerHTML =
        `<span class="aft-card-name">${chord.name}</span>` +
        `<span class="aft-card-numeral">${chord.numeral}</span>`;
      ui.progressionDisplay.appendChild(card);
    });
  }

  function updateStripHighlight(activeIndex) {
    state.progression.forEach((_, i) => {
      const card = document.getElementById(`aft-card-${i}`);
      if (!card) return;
      card.classList.remove('current', 'played', 'missed');
      if (i === activeIndex) card.classList.add('current');
    });
  }

  function markCard(index, cls) {
    const card = document.getElementById(`aft-card-${index}`);
    if (card) { card.classList.remove('current', 'played', 'missed'); card.classList.add(cls); }
  }

  // ── Beat dots (metronome visualisation) ──────────────────────────────────

  function renderBeatDots() {
    ui.beatDots.innerHTML = '';
    for (let i = 0; i < state.beatsPerChord; i++) {
      const dot = document.createElement('span');
      dot.className = `aft-beat-dot${i === 0 ? ' downbeat' : ''}`;
      dot.id = `aft-dot-${i}`;
      ui.beatDots.appendChild(dot);
    }
  }

  function highlightBeat(beatNumber) {
    const dot = document.getElementById(`aft-dot-${beatNumber}`);
    if (!dot) return;
    dot.classList.add('active');
    setTimeout(() => dot.classList.remove('active'), 120);
  }

  // ── Feedback text ─────────────────────────────────────────────────────────

  function setFeedback(text, kind) {
    setAkkordfolgenFeedback(ui, text, kind);
  }

  // ── Summary ───────────────────────────────────────────────────────────────

  function showSummaryPanel() {
    const elapsed  = state.startTime ? Math.round((Date.now() - state.startTime) / 1000) : 0;
    const min      = Math.floor(elapsed / 60);
    const sec      = elapsed % 60;
    const timeStr  = min > 0 ? `${min} min ${sec} s` : `${sec} s`;

    if (ui.summaryTime)   ui.summaryTime.textContent   = timeStr;
    if (ui.summaryPlayed) ui.summaryPlayed.textContent = state.score.played;
    if (ui.summaryMissed) ui.summaryMissed.textContent = state.score.missed;
    if (ui.summaryRounds) ui.summaryRounds.textContent = state.score.rounds;

    showSummary();
  }

  // ── Public API ────────────────────────────────────────────────────────────

  function mount() {
    resolveUI();
    populateKeySelect();
    populateProgressionList();
    if (!settingsWired) { wireSettings(); settingsWired = true; }
    syncSettingsUI();
    showSetup();
  }

  function unmount() {
    if (state.isRunning) { state.isRunning = false; cleanup(); }
    if (ui) showSetup();
  }

  return {
    mount,
    unmount,
    startExercise: mount,
    stopExercise: unmount,
  };
}
