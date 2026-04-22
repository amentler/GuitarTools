export const NOISE_CALIBRATION_FRAMES = 10;
export const DEFAULT_ADAPTIVE_MIN_RMS = 0.008;

export function createTunerDisplayState() {
  return {
    mode: 'standard',
    note: null,
    octave: null,
    cents: 0,
    isActive: false,
  };
}

export function createGuidedState() {
  return {
    active: false,
    stepIndex: 0,
    trendHistory: [],
    feedbackDisplay: null,
  };
}

export function createAnalysisRuntime() {
  return {
    freqHistory: [],
    noteSwitchStreak: 0,
    acceptedNoteKey: null,
    stableFrequency: null,
    validFramesStreak: 0,
    lastValidFrameTime: 0,
    outlierStreak: 0,
    noiseCalibrationFrames: 0,
    noiseCalibrationRms: [],
    adaptiveMinRms: DEFAULT_ADAPTIVE_MIN_RMS,
    smoothedCents: null,
  };
}

export function resetForMount(state, guidedState, runtime) {
  const mode = state.mode;
  Object.assign(state, createTunerDisplayState(), { mode });
  Object.assign(guidedState, createGuidedState());
  resetRuntime(runtime);
}

export function resetForUnmount(state, guidedState, runtime) {
  Object.assign(state, createTunerDisplayState(), { mode: state.mode });
  Object.assign(guidedState, createGuidedState());
  resetRuntime(runtime);
}

export function resetRuntime(runtime) {
  runtime.freqHistory.length = 0;
  runtime.noteSwitchStreak = 0;
  runtime.acceptedNoteKey = null;
  runtime.stableFrequency = null;
  runtime.validFramesStreak = 0;
  runtime.lastValidFrameTime = 0;
  runtime.outlierStreak = 0;
  runtime.noiseCalibrationFrames = 0;
  runtime.noiseCalibrationRms = [];
  runtime.adaptiveMinRms = DEFAULT_ADAPTIVE_MIN_RMS;
  runtime.smoothedCents = null;
}

export function resetGuidedTracking(runtime) {
  runtime.freqHistory.length = 0;
  runtime.noteSwitchStreak = 0;
  runtime.acceptedNoteKey = null;
  runtime.stableFrequency = null;
  runtime.validFramesStreak = 0;
  runtime.lastValidFrameTime = 0;
  runtime.outlierStreak = 0;
  runtime.smoothedCents = null;
}

export function resetGuidedStopTracking(runtime) {
  runtime.noteSwitchStreak = 0;
  runtime.acceptedNoteKey = null;
  runtime.stableFrequency = null;
}
