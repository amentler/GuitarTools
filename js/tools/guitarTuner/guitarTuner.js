// Guitar Tuner – main controller
// Exports startExercise() and stopExercise() to match the app navigation contract.
// Encapsulates all state in a factory function.

import { registerExercise } from '../../exerciseRegistry.js';
import {
  detectPitch, frequencyToNote, isStandardTuningNote,
  GUIDED_TUNING_STEPS, noteToFrequency, getCentsToTarget, PERFECT_TOLERANCE_CENTS,
  pushGuidedHistory, getGuidedFeedback, updateFeedbackDisplay,
  ANALYZE_INTERVAL_MS, getAdaptiveFftSize, applyNoteSwitchHysteresis,
  shouldRejectOutlier, analyzeInputLevel,
  estimateNoiseFloorRms, buildAdaptiveThreshold,
  smoothCents, STABLE_CONFIRM_FRAMES,
  pushAndMedianTimed, SILENCE_RESET_THRESHOLD_MS,
  ATTACK_DAMPING_RATIO
} from './tunerLogic.js';
import { initTunerSVG, updateTunerDisplay } from './tunerSVG.js';

export function createGuitarTunerExercise() {
  // Audio resources (per-instance)
  let audioCtx  = null;
  let analyser  = null;
  let stream    = null;
  let intervalId = null;
  let modeWired = false;
  let guidedWired = false;

  const freqHistory = [];
  let noteSwitchStreak = 0;
  let acceptedNoteKey = null;
  let stableFrequency = null;
  let validFramesStreak = 0;
  let lastValidFrameTime = 0;

  // V3: Outlier rejection
  let outlierStreak = 0;

  // V4: Adaptive noise gate
  const NOISE_CALIBRATION_FRAMES = 10; // 10 × 50 ms = 500 ms
  let noiseCalibrationFrames = 0;
  let noiseCalibrationRms = [];
  let adaptiveMinRms = 0.008; // GUITAR_MIN_RMS default until calibrated

  // V9: EMA cents smoother
  let smoothedCents = null;

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

  // ── Public lifecycle ──────────────────────────────────────────────────────

  async function startExercise() {
    // Resolve DOM
    const display    = document.getElementById('tuner-display');
    const permission = document.getElementById('tuner-permission');

    // Build SVG gauge (idempotent – clears container first)
    initTunerSVG(display);

    // Reset state (preserve mode)
    freqHistory.length = 0;
    noteSwitchStreak = 0;
    acceptedNoteKey = null;
    stableFrequency = null;
    validFramesStreak = 0;
    lastValidFrameTime = 0;
    outlierStreak = 0;
    noiseCalibrationFrames = 0;
    noiseCalibrationRms = [];
    adaptiveMinRms = 0.008;
    smoothedCents = null;
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

    // NOTE: The tuner creates its own AudioContext, AnalyserNode and audio
    // pipeline. This is intentional — the tuner prioritises pitch precision
    // over latency (adaptive large fftSize, YIN + HPS combined detection,
    // median stabilisation, EMA smoothing). Exercise modules like "Noten
    // spielen" use separate instances optimised for speed (smaller windows,
    // fastNoteMatcher classifier). Sharing a single AnalyserNode would force
    // one fftSize on both, causing glitches and wrong trade-offs.
    // See improvement.md §1.4 for the design rationale.
    audioCtx = new AudioContext();
    if (audioCtx.state === 'suspended') {
      await audioCtx.resume();
    }
    analyser = audioCtx.createAnalyser();
    analyser.fftSize = getAdaptiveFftSize();

    // V6: Hardware bandpass via two BiquadFilter nodes (12 dB/oct each).
    const hpFilter = audioCtx.createBiquadFilter();
    hpFilter.type = 'highpass';
    hpFilter.frequency.value = 60;
    hpFilter.Q.value = 0.7;

    const lpFilter = audioCtx.createBiquadFilter();
    lpFilter.type = 'lowpass';
    lpFilter.frequency.value = 500;
    lpFilter.Q.value = 0.7;

    audioCtx.createMediaStreamSource(stream)
      .connect(hpFilter)
      .connect(lpFilter)
      .connect(analyser);

    state.isActive = true;
    intervalId = setInterval(analyzeFrame, ANALYZE_INTERVAL_MS);
  }

  function stopExercise() {
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
    noteSwitchStreak = 0;
    acceptedNoteKey = null;
    stableFrequency = null;
    validFramesStreak = 0;
    lastValidFrameTime = 0;
    outlierStreak = 0;
    noiseCalibrationFrames = 0;
    noiseCalibrationRms = [];
    adaptiveMinRms = 0.008;
    smoothedCents = null;

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

  // ── Pitch analysis frame ──────────────────────────────────────────────────

  function analyzeFrame() {
    if (!analyser) return;

    const guidedTargetHz = guidedState.active
      ? noteToFrequency(GUIDED_TUNING_STEPS[guidedState.stepIndex].note, GUIDED_TUNING_STEPS[guidedState.stepIndex].octave)
      : null;
    const referenceHz = guidedTargetHz ?? null;
    const targetFftSize = getAdaptiveFftSize(referenceHz);
    if (analyser.fftSize !== targetFftSize) analyser.fftSize = targetFftSize;

    const buffer = new Float32Array(analyser.fftSize);
    analyser.getFloatTimeDomainData(buffer);

    // V4: Noise-Kalibrierung (erste 10 Frames passiv im Hintergrund)
    if (noiseCalibrationFrames < NOISE_CALIBRATION_FRAMES) {
      const lvl = analyzeInputLevel(buffer);
      noiseCalibrationRms.push(lvl.rms);
      noiseCalibrationFrames++;
      if (noiseCalibrationFrames === NOISE_CALIBRATION_FRAMES) {
        const noiseFloor = estimateNoiseFloorRms(noiseCalibrationRms);
        adaptiveMinRms = buildAdaptiveThreshold(noiseFloor);
      }
      return;
    }

    // V5: FFT-Magnitude-Spektrum für HPS
    const freqData = new Float32Array(analyser.frequencyBinCount);
    analyser.getFloatFrequencyData(freqData);

    const now = Date.now();

    // Pitch-Erkennung mit adaptiver Schwelle (V4) und FFT-HPS (V5)
    const hz = detectPitch(buffer, audioCtx.sampleRate, {
      referenceHz,
      lastStableHz: stableFrequency,
      minRms: adaptiveMinRms,
      magnitudes: freqData,
      applyFilters: true,
      dampingRatio: ATTACK_DAMPING_RATIO,
    });

    if (hz === null) {
      // V11: Automatischer Reset bei längerer Stille
      if (lastValidFrameTime > 0 && now - lastValidFrameTime > SILENCE_RESET_THRESHOLD_MS) {
        freqHistory.length = 0;
        stableFrequency = null;
        acceptedNoteKey = null;
        validFramesStreak = 0;
        outlierStreak = 0;
        smoothedCents = null;
      }

      validFramesStreak = 0;
      updateTunerDisplay({ cents: smoothedCents, note: null, octave: null, isActive: true, isInTune: false, isStandardNote: false });
      if (guidedState.active) {
        guidedState.feedbackDisplay = updateFeedbackDisplay(guidedState.feedbackDisplay, { type: null }, now);
        renderGuidedFeedback(guidedState.feedbackDisplay);
      }
      return;
    }

    lastValidFrameTime = now;

    // V10: Warm-up Streak
    validFramesStreak++;
    if (validFramesStreak < STABLE_CONFIRM_FRAMES) {
      updateTunerDisplay({ cents: null, note: null, octave: null, isActive: true, isInTune: false, isStandardNote: false });
      return;
    }

    // V3: Ausreißer-Rejection
    const rejection = shouldRejectOutlier(stableFrequency, hz, outlierStreak);
    outlierStreak = rejection.nextStreak;
    if (rejection.reject) return;

    // V11: Zeitbasierte Historie & Median
    const medianHz = pushAndMedianTimed(freqHistory, hz, now);
    stableFrequency = medianHz;

    const candidate = frequencyToNote(stableFrequency);
    const candidateKey = `${candidate.note}${candidate.octave}`;

    const switched = applyNoteSwitchHysteresis(acceptedNoteKey, candidateKey, noteSwitchStreak);
    noteSwitchStreak = switched.nextStreak;
    acceptedNoteKey = switched.acceptedNoteKey;

    let note = candidate.note;
    let octave = candidate.octave;
    let cents = candidate.cents;

    if (acceptedNoteKey !== candidateKey && acceptedNoteKey) {
      const match = acceptedNoteKey.match(/^([A-G]#?)(-?\d+)$/);
      if (match) {
        note = match[1];
        octave = Number(match[2]);
        const refHz = noteToFrequency(note, octave);
        cents = getCentsToTarget(stableFrequency, refHz);
      }
    }

    const isStdNote = isStandardTuningNote(note, octave);
    const isStandardNote = state.mode === 'standard' ? isStdNote : true;

    let isInTune = Math.abs(cents) <= PERFECT_TOLERANCE_CENTS;

    // Guided mode feedback
    if (guidedState.active) {
      const step = GUIDED_TUNING_STEPS[guidedState.stepIndex];
      const targetFreq = noteToFrequency(step.note, step.octave);
      const centsToTarget = getCentsToTarget(stableFrequency, targetFreq);
      isInTune = Math.abs(centsToTarget) <= PERFECT_TOLERANCE_CENTS;
      pushGuidedHistory(guidedState.trendHistory, centsToTarget);
      const feedback = getGuidedFeedback(centsToTarget, guidedState.trendHistory);
      guidedState.feedbackDisplay = updateFeedbackDisplay(guidedState.feedbackDisplay, feedback, Date.now());
      renderGuidedFeedback(guidedState.feedbackDisplay);
    }

    // V9: EMA-Glättung für flüssige Nadelanzeige
    smoothedCents = smoothCents(smoothedCents, cents);

    updateTunerDisplay({ cents: smoothedCents, note, octave, isActive: true, isInTune, isStandardNote });
  }

  // ── Guided mode ───────────────────────────────────────────────────────────

  function startGuidedMode() {
    guidedState.active = true;
    guidedState.stepIndex = 0;
    guidedState.trendHistory = [];
    guidedState.feedbackDisplay = null;
    freqHistory.length = 0;
    noteSwitchStreak = 0;
    acceptedNoteKey = null;
    stableFrequency = null;
    validFramesStreak = 0;
    lastValidFrameTime = 0;
    outlierStreak = 0;
    smoothedCents = null;
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
    freqHistory.length = 0;
    noteSwitchStreak = 0;
    acceptedNoteKey = null;
    stableFrequency = null;
    validFramesStreak = 0;
    lastValidFrameTime = 0;
    outlierStreak = 0;
    smoothedCents = null;
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
    noteSwitchStreak = 0;
    acceptedNoteKey = null;
    stableFrequency = null;
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

  return { startExercise, stopExercise };
}

// ── Default instance & self-registration ──────────────────────────────────────
const guitarTunerExercise = createGuitarTunerExercise();
registerExercise('tuner', {
  viewId: 'view-tuner',
  btnStartId: 'btn-start-tuner',
  btnBackId: 'btn-back-tuner',
  start: guitarTunerExercise.startExercise,
  stop: guitarTunerExercise.stopExercise,
});
