// Sequence simulator – slides a window over a WAV recording, feeds each
// frame through fastNoteMatcher's classifyFrame + updateMatchState, and
// returns the accepted note sequence. Used by sequence integration tests.

import {
  classifyFrame,
  createMatchState,
  updateMatchState,
  getRecommendedFftSize,
} from '../../js/games/sheetMusicMic/fastNoteMatcher.js';

/**
 * Runs a full sequence simulation over a recording.
 *
 * The simulator walks through `targetSequence` one note at a time, feeding
 * overlapping audio windows into classifyFrame until the note is accepted
 * (or the audio runs out). On accept, it advances to the next target note
 * and resets the match state. Reject events are ignored (easy-mode
 * behaviour) unless `options.hardMode` is set.
 *
 * @param {Float32Array} samples       Decoded mono audio samples.
 * @param {number}       sampleRate    Sample rate of the recording.
 * @param {string[]}     targetSequence  Expected note sequence, e.g. ["E2","A2","D3"].
 * @param {object}       [options]
 * @param {number}       [options.hopSize]    Samples to advance per frame (default: fftSize / hopDivisor).
 * @param {number}       [options.hopDivisor] Divisor for default hop (default: 2).
 * @param {boolean}      [options.hardMode]   If true, reject resets to note 0 (default: false).
 * @returns {{
 *   acceptedSequence: string[],
 *   finalTargetIndex: number,
 *   framesProcessed: number,
 *   acceptTimestamps: number[],
 * }}
 */
export function runSequenceSimulation(samples, sampleRate, targetSequence, options = {}) {
  const hardMode = options.hardMode ?? false;
  const acceptedSequence = [];
  const acceptTimestamps = [];
  let targetIndex = 0;
  let framesProcessed = 0;
  let state = createMatchState();

  if (targetSequence.length === 0) {
    return { acceptedSequence, finalTargetIndex: 0, framesProcessed: 0, acceptTimestamps };
  }

  let currentTarget = targetSequence[targetIndex];
  let fftSize = getRecommendedFftSize(currentTarget, sampleRate);
  const hopDivisor = options.hopDivisor ?? 2;
  const hopSize = options.hopSize ?? Math.floor(fftSize / hopDivisor);

  let offset = 0;

  while (offset + fftSize <= samples.length && targetIndex < targetSequence.length) {
    const window = samples.slice(offset, offset + fftSize);
    const frameResult = classifyFrame(window, sampleRate, currentTarget);
    framesProcessed++;

    const { nextState, event } = updateMatchState(state, frameResult);
    state = nextState;

    if (event === 'accept') {
      acceptedSequence.push(currentTarget);
      acceptTimestamps.push(offset / sampleRate);
      targetIndex++;

      if (targetIndex < targetSequence.length) {
        currentTarget = targetSequence[targetIndex];
        const newFftSize = getRecommendedFftSize(currentTarget, sampleRate);
        if (newFftSize !== fftSize) {
          fftSize = newFftSize;
        }
        state = createMatchState();
      }
    } else if (event === 'reject') {
      if (hardMode) {
        // Hard mode: restart from the beginning of the sequence
        targetIndex = 0;
        currentTarget = targetSequence[0];
        fftSize = getRecommendedFftSize(currentTarget, sampleRate);
        acceptedSequence.length = 0;
        acceptTimestamps.length = 0;
      }
      // Reset state so the matcher can keep trying (easy mode continues,
      // hard mode starts fresh from note 0).
      state = createMatchState();
    }

    offset += hopSize;
  }

  return {
    acceptedSequence,
    finalTargetIndex: targetIndex,
    framesProcessed,
    acceptTimestamps,
  };
}
