import {
  GUITAR_ONSET_STRATEGY_KEYS,
  resolveGuitarOnsetBaseStrategy,
} from './guitarOnsetStrategies.js';
import { buildContextFeatures, extractXGBoostFrameFeatures } from './xgboostFeatureExtractor.js';
import { loadDefaultXGBoostOnsetModel } from './offlineOnsetDetectionXGBoost.js';

function normalizeValue(value, featureName, normalization) {
  if (!normalization?.enabled || normalization.type !== 'standard') return value;
  const mean = normalization.mean?.[featureName] ?? 0;
  const std = normalization.std?.[featureName] ?? 1;
  return std > 1e-10 ? (value - mean) / std : value - mean;
}

function makePendingPeak(frameIndex, probability, sampleRate, hopSize, lookaheadFrames) {
  const frameMs = (hopSize / sampleRate) * 1000;
  return {
    frameIndex,
    probability,
    timeMs: frameIndex * frameMs,
    releaseAtFrame: frameIndex + lookaheadFrames,
  };
}

function resolveOutput(results, outputName) {
  return results[outputName] ?? results.probabilities;
}

export async function createLiveXGBoostOnsetState(options = {}) {
  const model = options.model ?? await loadDefaultXGBoostOnsetModel();
  const schema = model.schema;
  const baseStrategy = resolveGuitarOnsetBaseStrategy(
    options.baseStrategyKey
      ?? schema.decision?.baseStrategyKey
      ?? GUITAR_ONSET_STRATEGY_KEYS.SWEEP_STANDARD,
  );

  return {
    model,
    baseStrategy,
    baseState: baseStrategy.createState(),
    historyBuffer: [],
    pendingPeaks: [],
    frameIndex: 0,
    lastProbability: -Infinity,
    lastOnsetMs: -Infinity,
    prevLinearMag: null,
    prevRms: 0,
    prevHfc: 0,
    prevSpectralCentroid: 0,
    prevSpectralRolloff: 0,
    prevSpectralFlatness: 0,
    prevCrestFactor: 0,
    prevLogBandFlux_150_6000: 0,
    perf: {
      frames: 0,
      totalMs: 0,
      maxMs: 0,
    },
  };
}

export async function updateLiveXGBoostOnsetDetector(state, {
  frequencyData,
  samples,
  sampleRate,
}, options = {}) {
  const now = typeof performance?.now === 'function' ? () => performance.now() : () => Date.now();
  const startedAt = now();
  const { session, schema } = state.model;
  const fftSize = schema.audioConfig?.fftSize ?? samples.length;
  const hopSize = schema.audioConfig?.hopSize ?? Math.round(fftSize / 4);
  const logCompression = schema.audioConfig?.logCompression ?? 1000;
  const featureOrder = schema.featureOrder;
  const normalization = schema.normalization;
  const decision = {
    probabilityThreshold: options.threshold ?? schema.decision?.probabilityThreshold ?? 0.5,
    refractoryMs: options.refractoryMs ?? schema.decision?.refractoryMs ?? 100,
    lookaheadFrames: options.lookaheadFrames ?? schema.decision?.lookaheadFrames ?? 1,
  };

  const frameSamples = samples.length === fftSize
    ? samples
    : samples.slice(Math.max(0, samples.length - fftSize));

  const baseResult = state.baseStrategy.update(state.baseState, {
    frequencyData,
    samples: frameSamples,
    sampleRate,
  });
  state.baseState = baseResult.nextState;

  const history = {
    prevMagnitudes: state.prevLinearMag,
    prevRms: state.prevRms,
    prevHfc: state.prevHfc,
    prevSpectralCentroid: state.prevSpectralCentroid,
    prevSpectralRolloff: state.prevSpectralRolloff,
    prevSpectralFlatness: state.prevSpectralFlatness,
    prevCrestFactor: state.prevCrestFactor,
    prevLogBandFlux_150_6000: state.prevLogBandFlux_150_6000,
  };

  const { baseFeatures, linearMagnitudes } = extractXGBoostFrameFeatures(
    frameSamples,
    frequencyData,
    baseResult,
    sampleRate,
    fftSize,
    logCompression,
    history,
  );
  const contextFeatures = buildContextFeatures(baseFeatures, state.historyBuffer, featureOrder);
  const inputVec = new Float32Array(featureOrder.length);
  for (let i = 0; i < featureOrder.length; i++) {
    const featureName = featureOrder[i];
    inputVec[i] = normalizeValue(contextFeatures[featureName] ?? 0, featureName, normalization);
  }

  const ort = globalThis.ort;
  const inputName = schema.inputName ?? session.inputNames[0];
  const outputName = schema.outputName ?? 'probabilities';
  const inputTensor = new ort.Tensor('float32', inputVec, [1, featureOrder.length]);
  const output = resolveOutput(await session.run({ [inputName]: inputTensor }), outputName);
  const probability = output?.data?.length >= 2 ? output.data[1] : output?.data?.[0] ?? 0;

  let event = null;
  let eventTimeMs = null;
  const currentFrame = state.frameIndex;
  const isAboveThreshold = probability > decision.probabilityThreshold;
  const isRisingPeak = isAboveThreshold && probability > state.lastProbability;
  if (isRisingPeak) {
    state.pendingPeaks.push(makePendingPeak(
      currentFrame,
      probability,
      sampleRate,
      hopSize,
      decision.lookaheadFrames,
    ));
  }

  const remainingPeaks = [];
  for (const peak of state.pendingPeaks) {
    if (peak.releaseAtFrame > currentFrame) {
      remainingPeaks.push(peak);
      continue;
    }
    if (peak.probability < probability) continue;
    if (peak.timeMs - state.lastOnsetMs < decision.refractoryMs) continue;
    state.lastOnsetMs = peak.timeMs;
    event = 'onset';
    eventTimeMs = peak.timeMs;
  }
  state.pendingPeaks = remainingPeaks;

  state.historyBuffer.unshift({ ...baseFeatures });
  if (state.historyBuffer.length > 30) state.historyBuffer.pop();

  state.prevLinearMag = linearMagnitudes;
  state.prevRms = baseFeatures.rms;
  state.prevHfc = baseFeatures.hfc;
  state.prevSpectralCentroid = baseFeatures.spectralCentroid;
  state.prevSpectralRolloff = baseFeatures.spectralRolloff;
  state.prevSpectralFlatness = baseFeatures.spectralFlatness;
  state.prevCrestFactor = baseFeatures.crestFactor;
  state.prevLogBandFlux_150_6000 = baseFeatures.logBandFlux_150_6000;
  state.lastProbability = probability;
  state.frameIndex++;

  const elapsedMs = now() - startedAt;
  state.perf.frames++;
  state.perf.totalMs += elapsedMs;
  state.perf.maxMs = Math.max(state.perf.maxMs, elapsedMs);

  return {
    nextState: state,
    event,
    eventTimeMs,
    probability,
    elapsedMs,
    averageElapsedMs: state.perf.totalMs / state.perf.frames,
    maxElapsedMs: state.perf.maxMs,
    baseResult,
  };
}
