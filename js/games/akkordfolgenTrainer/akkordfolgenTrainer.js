/**
 * akkordfolgenTrainer.js
 * Chord Progression Trainer – plays through a chord progression in a chosen key
 * while a metronome ticks. Strum detection advances to the next chord
 * automatically; a timeout auto-advances if no strum is detected.
 */

import { registerExercise } from '../../exerciseRegistry.js';
import { MetronomeLogic } from '../../tools/metronome/metronomeLogic.js';
import {
  buildProgression,
  generateRandomProgression,
  createBeatChordSync,
  PROGRESSIONS,
  MAJOR_KEYS,
} from './akkordfolgenLogic.js';
import { renderChordDiagram } from '../akkordTrainer/akkordSVG.js';
import { CHORDS } from '../../data/akkordData.js';
import { GUITAR_MIN_RMS, analyzeInputLevel } from '../../tools/guitarTuner/pitchLogic.js';

// ── Constants ─────────────────────────────────────────────────────────────────

const FFT_SIZE             = 4096;
const LISTEN_INTERVAL_MS   = 50;
const RMS_SPIKE_MULTIPLIER = 2.5;
const STRUM_COOLDOWN_MS    = 1500;  // ignore further strums for this long after one fires

// ── Factory ───────────────────────────────────────────────────────────────────

