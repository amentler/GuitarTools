/**
 * offlineOnsetDetectionXGBoost.js
 *
 * Runtime for XGBoost ONNX-based onset detection in the browser.
 *
 * Uses onnxruntime-web (loaded from CDN or bundled).
 * model_schema.json is the single source of truth for all model parameters.
 *
 * Exports:
 *   loadXGBoostOnsetModel(modelPath, schemaPath) → { session, schema }
 *   validateAudioConfig(schema, actualSampleRate, actualFftSize, actualHopSize)
 *   detectOnsetsOfflineXGBoost(samples, sampleRate, model, options) → { onsetsSec, onsetsMs, probabilities }
 */

import {
  extractXGBoostFrameFeatures,
  buildContextFeatures,
} from './xgboostFeatureExtractor.js';
import { collectFrameData } from './collectFrameData.js';
import {
  GUITAR_ONSET_STRATEGY_KEYS,
  resolveGuitarOnsetBaseStrategy,
} from './guitarOnsetStrategies.js';

const ONNX_RUNTIME_URL = new URL('../../lib/onnxruntime/ort.min.js', import.meta.url).href;
const ONNX_RUNTIME_WASM_PATH = new URL('../../lib/onnxruntime/', import.meta.url).href;
const DEFAULT_XGBOOST_MODEL_URL = new URL('../../../models/onset_detector_android_firefox.onnx', import.meta.url).href;
const DEFAULT_XGBOOST_SCHEMA_URL = new URL('../../../models/onset_detector_android_firefox.schema.json', import.meta.url).href;

let _ortPromise = null;
let _defaultModelPromise = null;

/**
 * Lazily loads onnxruntime-web from CDN or existing global.
 * @returns {Promise<object>} ort namespace
 */
async function getORT() {
  if (typeof globalThis.ort !== 'undefined') {
    if (globalThis.ort?.env?.wasm) {
      globalThis.ort.env.wasm.wasmPaths = ONNX_RUNTIME_WASM_PATH;
      globalThis.ort.env.wasm.numThreads = 1;
    }
    return globalThis.ort;
  }
  if (_ortPromise) return _ortPromise;
  _ortPromise = new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = ONNX_RUNTIME_URL;
    script.onload = () => {
      if (globalThis.ort?.env?.wasm) {
        globalThis.ort.env.wasm.wasmPaths = ONNX_RUNTIME_WASM_PATH;
        globalThis.ort.env.wasm.numThreads = 1;
      }
      resolve(globalThis.ort);
    };
    script.onerror = () => reject(new Error('Failed to load onnxruntime-web'));
    document.head.appendChild(script);
  });
  return _ortPromise;
}

/**
 * Loads an ONNX model and its JSON schema from File objects or URLs.
 *
 * @param {File|string} modelSource   .onnx File or URL
 * @param {File|string} schemaSource  .json File or URL
 * @returns {Promise<{ session: object, schema: object }>}
 */
export async function loadXGBoostOnsetModel(modelSource, schemaSource) {
  const ort = await getORT();

  // Load schema
  let schema;
  if (schemaSource instanceof File) {
    const text = await schemaSource.text();
    schema = JSON.parse(text);
  } else if (schemaSource && typeof schemaSource === 'object' && !('href' in schemaSource)) {
    // already-parsed schema object passed directly
    schema = schemaSource;
  } else {
    const res = await fetch(schemaSource);
    schema = await res.json();
  }

  // Load ONNX model
  let modelData;
  if (modelSource instanceof File) {
    modelData = await modelSource.arrayBuffer();
  } else {
    const res = await fetch(modelSource);
    modelData = await res.arrayBuffer();
  }

  const session = await ort.InferenceSession.create(modelData, {
    executionProviders: ['wasm'],
  });

  // Warmup with zero vector
  const nFeatures = schema.featureOrder?.length ?? 0;
  if (nFeatures > 0) {
    try {
      const zeroInput = new Float32Array(nFeatures);
      const inputName = schema.inputName ?? session.inputNames[0];
      const inputTensor = new ort.Tensor('float32', zeroInput, [1, nFeatures]);
      await session.run({ [inputName]: inputTensor });
    } catch {
      // warmup errors are non-fatal
    }
  }

  return { session, schema };
}

export function loadDefaultXGBoostOnsetModel() {
  _defaultModelPromise ??= loadXGBoostOnsetModel(DEFAULT_XGBOOST_MODEL_URL, DEFAULT_XGBOOST_SCHEMA_URL);
  return _defaultModelPromise;
}

/** Cache of per-strategy model load promises, keyed by "modelUrl::schemaUrl". */
const _strategyModelCache = new Map();

