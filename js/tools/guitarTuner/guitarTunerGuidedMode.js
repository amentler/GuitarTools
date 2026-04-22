import {
  resetGuidedTracking,
  resetGuidedStopTracking,
} from './guitarTunerState.js';

export function startGuidedModeState(guidedState, runtime) {
  guidedState.active = true;
  guidedState.stepIndex = 0;
  guidedState.trendHistory = [];
  guidedState.feedbackDisplay = null;
  resetGuidedTracking(runtime);
}

export function nextGuidedStepState(guidedState, runtime, stepsLength) {
  guidedState.stepIndex += 1;
  guidedState.trendHistory = [];
  guidedState.feedbackDisplay = null;
  resetGuidedTracking(runtime);

  if (guidedState.stepIndex >= stepsLength) {
    guidedState.active = false;
    return { finished: true };
  }

  return { finished: false };
}

export function stopGuidedModeState(guidedState, runtime) {
  guidedState.active = false;
  guidedState.stepIndex = 0;
  guidedState.trendHistory = [];
  guidedState.feedbackDisplay = null;
  resetGuidedStopTracking(runtime);
}
