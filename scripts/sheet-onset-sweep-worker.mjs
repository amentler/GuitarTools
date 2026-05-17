import { parentPort } from 'worker_threads';
import { computeLinearAndDbSpectrum } from '../tests/helpers/chordHpcpExtraction.js';
import { resolveGuitarOnsetStrategy } from '../js/shared/audio/guitarOnsetStrategies.js';
import { candidateToOptions, scoreCandidate } from './sheetOnsetSweepCore.mjs';
import { ONSET_FFT_SIZE, ONSET_HOP_DIVISOR } from '../js/shared/audio/onsetPipelineConfig.js';

const FRAME_CACHE_CONFIG_LIMIT = Math.max(
  1,
  Number(process.env.ONSET_SWEEP_WORKER_FRAME_CACHE_CONFIG_LIMIT ?? 2),
);
const frameCache = new Map();
const cachedConfigUsage = new Map();

function resolveHopSize(options, sampleRate) {
  if (options.onsetHopSize) return options.onsetHopSize;
  if (options.analyzeIntervalMs) return Math.max(1, Math.round(sampleRate * (options.analyzeIntervalMs / 1000)));
  return Math.round((options.onsetFrameSize ?? ONSET_FFT_SIZE) / ONSET_HOP_DIVISOR);
}

function precomputeFrames(samples, frameSize, hopSize) {
  const frames = [];
  const linearSpectra = [];
  const dbSpectra = [];
  for (let offset = 0; offset + frameSize <= samples.length; offset += hopSize) {
    const frame = samples.subarray(offset, offset + frameSize);
    const { linearSpectrum, dbSpectrum } = computeLinearAndDbSpectrum(frame, frameSize);
    frames.push(frame);
    linearSpectra.push(linearSpectrum);
    dbSpectra.push(dbSpectrum);
  }
  return { frames, linearSpectra, dbSpectra };
}

function touchCachedConfig(configKey) {
  cachedConfigUsage.delete(configKey);
  cachedConfigUsage.set(configKey, Date.now());
}

function evictOldFrameConfigs() {
  while (cachedConfigUsage.size > FRAME_CACHE_CONFIG_LIMIT) {
    const oldestConfigKey = cachedConfigUsage.keys().next().value;
    cachedConfigUsage.delete(oldestConfigKey);
    for (const cacheKey of frameCache.keys()) {
      if (cacheKey.startsWith(`${oldestConfigKey}\0`)) {
        frameCache.delete(cacheKey);
      }
    }
  }
}

function getCachedFrames(fixture, audio, frameSize, hopSize) {
  const configKey = `${frameSize}:${hopSize}`;
  const cacheKey = `${configKey}\0${fixture.file}`;
  const cached = frameCache.get(cacheKey);
  touchCachedConfig(configKey);
  if (cached) return cached;

  const computed = precomputeFrames(audio.samples, frameSize, hopSize);
  frameCache.set(cacheKey, computed);
  evictOldFrameConfigs();
  return computed;
}

function countOnsetsFromFrames(frameSet, sampleRate, hopSize, strategy, detectorOptions) {
  const timestampsMs = [];
  let state = strategy.createState();
  for (let i = 0; i < frameSet.frames.length; i++) {
    const result = strategy.update(
      state,
      {
        frequencyData: frameSet.dbSpectra[i],
        magnitudes: frameSet.linearSpectra[i],
        samples: frameSet.frames[i],
        sampleRate,
      },
      detectorOptions,
    );
    state = result.nextState;
    if (result.event === 'onset') {
      timestampsMs.push(Math.round((i * hopSize / sampleRate) * 1000));
    }
  }
  return { count: timestampsMs.length, timestampsMs };
}

parentPort.on('message', ({ batch, fixtures, scoreSpec }) => {
  const loadedFixtures = fixtures.map(({ fixture, samplesBuffer, sampleRate }) => ({
    fixture,
    audio: { samples: new Float32Array(samplesBuffer), sampleRate },
  }));

  // All fixtures are expected to share the same sample rate (guitar recordings).
  const sampleRate = loadedFixtures[0]?.audio.sampleRate ?? 44100;

  const results = batch.map(candidate => {
    const options = candidateToOptions(candidate.parameters);
    const frameSize = options.onsetFrameSize ?? ONSET_FFT_SIZE;
    const hopSize = resolveHopSize(options, sampleRate);
    const strategy = resolveGuitarOnsetStrategy(candidate.strategyKey ?? candidate.parameters.strategyKey);

    const fixtureResults = loadedFixtures.map(({ fixture, audio }) => {
      const onsetResult = countOnsetsFromFrames(
        getCachedFrames(fixture, audio, frameSize, hopSize),
        sampleRate,
        hopSize,
        strategy,
        options.onsetDetectorOptions,
      );
      return { fixture, onsetCount: onsetResult.count, timestampsMs: onsetResult.timestampsMs };
    });

    return scoreCandidate(candidate, fixtureResults, scoreSpec);
  });

  parentPort.postMessage(results);
});
