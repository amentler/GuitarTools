const CLIPPING_THRESHOLD = 0.95;
const QUIET_RMS_THRESHOLD = 0.01;
const MIN_DURATION_SEC = 1.5;
const ONSET_WINDOW_SIZE = 1024;
const ONSET_SEARCH_SEC = 3;
const ONSET_RMS_THRESHOLD = 0.05;
const SILENCE_WINDOW_SIZE = 1024;
const SILENCE_RMS_THRESHOLD = 0.01;
const SILENCE_RATIO_THRESHOLD = 0.5;

function rms(samples, start = 0, end = samples.length) {
  let sum = 0;
  for (let i = start; i < end; i++) sum += samples[i] * samples[i];
  return Math.sqrt(sum / (end - start));
}

export function checkClipping(samples) {
  for (let i = 0; i < samples.length; i++) {
    if (Math.abs(samples[i]) > CLIPPING_THRESHOLD) return true;
  }
  return false;
}

export function checkTooQuiet(samples) {
  return rms(samples) < QUIET_RMS_THRESHOLD;
}

export function checkTooShort(durationSec) {
  return durationSec < MIN_DURATION_SEC;
}

export function checkNoOnset(samples, sampleRate) {
  const searchEnd = Math.min(ONSET_SEARCH_SEC * sampleRate, samples.length);
  for (let i = 0; i + ONSET_WINDOW_SIZE <= searchEnd; i += ONSET_WINDOW_SIZE) {
    if (rms(samples, i, i + ONSET_WINDOW_SIZE) >= ONSET_RMS_THRESHOLD) return false;
  }
  return true;
}

export function checkSilenceRatio(samples) {
  let silentFrames = 0;
  let totalFrames = 0;
  for (let i = 0; i + SILENCE_WINDOW_SIZE <= samples.length; i += SILENCE_WINDOW_SIZE) {
    totalFrames++;
    if (rms(samples, i, i + SILENCE_WINDOW_SIZE) < SILENCE_RMS_THRESHOLD) silentFrames++;
  }
  if (totalFrames === 0) return true;
  return silentFrames / totalFrames > SILENCE_RATIO_THRESHOLD;
}

export function runQualityGates(samples, sampleRate, durationSec) {
  const failReasons = [];
  const warnReasons = [];

  if (checkClipping(samples))          failReasons.push('clipping');
  if (checkTooQuiet(samples))          failReasons.push('tooQuiet');
  if (checkTooShort(durationSec))      failReasons.push('tooShort');
  if (checkNoOnset(samples, sampleRate)) failReasons.push('noOnset');
  if (checkSilenceRatio(samples))      warnReasons.push('highSilenceRatio');

  return { passed: failReasons.length === 0, failReasons, warnReasons };
}
