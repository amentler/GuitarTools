// Guitar-specific onset detector for note exercises.
//
// This module is intentionally pitch-agnostic: it only detects fresh attacks.
// Controllers decide whether the following pitch frames match the current task.

import { computeFrameRms } from './rms.js';

export const GUITAR_ONSET_MIN_RMS = 0.005;
export const GUITAR_ONSET_MIN_FLUX = 0.018;
export const GUITAR_ONSET_MIN_BAND_RATIO = 0.075;
export const GUITAR_ONSET_BIN_DELTA = 0.0015;
export const GUITAR_ONSET_COOLDOWN_FRAMES = 4;
export const GUITAR_ONSET_FIRST_FRAME_RMS = 0.018;
export const GUITAR_ONSET_RMS_SPIKE_FACTOR = 2.4;
export const GUITAR_ONSET_RMS_MIN_DELTA = 0.012;
export const GUITAR_ONSET_SPECTRAL_ACTIVITY_DB = -90;
export const GUITAR_ONSET_MIN_ACTIVE_BAND_RATIO = 0.003;
export const GUITAR_ONSET_DB_FLOOR = -120;
export const GUITAR_ONSET_RELATIVE_REATTACK_FACTOR = 4;
export const GUITAR_ONSET_RELATIVE_REATTACK_MIN_DELTA = 0.010431;
export const GUITAR_ONSET_RELATIVE_FLUX_FACTOR = 1.4;
export const GUITAR_ONSET_SPECTRAL_NOVELTY_RATIO = 2.58629;
export const GUITAR_ONSET_SPECTRAL_NOVELTY_MIN_BINS = 34;
export const GUITAR_ONSET_CONFIRMED_RMS_FACTOR = 1.420684;
export const GUITAR_ONSET_CONFIRMED_RMS_MIN_DELTA = 0.002041;
export const GUITAR_ONSET_CONFIRMED_FLUX_FACTOR = 2.097673;
export const GUITAR_ONSET_CONFIRMED_MIN_FLUX = 0.00754;
export const GUITAR_ONSET_CONFIRMED_MIN_BAND_RATIO = 0.00835;
export const GUITAR_ONSET_CONFIRMED_SPECTRAL_NOVELTY_MIN_BINS = 9;
export const GUITAR_ONSET_COOLDOWN_OVERRIDE_FACTOR = 5;
export const GUITAR_ONSET_COOLDOWN_OVERRIDE_MIN_FLUX = 0.011324;
export const GUITAR_ONSET_COOLDOWN_OVERRIDE_MIN_BAND_RATIO = 0.051923;

export const DEFAULT_GUITAR_ONSET_OPTIONS = Object.freeze({
  minRms: GUITAR_ONSET_MIN_RMS,
  minFlux: GUITAR_ONSET_MIN_FLUX,
  minBandRatio: GUITAR_ONSET_MIN_BAND_RATIO,
  binDelta: GUITAR_ONSET_BIN_DELTA,
  cooldownFrames: 3,
  broadbandOrMinBins: null,
  firstFrameRms: GUITAR_ONSET_FIRST_FRAME_RMS,
  rmsSpikeFactor: GUITAR_ONSET_RMS_SPIKE_FACTOR,
  rmsMinDelta: GUITAR_ONSET_RMS_MIN_DELTA,
  spectralActivityDb: GUITAR_ONSET_SPECTRAL_ACTIVITY_DB,
  minActiveBandRatio: GUITAR_ONSET_MIN_ACTIVE_BAND_RATIO,
  dbFloor: GUITAR_ONSET_DB_FLOOR,
  startBin: 2,
  endBin: null,
  sustainFloorDecay: 0.08,
  sustainFloorAttack: 0.02,
  relativeReattackFactor: GUITAR_ONSET_RELATIVE_REATTACK_FACTOR,
  relativeReattackMinDelta: GUITAR_ONSET_RELATIVE_REATTACK_MIN_DELTA,
  relativeFluxFactor: GUITAR_ONSET_RELATIVE_FLUX_FACTOR,
  fluxHistoryDecay: 0.08,
  spectralNoveltyRatio: GUITAR_ONSET_SPECTRAL_NOVELTY_RATIO,
  spectralNoveltyMinBins: GUITAR_ONSET_SPECTRAL_NOVELTY_MIN_BINS,
  confirmedRmsFactor: GUITAR_ONSET_CONFIRMED_RMS_FACTOR,
  confirmedRmsMinDelta: GUITAR_ONSET_CONFIRMED_RMS_MIN_DELTA,
  confirmedFluxFactor: GUITAR_ONSET_CONFIRMED_FLUX_FACTOR,
  confirmedMinFlux: GUITAR_ONSET_CONFIRMED_MIN_FLUX,
  confirmedMinBandRatio: GUITAR_ONSET_CONFIRMED_MIN_BAND_RATIO,
  confirmedSpectralNoveltyMinBins: GUITAR_ONSET_CONFIRMED_SPECTRAL_NOVELTY_MIN_BINS,
  cooldownOverrideFactor: GUITAR_ONSET_COOLDOWN_OVERRIDE_FACTOR,
  cooldownOverrideMinFlux: GUITAR_ONSET_COOLDOWN_OVERRIDE_MIN_FLUX,
  cooldownOverrideMinBandRatio: GUITAR_ONSET_COOLDOWN_OVERRIDE_MIN_BAND_RATIO,
});