/**
 * Loads the ONNX model for the given strategy.
 *
 * - If the strategy has `modelUrl` + `schemaUrl` fields (registry-backed strategies),
 *   those are loaded and cached per URL pair.  Failures are NOT silently swallowed:
 *   the returned promise rejects so the caller surfaces the error.
 * - If the strategy has no model URLs, falls back to the production default model.
 *
 * @param {object} strategy  Strategy object (from guitarOnsetStrategies.js)
 * @returns {Promise<{ session: object, schema: object }>}
 */
export function loadXGBoostModelForStrategy(strategy) {
  if (strategy?.modelUrl && strategy?.schemaUrl) {
    const cacheKey = `${strategy.modelUrl}::${strategy.schemaUrl}`;
    if (!_strategyModelCache.has(cacheKey)) {
      const p = loadXGBoostOnsetModel(strategy.modelUrl, strategy.schemaUrl);
      _strategyModelCache.set(cacheKey, p);
      // Remove on failure so the next attempt retries instead of re-using a rejected promise.
      p.catch(() => _strategyModelCache.delete(cacheKey));
    }
    return _strategyModelCache.get(cacheKey);
  }
  return loadDefaultXGBoostOnsetModel();
}

/**
 * Validates that the audio config matches the schema.
 * Warns on mismatch, does not throw.
 *
 * @param {object} schema
 * @param {number} actualSampleRate
 * @param {number} actualFftSize
 * @param {number} actualHopSize
 */
export function validateAudioConfig(schema, actualSampleRate, actualFftSize, actualHopSize) {
  const cfg = schema.audioConfig ?? {};
  if (cfg.sampleRate && cfg.sampleRate !== actualSampleRate) {
    console.warn(`[XGBoostOnset] sampleRate mismatch: schema=${cfg.sampleRate}, actual=${actualSampleRate}`);
  }
  if (cfg.fftSize && cfg.fftSize !== actualFftSize) {
    console.warn(`[XGBoostOnset] fftSize mismatch: schema=${cfg.fftSize}, actual=${actualFftSize}`);
  }
  if (cfg.hopSize && cfg.hopSize !== actualHopSize) {
    console.warn(`[XGBoostOnset] hopSize mismatch: schema=${cfg.hopSize}, actual=${actualHopSize}`);
  }
}

/**
 * Peak picking on a probability array.
 *
 * @param {number[]} probabilities
 * @param {number} hopSize
 * @param {number} sampleRate
 * @param {{ probabilityThreshold?: number, refractoryMs?: number, lookaheadFrames?: number }} decision
 * @returns {{ onsetsSec: number[], onsetsMs: number[], probabilities: number[] }}
 */
function applyPeakPicking(probabilities, hopSize, sampleRate, decision) {
  const threshold = decision?.probabilityThreshold ?? 0.5;
  const refractoryMs = decision?.refractoryMs ?? 100;
  const lookahead = decision?.lookaheadFrames ?? 1;
  const frameMs = (hopSize / sampleRate) * 1000;

  const onsetsSec = [];
  let lastOnsetMs = -Infinity;

  for (let t = lookahead; t < probabilities.length - lookahead; t++) {
    const p = probabilities[t];
    if (p <= threshold) continue;

    let isMax = true;
    for (let d = 1; d <= lookahead; d++) {
      if (probabilities[t - d] >= p || probabilities[t + d] > p) {
        isMax = false;
        break;
      }
    }
    if (!isMax) continue;

    const tMs = t * frameMs;
    if (tMs - lastOnsetMs < refractoryMs) continue;

    lastOnsetMs = tMs;
    onsetsSec.push(tMs / 1000);
  }

  return {
    onsetsSec,
    onsetsMs: onsetsSec.map(s => Math.round(s * 1000)),
    probabilities,
  };
}

/**
 * Runs XGBoost ONNX onset detection on a decoded audio buffer.
 *
 * @param {Float32Array} samples
 * @param {number} sampleRate
 * @param {{ session: object, schema: object }} model
 * @param {{
 *   threshold?: number,
 *   refractoryMs?: number,
 *   onsetStrategyKey?: string,
 *   logCompression?: number,
 * }} [options]
 * @returns {Promise<{ onsetsSec: number[], onsetsMs: number[], probabilities: number[] }>}
 */
