import { readFileSync } from 'fs';
import { createRequire } from 'module';
import { dirname, join, resolve } from 'path';
import { fileURLToPath } from 'url';
import {
  GUITAR_ONSET_STRATEGY_KEYS,
} from '../js/shared/audio/guitarOnsetStrategies.js';
import { loadXGBoostOnsetModel } from '../js/shared/audio/offlineOnsetDetectionXGBoost.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, '..');
const registryPath = join(repoRoot, 'models/strategies/registry.json');
const productionModelPath = join(repoRoot, 'models/onset_detector_android_firefox.onnx');
const productionSchemaPath = join(repoRoot, 'models/onset_detector_android_firefox.schema.json');
const ortBundlePath = join(repoRoot, 'js/lib/onnxruntime/ort.min.js');
const ortWasmDir = join(repoRoot, 'js/lib/onnxruntime');

let nodeOrtInstalled = false;
const modelCache = new Map();

export function installNodeOrt() {
  if (globalThis.ort?.InferenceSession) return globalThis.ort;
  if (nodeOrtInstalled && globalThis.ort?.InferenceSession) return globalThis.ort;

  const module = { exports: {} };
  const code = readFileSync(ortBundlePath, 'utf8');
  Function('module', 'exports', 'require', code)(module, module.exports, createRequire(import.meta.url));
  globalThis.ort = module.exports;
  if (globalThis.ort?.env?.wasm) {
    globalThis.ort.env.wasm.wasmPaths = `${ortWasmDir}/`;
    globalThis.ort.env.wasm.numThreads = 1;
  }
  nodeOrtInstalled = true;
  return globalThis.ort;
}

function readJson(path) {
  return JSON.parse(readFileSync(path, 'utf8'));
}

function readSchemaModelId(schemaPath) {
  return readJson(schemaPath).modelId ?? null;
}

function makeProductionStrategy() {
  return {
    key: GUITAR_ONSET_STRATEGY_KEYS.XGBOOST_ANDROID_FIREFOX,
    label: 'XGBoost Android Firefox',
    description: 'Production default XGBoost Android-Firefox onset model.',
    offlineDetector: 'xgboost',
    baseStrategyKey: GUITAR_ONSET_STRATEGY_KEYS.SWEEP_STANDARD,
    modelPath: productionModelPath,
    schemaPath: productionSchemaPath,
    modelId: readSchemaModelId(productionSchemaPath),
  };
}

function makeRegistryStrategy(entry) {
  const modelPath = join(repoRoot, 'models', entry.modelFile);
  const schemaPath = join(repoRoot, 'models', entry.schemaFile);
  return {
    key: entry.key,
    label: entry.label,
    description: entry.description,
    offlineDetector: 'xgboost',
    baseStrategyKey: GUITAR_ONSET_STRATEGY_KEYS.SWEEP_STANDARD,
    modelPath,
    schemaPath,
    modelId: readSchemaModelId(schemaPath),
    trainedOn: entry.trainedOn,
    trainingFileCount: entry.trainingFileCount,
  };
}

export function loadTrainedOnsetModelStrategiesForNode() {
  const registry = readJson(registryPath);
  const strategies = [makeProductionStrategy()];
  const seenModelIds = new Set(strategies.map(strategy => strategy.modelId).filter(Boolean));

  for (const entry of registry.strategies ?? []) {
    const strategy = makeRegistryStrategy(entry);
    if (strategy.modelId && seenModelIds.has(strategy.modelId)) continue;
    if (strategy.modelId) seenModelIds.add(strategy.modelId);
    strategies.push(strategy);
  }

  return strategies;
}

export async function loadNodeXGBoostModelForStrategy(strategy) {
  installNodeOrt();
  const cacheKey = `${strategy.modelPath}::${strategy.schemaPath}`;
  if (modelCache.has(cacheKey)) return modelCache.get(cacheKey);
  const schema = readJson(strategy.schemaPath);
  const modelData = readFileSync(strategy.modelPath);
  const promise = loadXGBoostOnsetModel(modelData, schema);
  modelCache.set(cacheKey, promise);
  promise.catch(() => modelCache.delete(cacheKey));
  return promise;
}