export function createGuitarOnsetState() {
  return {
    previousMagnitudes: null,
    previousRms: 0,
    sustainFloorRms: 0,
    fluxHistory: 0,
    cooldownFramesRemaining: 0,
    frameCount: 0,
    lastFlux: 0,
    lastBandRatio: 0,
    lastRms: 0,
    lastActiveBandRatio: 0,
  };
}

export function normalizeGuitarOnsetOptions(options = {}) {
  const merged = { ...DEFAULT_GUITAR_ONSET_OPTIONS, ...options };
  merged._activeBandThreshold = Math.pow(10, merged.spectralActivityDb / 20);
  return merged;
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

function computeSpectralNoveltyBins(previousMagnitudes, currentMagnitudes, options = {}) {
  if (!previousMagnitudes || previousMagnitudes.length !== currentMagnitudes.length) {
    return 0;
  }

  const binDelta = options.binDelta;
  const ratio = options.spectralNoveltyRatio;
  if (!Number.isFinite(ratio)) return 0;

  const startBin = Math.max(0, options.startBin);
  const endBin = Math.min(currentMagnitudes.length, options.endBin ?? currentMagnitudes.length);
  let noveltyBins = 0;

  for (let i = startBin; i < endBin; i++) {
    const previous = previousMagnitudes[i];
    const current = currentMagnitudes[i];
    if (current - previous >= binDelta && current >= Math.max(previous * ratio, binDelta)) {
      noveltyBins++;
    }
  }

  return noveltyBins;
}

function computeActiveBandRatio(frequencyData, options = {}) {
  if (!frequencyData) return 0;

  const thresholdDb = options.spectralActivityDb ?? GUITAR_ONSET_SPECTRAL_ACTIVITY_DB;
  const startBin = Math.max(0, options.startBin ?? 2);
  const endBin = Math.min(frequencyData.length, options.endBin ?? frequencyData.length);
  let activeBins = 0;
  let consideredBins = 0;

  for (let i = startBin; i < endBin; i++) {
    consideredBins++;
    if (frequencyData[i] >= thresholdDb) activeBins++;
  }

  return consideredBins > 0 ? activeBins / consideredBins : 0;
}

function computeActiveBandRatioLinear(magnitudes, options) {
  const threshold = options._activeBandThreshold;
  const startBin = options.startBin;
  const endBin = Math.min(magnitudes.length, options.endBin ?? magnitudes.length);
  const consideredBins = endBin - startBin;
  if (consideredBins <= 0) return 0;
  let activeBins = 0;
  for (let i = startBin; i < endBin; i++) {
    if (magnitudes[i] >= threshold) activeBins++;
  }
  return activeBins / consideredBins;
}

export function updateGuitarOnsetDetectorNormalized(state, { frequencyData = null, magnitudes = null, samples = null, rms: providedRms = null } = {}, normalizedOptions) {
  const {
    minRms,
    minFlux,
    minBandRatio,
    cooldownFrames,
    firstFrameRms,
    rmsSpikeFactor,
    rmsMinDelta,
    minActiveBandRatio,
    dbFloor,
    sustainFloorDecay,
    sustainFloorAttack,
    relativeReattackFactor,
    relativeReattackMinDelta,
    relativeFluxFactor,
    fluxHistoryDecay,
    spectralNoveltyMinBins,
    confirmedRmsFactor,
    confirmedRmsMinDelta,
    confirmedFluxFactor,
    confirmedMinFlux,
    confirmedMinBandRatio,
    confirmedSpectralNoveltyMinBins,
    cooldownOverrideFactor,
    cooldownOverrideMinFlux,
    cooldownOverrideMinBandRatio,
  } = normalizedOptions;

  const rms = Number.isFinite(providedRms)
    ? providedRms
    : (samples ? computeFrameRms(samples) : state.previousRms);
  const currentMagnitudes = magnitudes ?? (frequencyData ? toLinearMagnitudes(frequencyData, dbFloor) : null);
  const activeBandRatio = currentMagnitudes
    ? computeActiveBandRatioLinear(currentMagnitudes, normalizedOptions)
    : computeActiveBandRatio(frequencyData, normalizedOptions);
  const fluxResult = currentMagnitudes
    ? computeBroadbandFlux(state.previousMagnitudes, currentMagnitudes, normalizedOptions)
    : { flux: 0, growingBins: 0, consideredBins: 0, bandRatio: 0 };
  const spectralNoveltyBins = currentMagnitudes
    ? computeSpectralNoveltyBins(state.previousMagnitudes, currentMagnitudes, normalizedOptions)
    : 0;

  const cooldownFramesRemaining = Math.max(0, state.cooldownFramesRemaining - 1);
  const sustainFloorRms = state.sustainFloorRms ?? state.previousRms ?? 0;
  const fluxHistory = state.fluxHistory ?? state.lastFlux ?? 0;
  const firstAudibleFrame = !state.previousMagnitudes
    && currentMagnitudes
    && rms >= firstFrameRms;
  const broadbandAttack = rms >= minRms
    && fluxResult.flux >= minFlux
    && fluxResult.bandRatio >= minBandRatio;
  const rmsAttack = rms >= minRms
    && activeBandRatio >= minActiveBandRatio
    && rms >= Math.max(state.previousRms * rmsSpikeFactor, state.previousRms + rmsMinDelta);
  const relativeRmsAttack = Number.isFinite(relativeReattackFactor)
    && sustainFloorRms > 0
    && rms >= minRms
    && activeBandRatio >= minActiveBandRatio
    && rms >= sustainFloorRms * relativeReattackFactor
    && rms - sustainFloorRms >= relativeReattackMinDelta;
  const relativeSpectralAttack = Number.isFinite(relativeFluxFactor)
    && fluxHistory > 0
    && rms >= minRms
    && fluxResult.flux >= fluxHistory * relativeFluxFactor
    && spectralNoveltyBins >= spectralNoveltyMinBins;
  const confirmedWeakRmsFluxAttack = Number.isFinite(confirmedRmsFactor)
    && Number.isFinite(confirmedFluxFactor)
    && sustainFloorRms > 0
    && fluxHistory > 0
    && rms >= minRms
    && activeBandRatio >= minActiveBandRatio
    && rms >= sustainFloorRms * confirmedRmsFactor
    && rms - sustainFloorRms >= confirmedRmsMinDelta
    && fluxResult.flux >= Math.max(confirmedMinFlux, fluxHistory * confirmedFluxFactor)
    && fluxResult.bandRatio >= confirmedMinBandRatio
    && spectralNoveltyBins >= confirmedSpectralNoveltyMinBins;
  const cooldownOverrideAttack = cooldownFramesRemaining > 0
    && Number.isFinite(cooldownOverrideFactor)
    && sustainFloorRms > 0
    && rms >= sustainFloorRms * cooldownOverrideFactor
    && fluxResult.flux >= cooldownOverrideMinFlux
    && fluxResult.bandRatio >= cooldownOverrideMinBandRatio;
  const broadbandOrAttack = Number.isFinite(normalizedOptions.broadbandOrMinBins)
    && rms >= minRms
    && (fluxResult.flux >= minFlux
        || fluxResult.bandRatio >= minBandRatio
        || spectralNoveltyBins >= normalizedOptions.broadbandOrMinBins);

  const attack = firstAudibleFrame
    || broadbandAttack
    || rmsAttack
    || relativeRmsAttack
    || relativeSpectralAttack
    || confirmedWeakRmsFluxAttack
    || broadbandOrAttack;
  const event = (cooldownFramesRemaining === 0 || cooldownOverrideAttack) && attack
    ? 'onset'
    : null;
  const nextSustainFloorRms = event === 'onset'
    ? rms
    : sustainFloorRms <= 0
    ? rms
    : sustainFloorRms + (rms - sustainFloorRms) * (rms < sustainFloorRms ? sustainFloorDecay : sustainFloorAttack);
  const nextFluxHistory = event === 'onset'
    ? fluxResult.flux
    : fluxHistory <= 0
    ? fluxResult.flux
    : fluxHistory + (fluxResult.flux - fluxHistory) * fluxHistoryDecay;

  return {
    nextState: {
      previousMagnitudes: currentMagnitudes ?? state.previousMagnitudes,
      previousRms: rms,
      sustainFloorRms: nextSustainFloorRms,
      fluxHistory: nextFluxHistory,
      cooldownFramesRemaining: event === 'onset' ? cooldownFrames : cooldownFramesRemaining,
      frameCount: state.frameCount + 1,
      lastFlux: fluxResult.flux,
      lastBandRatio: fluxResult.bandRatio,
      lastRms: rms,
      lastActiveBandRatio: activeBandRatio,
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
    activeBandRatio,
    spectralNoveltyBins,
    relativeRmsAttack,
    relativeSpectralAttack,
    confirmedWeakRmsFluxAttack,
    cooldownOverrideAttack,
    broadbandOrAttack,
    sustainFloorRms,
    fluxHistory,
    relativeRms: sustainFloorRms > 0 ? rms / sustainFloorRms : 0,
    relativeFlux: fluxHistory > 0 ? fluxResult.flux / fluxHistory : 0,
    options: normalizedOptions,
  };
}

export function updateGuitarOnsetDetector(state, { frequencyData = null, samples = null, rms: providedRms = null } = {}, options = {}) {
  return updateGuitarOnsetDetectorNormalized(
    state,
    { frequencyData, samples, rms: providedRms },
    normalizeGuitarOnsetOptions(options),
  );
}
