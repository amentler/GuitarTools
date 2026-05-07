// Pure onset-gate logic for microphone note exercises.
//
// Purpose: require a fresh attack before a target note may be accepted.
// A sustained ringing tone must not re-trigger repeated identical notes.

export const ONSET_MIN_RMS = 0.006;
export const ONSET_SPIKE_FACTOR = 2.2;
export const ONSET_RELEASE_FACTOR = 0.6;
export const ONSET_BASELINE_ALPHA = 0.12;
export const ONSET_COOLDOWN_FRAMES = 4;
export const ONSET_WINDOW_FRAMES = 10;
export const ONSET_REATTACK_MIN_DELTA = 0.015;
/** Separate spike factor for re-attack during sustain (used by legato exercises). */
export const ONSET_REATTACK_SPIKE_FACTOR = 1.5;

export function computeFrameRms(samples) {
  let sumSquares = 0;
  for (const sample of samples) sumSquares += sample * sample;
  return Math.sqrt(sumSquares / Math.max(1, samples.length));
}

export function createOnsetGateState() {
  return {
    baselineRms: 0,
    wasAboveThreshold: false,
    aboveThresholdFloorRms: null,
    cooldownFramesRemaining: 0,
    onsetWindowRemaining: 0,
    lastRms: 0,
  };
}

export function isOnsetGateOpen(state) {
  return state.onsetWindowRemaining > 0;
}

export function consumeOnsetGate(state) {
  return {
    ...state,
    onsetWindowRemaining: 0,
  };
}

export function updateOnsetGate(state, samplesOrRms, options = {}) {
  const rms = typeof samplesOrRms === 'number'
    ? samplesOrRms
    : computeFrameRms(samplesOrRms);

  const minRms = options.minRms ?? ONSET_MIN_RMS;
  const spikeFactor = options.spikeFactor ?? ONSET_SPIKE_FACTOR;
  const reattackSpikeFactor = options.reattackSpikeFactor ?? spikeFactor;
  const releaseFactor = options.releaseFactor ?? ONSET_RELEASE_FACTOR;
  const baselineAlpha = options.baselineAlpha ?? ONSET_BASELINE_ALPHA;
  const cooldownFrames = options.cooldownFrames ?? ONSET_COOLDOWN_FRAMES;
  const onsetWindowFrames = options.onsetWindowFrames ?? ONSET_WINDOW_FRAMES;
  const reattackMinDelta = options.reattackMinDelta ?? ONSET_REATTACK_MIN_DELTA;

  const armThreshold = Math.max(minRms, state.baselineRms * spikeFactor);
  const releaseThreshold = Math.max(minRms * 0.75, armThreshold * releaseFactor);

  const isAboveThreshold = state.wasAboveThreshold
    ? rms >= releaseThreshold
    : rms >= armThreshold;

  let event = null;
  let onsetWindowRemaining = Math.max(0, state.onsetWindowRemaining - 1);
  let cooldownFramesRemaining = Math.max(0, state.cooldownFramesRemaining - 1);
  const trackedFloor = state.wasAboveThreshold
    ? Math.min(state.aboveThresholdFloorRms ?? rms, rms)
    : null;
  const canRetriggerOnSustain = state.wasAboveThreshold
    && cooldownFramesRemaining === 0
    && trackedFloor !== null
    && rms > state.lastRms
    && rms >= trackedFloor * reattackSpikeFactor
    && (rms - trackedFloor) >= reattackMinDelta;

  if (!state.wasAboveThreshold && rms >= armThreshold && cooldownFramesRemaining === 0) {
    event = 'onset';
    onsetWindowRemaining = onsetWindowFrames;
    cooldownFramesRemaining = cooldownFrames;
  } else if (canRetriggerOnSustain) {
    event = 'onset';
    onsetWindowRemaining = onsetWindowFrames;
    cooldownFramesRemaining = cooldownFrames;
  }

  let baselineRms = state.baselineRms;
  if (!isAboveThreshold) {
    baselineRms = baselineRms === 0
      ? rms
      : baselineRms + ((rms - baselineRms) * baselineAlpha);
  }

  return {
    nextState: {
      baselineRms,
      wasAboveThreshold: isAboveThreshold,
      aboveThresholdFloorRms: isAboveThreshold
        ? (event === 'onset' ? rms : trackedFloor)
        : null,
      cooldownFramesRemaining,
      onsetWindowRemaining,
      lastRms: rms,
    },
    event,
    rms,
    armThreshold,
  };
}
