// Guitar Tuner – main controller
// Exports startExercise() and stopExercise() to match the app navigation contract.
// Encapsulates all state in a factory function.

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
import {
  createTunerDisplayState,
  createGuidedState,
  createAnalysisRuntime,
  resetForMount,
  resetForUnmount,
  NOISE_CALIBRATION_FRAMES,
} from './guitarTunerState.js';
import {
  createRootQuery,
  syncModeButtons,
  resetGuidedPanels,
  showGuidedActive,
  showGuidedFinished,
  renderGuidedStep,
  renderGuidedFeedback,
} from './guitarTunerUI.js';
import {
  createAudioSessionState,
  openAudioSession,
  closeAudioSession,
} from './guitarTunerAudioSession.js';
import {
  startGuidedModeState,
  nextGuidedStepState,
  stopGuidedModeState,
} from './guitarTunerGuidedMode.js';

export function createGuitarTunerTool() {
  let intervalId = null;
  let modeWired = false;
  let guidedWired = false;
  let rootElement = null;
  const query = createRootQuery(() => rootElement);
  const audioSession = createAudioSessionState();
  const runtime = createAnalysisRuntime();

  const state = createTunerDisplayState();
  const guidedState = createGuidedState();

  // ── Public lifecycle ──────────────────────────────────────────────────────

  async function mount(root = document) {
    rootElement = root;

    // Resolve DOM
    const display    = query('#tuner-display');
    const permission = query('#tuner-permission');

    // Build SVG gauge (idempotent – clears container first)
    initTunerSVG(display);

    resetForMount(state, guidedState, runtime);

    updateTunerDisplay({ cents: 0, note: null, octave: null, isActive: false, isInTune: false, isStandardNote: false });

    resetGuidedPanels(query);
    renderGuidedFeedback(query, null);

    // Wire mode buttons once
    if (!modeWired) {
      const btnStandard   = query('#btn-mode-standard');
      const btnChromatic  = query('#btn-mode-chromatic');

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
      query('#btn-start-guided')
        .addEventListener('click', startGuidedMode);
      query('#btn-guided-next')
        .addEventListener('click', nextGuidedStep);
      query('#btn-guided-stop')
        .addEventListener('click', stopGuidedMode);
      query('#btn-guided-restart')
        .addEventListener('click', startGuidedMode);
      query('#btn-guided-done')
        .addEventListener('click', stopGuidedMode);
      guidedWired = true;
    }

    syncModeButtons(query, state.mode);

    // Request microphone
    permission.style.display = 'block';
    permission.textContent = 'Mikrofon-Zugriff wird benötigt…';

    try {
      audioSession.stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
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
    await openAudioSession(audioSession, audioSession.stream, AudioContext, getAdaptiveFftSize());

    state.isActive = true;
    intervalId = setInterval(analyzeFrame, ANALYZE_INTERVAL_MS);
  }

  function unmount() {
    clearInterval(intervalId);
    intervalId = null;
    closeAudioSession(audioSession);
    resetForUnmount(state, guidedState, runtime);

    updateTunerDisplay({ cents: 0, note: null, octave: null, isActive: false, isInTune: false, isStandardNote: false });

    resetGuidedPanels(query);
    renderGuidedFeedback(query, null);
    rootElement = null;
  }

  // ── Pitch analysis frame ──────────────────────────────────────────────────

  function analyzeFrame() {
    if (!audioSession.analyser) return;

    const guidedTargetHz = guidedState.active
      ? noteToFrequency(GUIDED_TUNING_STEPS[guidedState.stepIndex].note, GUIDED_TUNING_STEPS[guidedState.stepIndex].octave)
      : null;
    const referenceHz = guidedTargetHz ?? null;
    const targetFftSize = getAdaptiveFftSize(referenceHz);
    if (audioSession.analyser.fftSize !== targetFftSize) audioSession.analyser.fftSize = targetFftSize;

    const buffer = new Float32Array(audioSession.analyser.fftSize);
    audioSession.analyser.getFloatTimeDomainData(buffer);

    // V4: Noise-Kalibrierung (erste 10 Frames passiv im Hintergrund)
    if (runtime.noiseCalibrationFrames < NOISE_CALIBRATION_FRAMES) {
      const lvl = analyzeInputLevel(buffer);
      runtime.noiseCalibrationRms.push(lvl.rms);
      runtime.noiseCalibrationFrames++;
      if (runtime.noiseCalibrationFrames === NOISE_CALIBRATION_FRAMES) {
        const noiseFloor = estimateNoiseFloorRms(runtime.noiseCalibrationRms);
        runtime.adaptiveMinRms = buildAdaptiveThreshold(noiseFloor);
      }
      return;
    }

    // V5: FFT-Magnitude-Spektrum für HPS
    const freqData = new Float32Array(audioSession.analyser.frequencyBinCount);
    audioSession.analyser.getFloatFrequencyData(freqData);

    const now = Date.now();

    // Pitch-Erkennung mit adaptiver Schwelle (V4) und FFT-HPS (V5)
    const hz = detectPitch(buffer, audioSession.audioCtx.sampleRate, {
      referenceHz,
      lastStableHz: runtime.stableFrequency,
      minRms: runtime.adaptiveMinRms,
      magnitudes: freqData,
      applyFilters: true,
      dampingRatio: ATTACK_DAMPING_RATIO,
    });

    if (hz === null) {
      // V11: Automatischer Reset bei längerer Stille
      if (runtime.lastValidFrameTime > 0 && now - runtime.lastValidFrameTime > SILENCE_RESET_THRESHOLD_MS) {
        runtime.freqHistory.length = 0;
        runtime.stableFrequency = null;
        runtime.acceptedNoteKey = null;
        runtime.validFramesStreak = 0;
        runtime.outlierStreak = 0;
        runtime.smoothedCents = null;
      }

      runtime.validFramesStreak = 0;
      updateTunerDisplay({ cents: runtime.smoothedCents, note: null, octave: null, isActive: true, isInTune: false, isStandardNote: false });
      if (guidedState.active) {
        guidedState.feedbackDisplay = updateFeedbackDisplay(guidedState.feedbackDisplay, { type: null }, now);
        renderGuidedFeedback(query, guidedState.feedbackDisplay);
      }
      return;
    }

    runtime.lastValidFrameTime = now;

    // V10: Warm-up Streak
    runtime.validFramesStreak++;
    if (runtime.validFramesStreak < STABLE_CONFIRM_FRAMES) {
      updateTunerDisplay({ cents: null, note: null, octave: null, isActive: true, isInTune: false, isStandardNote: false });
      return;
    }

    // V3: Ausreißer-Rejection
    const rejection = shouldRejectOutlier(runtime.stableFrequency, hz, runtime.outlierStreak);
    runtime.outlierStreak = rejection.nextStreak;
    if (rejection.reject) return;

    // V11: Zeitbasierte Historie & Median
    const medianHz = pushAndMedianTimed(runtime.freqHistory, hz, now);
    runtime.stableFrequency = medianHz;

    const candidate = frequencyToNote(runtime.stableFrequency);
    const candidateKey = `${candidate.note}${candidate.octave}`;

    const switched = applyNoteSwitchHysteresis(runtime.acceptedNoteKey, candidateKey, runtime.noteSwitchStreak);
    runtime.noteSwitchStreak = switched.nextStreak;
    runtime.acceptedNoteKey = switched.acceptedNoteKey;

    let note = candidate.note;
    let octave = candidate.octave;
    let cents = candidate.cents;

    if (runtime.acceptedNoteKey !== candidateKey && runtime.acceptedNoteKey) {
      const match = runtime.acceptedNoteKey.match(/^([A-G]#?)(-?\d+)$/);
      if (match) {
        note = match[1];
        octave = Number(match[2]);
        const refHz = noteToFrequency(note, octave);
        cents = getCentsToTarget(runtime.stableFrequency, refHz);
      }
    }

    const isStdNote = isStandardTuningNote(note, octave);
    const isStandardNote = state.mode === 'standard' ? isStdNote : true;

    let isInTune = Math.abs(cents) <= PERFECT_TOLERANCE_CENTS;

    // Guided mode feedback
    if (guidedState.active) {
      const step = GUIDED_TUNING_STEPS[guidedState.stepIndex];
      const targetFreq = noteToFrequency(step.note, step.octave);
      const centsToTarget = getCentsToTarget(runtime.stableFrequency, targetFreq);
      isInTune = Math.abs(centsToTarget) <= PERFECT_TOLERANCE_CENTS;
      pushGuidedHistory(guidedState.trendHistory, centsToTarget);
      const feedback = getGuidedFeedback(centsToTarget, guidedState.trendHistory);
      guidedState.feedbackDisplay = updateFeedbackDisplay(guidedState.feedbackDisplay, feedback, Date.now());
      renderGuidedFeedback(query, guidedState.feedbackDisplay);
    }

    // V9: EMA-Glättung für flüssige Nadelanzeige
    runtime.smoothedCents = smoothCents(runtime.smoothedCents, cents);

    updateTunerDisplay({ cents: runtime.smoothedCents, note, octave, isActive: true, isInTune, isStandardNote });
  }

  // ── Guided mode ───────────────────────────────────────────────────────────

  function startGuidedMode() {
    startGuidedModeState(guidedState, runtime);
    showGuidedActive(query);
    renderGuidedStep(query, GUIDED_TUNING_STEPS, guidedState.stepIndex);
    renderGuidedFeedback(query, null);
  }

  function nextGuidedStep() {
    const result = nextGuidedStepState(guidedState, runtime, GUIDED_TUNING_STEPS.length);
    if (result.finished) {
      showGuidedFinished(query);
    } else {
      renderGuidedStep(query, GUIDED_TUNING_STEPS, guidedState.stepIndex);
      renderGuidedFeedback(query, null);
    }
  }

  function stopGuidedMode() {
    stopGuidedModeState(guidedState, runtime);
    resetGuidedPanels(query);
    renderGuidedFeedback(query, null);
  }

  return {
    mount,
    unmount,
    startExercise: mount,
    stopExercise: unmount,
  };
}

export const createGuitarTunerExercise = createGuitarTunerTool;
