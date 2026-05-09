// Guitar-specific onset detector for note exercises.
//
// This module is intentionally pitch-agnostic: it only detects fresh attacks.
// Controllers decide whether the following pitch frames match the current task.

import { computeFrameRms } from './noteOnsetGate.js';

export const GUITAR_ONSET_MIN_RMS = 0.005;
export const GUITAR_ONSET_MIN_FLUX = 0.018;
export const GUITAR_ONSET_MIN_BAND_RATIO = 0.075;
export const GUITAR_ONSET_BIN_DELTA = 0.0015;
export const GUITAR_ONSET_COOLDOWN_FRAMES = 4;
export const GUITAR_ONSET_FIRST_FRAME_RMS = 0.018;
export const GUITAR_ONSET_DB_FLOOR = -120;

export function createGuitarOnsetState() {
  return {
    previousMagnitudes: null,
    previousRms: 0,
    cooldownFramesRemaining: 0,
    frameCount: 0,
    lastFlux: 0,
    lastBandRatio: 0,
    lastRms: 0,
  };
}

function dbToLinear(db, dbFloor) {
  const clamped = Math.max(dbFloor, Number.isFinite(db) ? db : dbFloor);
  return Math.pow(10, clamped / 20);
}

function toLinearMagnitudes(frequencyData, dbFloor) {
  const magnitudes = new Float32Array(frequencyData.length);
  for (let i = 0; i < frequencyData.length; i++) {
    magnitudes[i] = dbToLinear(frequencyData[i], dbFloor);
  }
  return magnitudes;
}

export function computeBroadbandFlux(previousMagnitudes, currentMagnitudes, options = {}) {
  if (!previousMagnitudes || previousMagnitudes.length !== currentMagnitudes.length) {
    return { flux: 0, growingBins: 0, consideredBins: Math.max(0, currentMagnitudes.length - 2), bandRatio: 0 };
  }

  const binDelta = options.binDelta ?? GUITAR_ONSET_BIN_DELTA;
  const startBin = Math.max(0, options.startBin ?? 2);
  const endBin = Math.min(currentMagnitudes.length, options.endBin ?? currentMagnitudes.length);
  let positiveFlux = 0;
  let growingBins = 0;
  let consideredBins = 0;

  for (let i = startBin; i < endBin; i++) {
    consideredBins++;
    const delta = currentMagnitudes[i] - previousMagnitudes[i];
    if (delta <= 0) continue;
    positiveFlux += delta;
    if (delta >= binDelta) growingBins++;
  }

  return {
    flux: consideredBins > 0 ? positiveFlux / consideredBins : 0,
    growingBins,
    consideredBins,
    bandRatio: consideredBins > 0 ? growingBins / consideredBins : 0,
  };
}

export function updateGuitarOnsetDetector(state, { frequencyData = null, samples = null } = {}, options = {}) {
  const minRms = options.minRms ?? GUITAR_ONSET_MIN_RMS;
  const minFlux = options.minFlux ?? GUITAR_ONSET_MIN_FLUX;
  const minBandRatio = options.minBandRatio ?? GUITAR_ONSET_MIN_BAND_RATIO;
  const cooldownFrames = options.cooldownFrames ?? GUITAR_ONSET_COOLDOWN_FRAMES;
  const firstFrameRms = options.firstFrameRms ?? GUITAR_ONSET_FIRST_FRAME_RMS;
  const dbFloor = options.dbFloor ?? GUITAR_ONSET_DB_FLOOR;

  const rms = samples ? computeFrameRms(samples) : state.previousRms;
  const currentMagnitudes = frequencyData ? toLinearMagnitudes(frequencyData, dbFloor) : null;
  const fluxResult = currentMagnitudes
    ? computeBroadbandFlux(state.previousMagnitudes, currentMagnitudes, options)
    : { flux: 0, growingBins: 0, consideredBins: 0, bandRatio: 0 };

  const cooldownFramesRemaining = Math.max(0, state.cooldownFramesRemaining - 1);
  const firstAudibleFrame = !state.previousMagnitudes
    && currentMagnitudes
    && rms >= firstFrameRms;
  const broadbandAttack = rms >= minRms
    && fluxResult.flux >= minFlux
    && fluxResult.bandRatio >= minBandRatio;

  const event = cooldownFramesRemaining === 0 && (firstAudibleFrame || broadbandAttack)
    ? 'onset'
    : null;

  return {
    nextState: {
      previousMagnitudes: currentMagnitudes ?? state.previousMagnitudes,
      previousRms: rms,
      cooldownFramesRemaining: event === 'onset' ? cooldownFrames : cooldownFramesRemaining,
      frameCount: state.frameCount + 1,
      lastFlux: fluxResult.flux,
      lastBandRatio: fluxResult.bandRatio,
      lastRms: rms,
    },
    event,
    onset: event === 'onset',
    confidence: Math.max(
      firstAudibleFrame ? 1 : 0,
      Math.min(1, Math.max(
        fluxResult.flux / Math.max(minFlux, Number.EPSILON),
        fluxResult.bandRatio / Math.max(minBandRatio, Number.EPSILON),
      ) / 2),
    ),
    rms,
    broadbandFlux: fluxResult.flux,
    growingBins: fluxResult.growingBins,
    bandRatio: fluxResult.bandRatio,
  };
}