export function createAkkordfolgenTrainer() {
  // ── Audio state ─────────────────────────────────────────────────────────────
  let audioCtx        = null;
  let analyser        = null;
  let stream          = null;
  let listenIntervalId = null;
  let strumCooldown   = false;
  let strumCooldownId = null;

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
    strummedThisChord:  false,      // true once the player strums the current chord
    score:              { rounds: 0, played: 0, missed: 0 },
    startTime:          null,
  };

  let settingsWired = false;
  let ui = null;

  // ── UI resolution ─────────────────────────────────────────────────────────

  function resolveUI() {
    ui = {
      view:               document.getElementById('view-akkordfolgen-trainer'),
      setup:              document.getElementById('aft-setup'),
      active:             document.getElementById('aft-active'),
      summary:            document.getElementById('aft-summary'),

      keySelect:          document.getElementById('aft-key-select'),
      progressionList:    document.getElementById('aft-progression-list'),
      randomBtn:          document.getElementById('aft-random-btn'),
      bpmSlider:          document.getElementById('aft-bpm-slider'),
      bpmLabel:           document.getElementById('aft-bpm-label'),
      bpmMinus5:          document.getElementById('aft-bpm-minus5'),
      bpmMinus1:          document.getElementById('aft-bpm-minus1'),
      bpmPlus1:           document.getElementById('aft-bpm-plus1'),
      bpmPlus5:           document.getElementById('aft-bpm-plus5'),
      beatsSelect:        document.getElementById('aft-beats-select'),
      startBtn:           document.getElementById('aft-start-btn'),

      progressionDisplay: document.getElementById('aft-progression-display'),
      currentChordName:   document.getElementById('aft-current-chord-name'),
      currentNumeral:     document.getElementById('aft-current-numeral'),
      chordDiagram:       document.getElementById('aft-chord-diagram'),
      beatDots:           document.getElementById('aft-beat-dots'),
      feedback:           document.getElementById('aft-feedback'),
      stopBtn:            document.getElementById('aft-stop-btn'),

      summaryTime:        document.getElementById('aft-summary-time'),
      summaryPlayed:      document.getElementById('aft-summary-played'),
      summaryMissed:      document.getElementById('aft-summary-missed'),
      summaryRounds:      document.getElementById('aft-summary-rounds'),
      againBtn:           document.getElementById('aft-again-btn'),
      newBtn:             document.getElementById('aft-new-btn'),

      permission:         document.getElementById('aft-permission'),
    };
  }

  // ── Phase management ──────────────────────────────────────────────────────

  function showSetup()   { ui.setup.style.display = 'flex';  ui.active.style.display = 'none';  ui.summary.style.display = 'none'; }
  function showActive()  { ui.setup.style.display = 'none';  ui.active.style.display = 'flex';  ui.summary.style.display = 'none'; }
  function showSummary() { ui.setup.style.display = 'none';  ui.active.style.display = 'none';  ui.summary.style.display = 'flex'; }

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
      ui.permission.style.display = 'block';
      ui.permission.textContent = 'Mikrofon-Zugriff wird ben\u00F6tigt\u2026';
    }

    // Initialise metronome AudioContext immediately (user gesture is still active here).
    metronome = new MetronomeLogic();
    metronome.init();

    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
    } catch {
      if (ui.permission) ui.permission.textContent = 'Mikrofon nicht verf\u00FCgbar. Bitte Zugriff erlauben.';
      state.isRunning = false;
      cleanup();
      return;
    }

    if (ui.permission) ui.permission.style.display = 'none';

    audioCtx = new AudioContext();
    analyser = audioCtx.createAnalyser();
    analyser.fftSize = FFT_SIZE;
    audioCtx.createMediaStreamSource(stream).connect(analyser);

    metronome.setBpm(state.bpm);
    metronome.setBeatsPerMeasure(state.beatsPerChord);

    const beatSync = createBeatChordSync();
    metronome.onBeat = beatNumber => {
      highlightBeat(beatNumber);
      if (!beatSync.onBeat(beatNumber) || !state.isRunning) return;
      if (!state.strummedThisChord) {
        state.score.missed++;
        markCard(state.currentIndex, 'missed');
      }
      advanceChord();
    };
    metronome.start();

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

    if (metronome) { metronome.stop(); metronome = null; }

    if (stream) { stream.getTracks().forEach(t => t.stop()); stream = null; }
    if (audioCtx) { audioCtx.close().catch(() => {}); audioCtx = null; analyser = null; }
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
      ui.chordDiagram.style.display = 'block';
      renderChordDiagram(ui.chordDiagram, positions, positions, null, () => {}, true);
    } else if (ui.chordDiagram) {
      ui.chordDiagram.style.display = 'none';
      ui.chordDiagram.innerHTML = '';
    }
  }

  function advanceChord() {
    if (!state.isRunning) return;

    // Reset strum cooldown so next chord can be detected immediately
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
    const buffer       = new Float32Array(analyser.fftSize);
    const rmsThreshold = RMS_SPIKE_MULTIPLIER * GUITAR_MIN_RMS;

    listenIntervalId = setInterval(() => {
      if (!analyser || strumCooldown || !state.isRunning) return;
      analyser.getFloatTimeDomainData(buffer);
      const { rms } = analyzeInputLevel(buffer);
      if (rms > rmsThreshold) {
        strumCooldown = true;
        strumCooldownId = setTimeout(() => { strumCooldown = false; }, STRUM_COOLDOWN_MS);
        handleStrum();
      }
    }, LISTEN_INTERVAL_MS);
  }

  function handleStrum() {
    if (!state.isRunning || state.strummedThisChord) return;
    state.score.played++;
    state.strummedThisChord = true;

    markCard(state.currentIndex, 'played');
    setFeedback('\u2713 Gespielt!', 'correct');
    // Chord advances on the next beat 0 (metronome onBeat), not via a separate timer.
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
    if (!ui.feedback) return;
    ui.feedback.textContent = text;
    ui.feedback.className   = 'feedback-text';
    if (kind === 'correct') ui.feedback.classList.add('feedback-correct');
    else if (kind === 'wrong') ui.feedback.classList.add('feedback-wrong');
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

  function startExercise() {
    resolveUI();
    populateKeySelect();
    populateProgressionList();
    if (!settingsWired) { wireSettings(); settingsWired = true; }
    syncSettingsUI();
    showSetup();
  }

  function stopExercise() {
    if (state.isRunning) { state.isRunning = false; cleanup(); }
    if (ui) showSetup();
  }

  return { startExercise, stopExercise };
}

// ── Self-registration ─────────────────────────────────────────────────────────

const akkordfolgenTrainer = createAkkordfolgenTrainer();

registerExercise('akkordfolgenTrainer', {
  viewId:     'view-akkordfolgen-trainer',
  btnStartId: 'btn-start-akkordfolgen-trainer',
  btnBackId:  'btn-back-akkordfolgen-trainer',
  start:      akkordfolgenTrainer.startExercise,
  stop:       akkordfolgenTrainer.stopExercise,
});
