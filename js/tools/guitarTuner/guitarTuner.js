// Guitar Tuner – main controller
// Exports startExercise() and stopExercise() to match the app navigation contract.

import {
  detectPitch, frequencyToNote, isStandardTuningNote, pushAndMedian,
  GUIDED_TUNING_STEPS, noteToFrequency, getCentsToTarget,
  pushGuidedHistory, getGuidedFeedback,
} from './tunerLogic.js';
import { initTunerSVG, updateTunerDisplay } from './tunerSVG.js';

// ── Module-level audio resources ──────────────────────────────────────────────
let audioCtx  = null;
let analyser  = null;
let stream    = null;
let intervalId = null;
let modeWired = false;
let guidedWired = false;

const freqHistory = [];

let state = {
  mode:    'standard', // 'standard' | 'chromatic'
  note:    null,
  octave:  null,
  cents:   0,
  isActive: false,
};

let guidedState = {
  active:       false,
  stepIndex:    0,
  trendHistory: [],
};

// ── Public lifecycle ──────────────────────────────────────────────────────────

export async function startExercise() {
  // Resolve DOM
  const display    = document.getElementById('tuner-display');
  const permission = document.getElementById('tuner-permission');

  // Build SVG gauge (idempotent – clears container first)
  initTunerSVG(display);

  // Reset state (preserve mode)
  freqHistory.length = 0;
  state.note    = null;
  state.octave  = null;
  state.cents   = 0;
  state.isActive = false;

  updateTunerDisplay({ cents: 0, note: null, octave: null, isActive: false, isInTune: false, isStandardNote: false });

  // Reset guided mode to initial UI state
  guidedState.active = false;
  guidedState.stepIndex = 0;
  guidedState.trendHistory = [];
  const elBtnStart  = document.getElementById('btn-start-guided');
  const elActive    = document.getElementById('guided-active');
  const elFinished  = document.getElementById('guided-finished');
  if (elBtnStart)  elBtnStart.style.display  = '';
  if (elActive)    elActive.style.display    = 'none';
  if (elFinished)  elFinished.style.display  = 'none';
  renderGuidedFeedback({ direction: 'none', trend: 'none', arrowColor: null, warning: false });

  // Wire mode buttons once
  if (!modeWired) {
    const btnStandard   = document.getElementById('btn-mode-standard');
    const btnChromatic  = document.getElementById('btn-mode-chromatic');

    btnStandard.addEventListener('click', () => {
      state.mode = 'standard';
      btnStandard.classList.add('active');
      btnChromatic.classList.remove('active');
    });

    btnChromatic.addEventListener('click', () => {
      state.mode = 'chromatic';
      btnChromatic.classList.add('active');
      btnStandard.classList.remove('active');
    });

    modeWired = true;
  }

  // Wire guided tuning buttons once
  if (!guidedWired) {
    document.getElementById('btn-start-guided')
      .addEventListener('click', startGuidedMode);
    document.getElementById('btn-guided-next')
      .addEventListener('click', nextGuidedStep);
    document.getElementById('btn-guided-stop')
      .addEventListener('click', stopGuidedMode);
    document.getElementById('btn-guided-restart')
      .addEventListener('click', startGuidedMode);
    document.getElementById('btn-guided-done')
      .addEventListener('click', stopGuidedMode);
    guidedWired = true;
  }

  // Sync mode button UI to current state
  document.getElementById('btn-mode-standard').classList.toggle('active', state.mode === 'standard');
  document.getElementById('btn-mode-chromatic').classList.toggle('active', state.mode === 'chromatic');

  // Request microphone
  permission.style.display = 'block';
  permission.textContent = 'Mikrofon-Zugriff wird benötigt…';

  try {
    stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
  } catch {
    permission.textContent = 'Mikrofon nicht verfügbar. Bitte Zugriff erlauben.';
    return;
  }

  permission.style.display = 'none';

  audioCtx = new AudioContext();
  analyser = audioCtx.createAnalyser();
  analyser.fftSize = 2048;
  audioCtx.createMediaStreamSource(stream).connect(analyser);

  state.isActive = true;
  intervalId = setInterval(analyzeFrame, 100);
}

export function stopExercise() {
  clearInterval(intervalId);
  intervalId = null;

  if (stream) {
    stream.getTracks().forEach(t => t.stop());
    stream = null;
  }

  if (audioCtx) {
    audioCtx.close();
    audioCtx = null;
    analyser = null;
  }

  state.isActive = false;
  freqHistory.length = 0;

  updateTunerDisplay({ cents: 0, note: null, octave: null, isActive: false, isInTune: false, isStandardNote: false });

  // Reset guided mode
  guidedState.active = false;
  guidedState.stepIndex = 0;
  guidedState.trendHistory = [];
  const elBtnStart  = document.getElementById('btn-start-guided');
  const elActive    = document.getElementById('guided-active');
  const elFinished  = document.getElementById('guided-finished');
  if (elBtnStart)  elBtnStart.style.display  = '';
  if (elActive)    elActive.style.display    = 'none';
  if (elFinished)  elFinished.style.display  = 'none';
  renderGuidedFeedback({ direction: 'none', trend: 'none', arrowColor: null, warning: false });
}

