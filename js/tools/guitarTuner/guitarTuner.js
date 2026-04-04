// Guitar Tuner – main controller
// Exports startExercise() and stopExercise() to match the app navigation contract.

import {
  detectPitch, frequencyToNote, isStandardTuningNote, pushAndMedian,
  GUIDED_TUNING_STEPS, noteToFrequency, getCentsToTarget, PERFECT_TOLERANCE_CENTS,
  pushGuidedHistory, getGuidedFeedback, updateFeedbackDisplay,
  ANALYZE_INTERVAL_MS,
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
  active:          false,
  stepIndex:       0,
  trendHistory:    [],
  feedbackDisplay: null,
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
  guidedState.feedbackDisplay = null;
  const elBtnStart  = document.getElementById('btn-start-guided');
  const elActive    = document.getElementById('guided-active');
  const elFinished  = document.getElementById('guided-finished');
  if (elBtnStart)  elBtnStart.style.display  = '';
  if (elActive)    elActive.style.display    = 'none';
  if (elFinished)  elFinished.style.display  = 'none';
  renderGuidedFeedback(null);

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
  intervalId = setInterval(analyzeFrame, ANALYZE_INTERVAL_MS);
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
  guidedState.feedbackDisplay = null;
  const elBtnStart  = document.getElementById('btn-start-guided');
  const elActive    = document.getElementById('guided-active');
  const elFinished  = document.getElementById('guided-finished');
  if (elBtnStart)  elBtnStart.style.display  = '';
  if (elActive)    elActive.style.display    = 'none';
  if (elFinished)  elFinished.style.display  = 'none';
  renderGuidedFeedback(null);
}

// ── Pitch analysis frame ──────────────────────────────────────────────────────

function analyzeFrame() {
  if (!analyser) return;

  const buffer = new Float32Array(analyser.fftSize);
  analyser.getFloatTimeDomainData(buffer);

  const hz = detectPitch(buffer, audioCtx.sampleRate);

  if (hz === null) {
    // Silence: clear display but keep needle centred
    updateTunerDisplay({ cents: 0, note: null, octave: null, isActive: true, isInTune: false, isStandardNote: false });
    // Apply 3-second hold rule during silence so "Perfekt" doesn't persist indefinitely
    if (guidedState.active) {
      guidedState.feedbackDisplay = updateFeedbackDisplay(guidedState.feedbackDisplay, { type: null }, Date.now());
      renderGuidedFeedback(guidedState.feedbackDisplay);
    }
    return;
  }

  const medianHz = pushAndMedian(freqHistory, hz);
  const { note, octave, cents } = frequencyToNote(medianHz);

  const isStdNote   = isStandardTuningNote(note, octave);
  const isStandardNote = state.mode === 'standard' ? isStdNote : true;

  // Default: in-tune relative to the nearest chromatic note
  let isInTune = Math.abs(cents) <= PERFECT_TOLERANCE_CENTS;

  // Guided mode feedback
  if (guidedState.active) {
    const step = GUIDED_TUNING_STEPS[guidedState.stepIndex];
    const targetFreq  = noteToFrequency(step.note, step.octave);
    const centsToTarget = getCentsToTarget(medianHz, targetFreq);
    // In guided mode the green dot only lights up for the current target note
    isInTune = Math.abs(centsToTarget) <= PERFECT_TOLERANCE_CENTS;
    pushGuidedHistory(guidedState.trendHistory, centsToTarget);
    const feedback = getGuidedFeedback(centsToTarget, guidedState.trendHistory);
    guidedState.feedbackDisplay = updateFeedbackDisplay(guidedState.feedbackDisplay, feedback, Date.now());
    renderGuidedFeedback(guidedState.feedbackDisplay);
  }

  updateTunerDisplay({ cents, note, octave, isActive: true, isInTune, isStandardNote });
}

// ── Guided mode ───────────────────────────────────────────────────────────────

function startGuidedMode() {
  guidedState.active = true;
  guidedState.stepIndex = 0;
  guidedState.trendHistory = [];
  guidedState.feedbackDisplay = null;
  freqHistory.length = 0; // clear stale pitch samples so first readings aren't biased
  document.getElementById('btn-start-guided').style.display = 'none';
  document.getElementById('guided-active').style.display = '';
  document.getElementById('guided-finished').style.display = 'none';
  renderGuidedStep();
  renderGuidedFeedback(null);
}

function nextGuidedStep() {
  guidedState.stepIndex += 1;
  guidedState.trendHistory = [];
  guidedState.feedbackDisplay = null;
  freqHistory.length = 0; // clear stale samples from previous string
  if (guidedState.stepIndex >= GUIDED_TUNING_STEPS.length) {
    guidedState.active = false;
    document.getElementById('guided-active').style.display = 'none';
    document.getElementById('guided-finished').style.display = '';
  } else {
    renderGuidedStep();
    renderGuidedFeedback(null);
  }
}

function stopGuidedMode() {
  guidedState.active = false;
  guidedState.stepIndex = 0;
  guidedState.trendHistory = [];
  guidedState.feedbackDisplay = null;
  document.getElementById('btn-start-guided').style.display = '';
  document.getElementById('guided-active').style.display = 'none';
  document.getElementById('guided-finished').style.display = 'none';
  renderGuidedFeedback(null);
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

function renderGuidedFeedback(display) {
  const container = document.getElementById('guided-feedback');
  if (!container) return;
  container.innerHTML = '';

  if (!display || display.type === null) return;

  if (display.type === 'green') {
    const okEl = document.createElement('div');
    okEl.className = 'guided-ok';
    okEl.textContent = '●';
    container.appendChild(okEl);

    const textEl = document.createElement('div');
    textEl.className = 'guided-hint guided-hint--ok';
    textEl.textContent = 'Perfekt';
    container.appendChild(textEl);
    return;
  }

  if (display.warning) {
    const warnEl = document.createElement('div');
    warnEl.className = 'guided-warning';
    warnEl.textContent = '⚠ Falsche Richtung!';
    container.appendChild(warnEl);
  }

  const arrowEl = document.createElement('div');
  arrowEl.className = `guided-arrow ${display.arrowColor}`;
  arrowEl.textContent = display.direction === 'up' ? '↑' : '↓';
  container.appendChild(arrowEl);

  const hintEl = document.createElement('div');
  hintEl.className = 'guided-hint';
  hintEl.textContent = display.direction === 'up'
    ? 'Ton zu tief – höher stimmen'
    : 'Ton zu hoch – tiefer stimmen';
  container.appendChild(hintEl);
}