export async function detectOnsetsOfflineXGBoost(samples, sampleRate, model, options = {}) {
  const { session, schema } = model;

  const fftSize = schema.audioConfig?.fftSize ?? 1024;
  const hopSize = schema.audioConfig?.hopSize ?? 256;
  const logCompression = schema.audioConfig?.logCompression ?? 1000;
  const featureOrder = schema.featureOrder;
  const normalization = schema.normalization;
  const decision = {
    probabilityThreshold: options.threshold ?? schema.decision?.probabilityThreshold ?? 0.5,
    refractoryMs: options.refractoryMs ?? schema.decision?.refractoryMs ?? 100,
    lookaheadFrames: schema.decision?.lookaheadFrames ?? 1,
  };

  if (!featureOrder || featureOrder.length === 0) {
    throw new Error('[XGBoostOnset] schema.featureOrder is missing or empty');
  }

  // Collect frames using the onset pipeline
  const frames = await collectFrameData(samples, sampleRate, fftSize, hopSize);
  validateAudioConfig(schema, sampleRate, fftSize, hopSize);
  const inputName = schema.inputName ?? session.inputNames[0];
  const outputName = schema.outputName ?? session.outputNames[0];

  // Prepare onset strategy for base feature extraction
  const onsetStrategy = resolveGuitarOnsetBaseStrategy(
    options.onsetStrategyKey ?? GUITAR_ONSET_STRATEGY_KEYS.SWEEP_STANDARD,
  );
  let onsetState = onsetStrategy.createState();

  const probabilities = [];
  const historyBuffer = []; // ring buffer, newest first

  let prevLinearMag = null;
  let prevRms = 0;
  let prevHfc = 0;
  let prevSpectralCentroid = 0;
  let prevSpectralRolloff = 0;
  let prevSpectralFlatness = 0;
  let prevCrestFactor = 0;
  let prevLogBandFlux_150_6000 = 0;
  const ort = await getORT();

  for (let i = 0; i < frames.length; i++) {
    const { samples: frame, frequencyData } = frames[i];

    // Run onset strategy to get state-based features
    const onsetResult = onsetStrategy.update(onsetState, { frequencyData, samples: frame });
    onsetState = onsetResult.nextState;

    const history = {
      prevMagnitudes: prevLinearMag,
      prevRms,
      prevHfc,
      prevSpectralCentroid,
      prevSpectralRolloff,
      prevSpectralFlatness,
      prevCrestFactor,
      prevLogBandFlux_150_6000,
    };

    const { baseFeatures, linearMagnitudes } = extractXGBoostFrameFeatures(
      frame,
      frequencyData,
      onsetResult,
      sampleRate,
      fftSize,
      logCompression,
      history,
    );

    // Build context features restricted to featureOrder
    const contextFeatures = buildContextFeatures(baseFeatures, historyBuffer, featureOrder);

    // Validate all required features are present
    for (const key of featureOrder) {
      if (!(key in contextFeatures)) {
        throw new Error(`[XGBoostOnset] Missing feature: "${key}"`);
      }
      const v = contextFeatures[key];
      if (!Number.isFinite(v)) {
        throw new Error(`[XGBoostOnset] Invalid value for feature "${key}": ${v}`);
      }
    }

    // Build input vector in featureOrder
    const inputVec = new Float32Array(featureOrder.length);
    for (let j = 0; j < featureOrder.length; j++) {
      let v = contextFeatures[featureOrder[j]];
      // Apply normalization if configured
      if (normalization?.enabled && normalization.type === 'standard') {
        const mean = normalization.mean?.[featureOrder[j]] ?? 0;
        const std = normalization.std?.[featureOrder[j]] ?? 1;
        v = std > 1e-10 ? (v - mean) / std : v - mean;
      }
      inputVec[j] = v;
    }

    // Run ONNX inference
    const inputTensor = new ort.Tensor('float32', inputVec, [1, featureOrder.length]);
    const results = await session.run({ [inputName]: inputTensor });
    const output = results[outputName] ?? results.probabilities;

    // Extract probability for the positive class
    const prob = output.data.length >= 2
      ? output.data[1]  // classifier output: [prob_class0, prob_class1]
      : output.data[0];
    probabilities.push(Number.isFinite(prob) ? prob : 0);

    // Update history (newest first, max 30)
    historyBuffer.unshift({ ...baseFeatures });
    if (historyBuffer.length > 30) historyBuffer.pop();

    prevLinearMag = linearMagnitudes;
    prevRms = baseFeatures.rms;
    prevHfc = baseFeatures.hfc;
    prevSpectralCentroid = baseFeatures.spectralCentroid;
    prevSpectralRolloff = baseFeatures.spectralRolloff;
    prevSpectralFlatness = baseFeatures.spectralFlatness;
    prevCrestFactor = baseFeatures.crestFactor;
    prevLogBandFlux_150_6000 = baseFeatures.logBandFlux_150_6000;
  }

  return applyPeakPicking(probabilities, hopSize, sampleRate, decision);
}