// ── Pitch analysis frame ──────────────────────────────────────────────────────

function analyzeFrame() {
  if (!analyser) return;

  const buffer = new Float32Array(analyser.fftSize);
  analyser.getFloatTimeDomainData(buffer);

  const hz = detectPitch(buffer, audioCtx.sampleRate);

  if (hz === null) {
    // Silence: clear display but keep needle centred; leave guided feedback as-is
    updateTunerDisplay({ cents: 0, note: null, octave: null, isActive: true, isInTune: false, isStandardNote: false });
    return;
  }

  const medianHz = pushAndMedian(freqHistory, hz);
  const { note, octave, cents } = frequencyToNote(medianHz);

  const isInTune    = Math.abs(cents) <= 8;
  const isStdNote   = isStandardTuningNote(note, octave);
  const isStandardNote = state.mode === 'standard' ? isStdNote : true;

  updateTunerDisplay({ cents, note, octave, isActive: true, isInTune, isStandardNote });

  // Guided mode feedback
  if (guidedState.active) {
    const step = GUIDED_TUNING_STEPS[guidedState.stepIndex];
    const targetFreq  = noteToFrequency(step.note, step.octave);
    const centsToTarget = getCentsToTarget(medianHz, targetFreq);
    pushGuidedHistory(guidedState.trendHistory, centsToTarget);
    const feedback = getGuidedFeedback(centsToTarget, guidedState.trendHistory);
    renderGuidedFeedback(feedback);
  }
}

// ── Guided mode ───────────────────────────────────────────────────────────────

function startGuidedMode() {
  guidedState.active = true;
  guidedState.stepIndex = 0;
  guidedState.trendHistory = [];
  document.getElementById('btn-start-guided').style.display = 'none';
  document.getElementById('guided-active').style.display = '';
  document.getElementById('guided-finished').style.display = 'none';
  renderGuidedStep();
  renderGuidedFeedback({ direction: 'none', trend: 'none', arrowColor: null, warning: false });
}

function nextGuidedStep() {
  guidedState.stepIndex += 1;
  guidedState.trendHistory = [];
  if (guidedState.stepIndex >= GUIDED_TUNING_STEPS.length) {
    guidedState.active = false;
    document.getElementById('guided-active').style.display = 'none';
    document.getElementById('guided-finished').style.display = '';
  } else {
    renderGuidedStep();
    renderGuidedFeedback({ direction: 'none', trend: 'none', arrowColor: null, warning: false });
  }
}

function stopGuidedMode() {
  guidedState.active = false;
  guidedState.stepIndex = 0;
  guidedState.trendHistory = [];
  document.getElementById('btn-start-guided').style.display = '';
  document.getElementById('guided-active').style.display = 'none';
  document.getElementById('guided-finished').style.display = 'none';
  renderGuidedFeedback({ direction: 'none', trend: 'none', arrowColor: null, warning: false });
}

function renderGuidedStep() {
  const step = GUIDED_TUNING_STEPS[guidedState.stepIndex];
  document.getElementById('guided-step-label').textContent =
    `${step.stringNumber}. Saite`;
  document.getElementById('guided-step-target').textContent =
    `${step.note}${step.octave}`;

  // Progress dots
  const progress = document.getElementById('guided-step-progress');
  progress.innerHTML = '';
  for (let i = 0; i < GUIDED_TUNING_STEPS.length; i++) {
    const dot = document.createElement('span');
    dot.className = 'guided-progress-dot'
      + (i === guidedState.stepIndex ? ' active' : '')
      + (i < guidedState.stepIndex ? ' done' : '');
    progress.appendChild(dot);
  }
}

function renderGuidedFeedback({ direction, arrowColor, warning }) {
  const container = document.getElementById('guided-feedback');
  if (!container) return;
  container.innerHTML = '';

  if (direction === 'none' || arrowColor === null) return;

  if (warning) {
    const warnEl = document.createElement('div');
    warnEl.className = 'guided-warning';
    warnEl.textContent = '⚠ Falsche Richtung!';
    container.appendChild(warnEl);
  }

  const arrowEl = document.createElement('div');
  arrowEl.className = `guided-arrow ${arrowColor}`;
  arrowEl.textContent = direction === 'up' ? '↑' : '↓';
  container.appendChild(arrowEl);

  const hintEl = document.createElement('div');
  hintEl.className = 'guided-hint';
  hintEl.textContent = direction === 'up'
    ? 'Ton zu tief – höher stimmen'
    : 'Ton zu hoch – tiefer stimmen';
  container.appendChild(hintEl);
}
