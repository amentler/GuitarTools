import { parentPort } from 'worker_threads';
import { computeLinearSpectrum } from '../tests/helpers/chordHpcpExtraction.js';
import { computeFrameRms } from '../js/shared/audio/rms.js';
import {
  createGuitarOnsetState,
  normalizeGuitarOnsetOptions,
  updateGuitarOnsetDetectorNormalized,
} from '../js/shared/audio/guitarOnsetDetector.js';
import { candidateToOptions, scoreCandidate } from './sheetOnsetSweepCore.mjs';

const DEFAULT_ONSET_FRAME_SIZE = 4096;
const DEFAULT_ANALYZE_INTERVAL_MS = 41;

function resolveHopSize(options, sampleRate) {
  return options.onsetHopSize
    ?? Math.max(1, Math.round(sampleRate * ((options.analyzeIntervalMs ?? DEFAULT_ANALYZE_INTERVAL_MS) / 1000)));
}

function precomputeFrames(samples, frameSize, hopSize) {
  const spectra = [];
  const rmsValues = [];
  for (let offset = 0; offset + frameSize <= samples.length; offset += hopSize) {
    const frame = samples.subarray(offset, offset + frameSize);
    spectra.push(computeLinearSpectrum(frame, frameSize));
    rmsValues.push(computeFrameRms(frame));
  }
  return { spectra, rmsValues };
}

function countOnsetsFromFrames(spectra, rmsValues, sampleRate, hopSize, normalizedOptions) {
  const timestampsMs = [];
  let state = createGuitarOnsetState();
  for (let i = 0; i < spectra.length; i++) {
    const result = updateGuitarOnsetDetectorNormalized(
      state,
      { magnitudes: spectra[i], rms: rmsValues[i] },
      normalizedOptions,
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

  // Collect unique (frameSize, hopSize) combinations across the batch.
  const hopConfigs = new Map();
  for (const { parameters } of batch) {
    const options = candidateToOptions(parameters);
    const frameSize = options.onsetFrameSize ?? DEFAULT_ONSET_FRAME_SIZE;
    const hopSize = resolveHopSize(options, sampleRate);
    const key = `${frameSize}:${hopSize}`;
    if (!hopConfigs.has(key)) hopConfigs.set(key, { frameSize, hopSize });
  }

  // Precompute FFT spectra and RMS once per unique config × fixture.
  const framesCache = new Map();
  for (const [key, { frameSize, hopSize }] of hopConfigs) {
    framesCache.set(key, loadedFixtures.map(({ audio }) =>
      precomputeFrames(audio.samples, frameSize, hopSize),
    ));
  }

  const results = batch.map(candidate => {
    const options = candidateToOptions(candidate.parameters);
    const frameSize = options.onsetFrameSize ?? DEFAULT_ONSET_FRAME_SIZE;
    const hopSize = resolveHopSize(options, sampleRate);
    const key = `${frameSize}:${hopSize}`;
    const fixtureFrames = framesCache.get(key);
    const normalizedOptions = normalizeGuitarOnsetOptions(options.onsetDetectorOptions);

    const fixtureResults = loadedFixtures.map(({ fixture }, i) => {
      const { spectra, rmsValues } = fixtureFrames[i];
      const onsetResult = countOnsetsFromFrames(spectra, rmsValues, sampleRate, hopSize, normalizedOptions);
      return { fixture, onsetCount: onsetResult.count, timestampsMs: onsetResult.timestampsMs };
    });

    return scoreCandidate(candidate, fixtureResults, scoreSpec);
  });

  parentPort.postMessage(results);
});
