import { describe, it, expect } from 'vitest';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { readWavFile } from '../helpers/wavDecoder.js';
import {
  classifyFrame,
  createMatchState,
  updateMatchState,
  getRecommendedFftSize,
} from '../../js/shared/audio/fastNoteMatcher.js';
import {
  createOnsetGateState,
  updateOnsetGate,
  isOnsetGateOpen,
  consumeOnsetGate,
} from '../../js/shared/audio/noteOnsetGate.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const FIXTURE_PATH = join(__dirname, '../fixtures/audio/A2/a2-2.wav');
const FIXTURE_NOTE = 'A2';

function concatBuffers(buffers) {
  const totalLength = buffers.reduce((sum, buf) => sum + buf.length, 0);
  const out = new Float32Array(totalLength);
  let offset = 0;
  for (const buf of buffers) {
    out.set(buf, offset);
    offset += buf.length;
  }
  return out;
}

function silenceBuffer(sampleRate, durationSec) {
  return new Float32Array(Math.floor(sampleRate * durationSec));
}

function runOnsetAwareSequenceSimulation(samples, sampleRate, targetSequence) {
  const acceptedSequence = [];
  let targetIndex = 0;
  let matchState = createMatchState();
  let onsetGateState = createOnsetGateState();

  if (targetSequence.length === 0) return acceptedSequence;

  let currentTarget = targetSequence[targetIndex];
  let fftSize = getRecommendedFftSize(currentTarget, sampleRate);
  const hopSize = Math.floor(fftSize / 2);
  let offset = 0;

  while (offset + fftSize <= samples.length && targetIndex < targetSequence.length) {
    const window = samples.slice(offset, offset + fftSize);

    const gate = updateOnsetGate(onsetGateState, window);
    onsetGateState = gate.nextState;

    let frameResult = classifyFrame(window, sampleRate, currentTarget);
    if (!isOnsetGateOpen(onsetGateState)) {
      frameResult = { ...frameResult, status: 'unsure' };
    }

    const { nextState, event } = updateMatchState(matchState, frameResult);
    matchState = nextState;

    if (event === 'accept') {
      acceptedSequence.push(currentTarget);
      targetIndex++;
      matchState = createMatchState();
      onsetGateState = consumeOnsetGate(onsetGateState);

      if (targetIndex < targetSequence.length) {
        currentTarget = targetSequence[targetIndex];
        fftSize = getRecommendedFftSize(currentTarget, sampleRate);
      }
    }

    offset += hopSize;
  }

  return acceptedSequence;
}

describe('noteOnsetGate with real audio fixtures', () => {
  function loadFixture() {
    const { samples, sampleRate } = readWavFile(FIXTURE_PATH);
    return {
      filePath: FIXTURE_PATH,
      samples,
      sampleRate,
      durationSec: samples.length / sampleRate,
    };
  }

  it('uses the fixed A2 fixture for repeated-note gating tests', () => {
    const fixture = loadFixture();
    expect(fixture.filePath).toContain('tests/fixtures/audio/A2/a2-2.wav');
    expect(fixture.durationSec).toBeGreaterThan(1);
  }, 10_000);

  it('counts a long sustained recording only once against repeated identical targets', () => {
    const fixture = loadFixture();
    const targetPitch = FIXTURE_NOTE;
    const accepted = runOnsetAwareSequenceSimulation(
      fixture.samples,
      fixture.sampleRate,
      [targetPitch, targetPitch, targetPitch],
    );

    expect(fixture.filePath).toContain('a2-2.wav');
    expect(accepted).toEqual([targetPitch]);
  }, 20_000);

  it('counts each replay of the same A2 WAV as a new note when separated by a short silence', () => {
    const fixture = loadFixture();
    const targetPitch = FIXTURE_NOTE;
    const replayedSamples = concatBuffers([
      fixture.samples,
      silenceBuffer(fixture.sampleRate, 0.2),
      fixture.samples,
      silenceBuffer(fixture.sampleRate, 0.2),
      fixture.samples,
    ]);

    const accepted = runOnsetAwareSequenceSimulation(
      replayedSamples,
      fixture.sampleRate,
      [targetPitch, targetPitch, targetPitch],
    );

    expect(fixture.filePath).toContain('a2-2.wav');
    expect(accepted).toEqual([targetPitch, targetPitch, targetPitch]);
  }, 30_000);
});
