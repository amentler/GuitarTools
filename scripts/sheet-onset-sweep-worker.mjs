import { parentPort } from 'worker_threads';
import { countGuitarOnsets } from '../tests/helpers/sheetMusicSequenceFingerprint.js';
import { candidateToOptions, scoreCandidate } from './sheetOnsetSweepCore.mjs';

parentPort.on('message', ({ batch, fixtures, scoreSpec }) => {
  const loadedFixtures = fixtures.map(({ fixture, samplesBuffer, sampleRate }) => ({
    fixture,
    audio: { samples: new Float32Array(samplesBuffer), sampleRate },
  }));

  const results = batch.map(candidate => {
    const options = candidateToOptions(candidate.parameters);
    const fixtureResults = loadedFixtures.map(({ fixture, audio }) => {
      const onsetResult = countGuitarOnsets(audio.samples, audio.sampleRate, options);
      return { fixture, onsetCount: onsetResult.count, timestampsMs: onsetResult.timestampsMs };
    });
    return scoreCandidate(candidate, fixtureResults, scoreSpec);
  });

  parentPort.postMessage(results);
});
