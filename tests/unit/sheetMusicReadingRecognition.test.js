// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { join } from 'path';
import { readWavFile } from '../helpers/wavDecoder.js';
import {
  softenSheetMusicFrameResult,
  updateSheetMusicMatchState,
} from '../../js/games/sheetMusicReading/sheetMusicRecognition.js';
import {
  classifyFrame,
  createMatchState,
  getRecommendedFftSize,
} from '../../js/shared/audio/fastNoteMatcher.js';

const FIXTURES_DIR = join(process.cwd(), 'tests/fixtures/audio');

function sliceCenterWindow(samples, windowSize) {
  if (samples.length <= windowSize) {
    const padded = new Float32Array(windowSize);
    padded.set(samples, 0);
    return padded;
  }
  const start = Math.floor((samples.length - windowSize) / 2);
  return samples.slice(start, start + windowSize);
}

function classifySheetMusicFixture(relativePath, targetPitch) {
  const { samples, sampleRate } = readWavFile(join(FIXTURES_DIR, relativePath));
  const windowSize = getRecommendedFftSize(targetPitch, sampleRate);
  const frameResult = classifyFrame(
    sliceCenterWindow(samples, windowSize),
    sampleRate,
    targetPitch,
    { tolerateCents: 70 },
  );
  const softened = softenSheetMusicFrameResult(frameResult, targetPitch);
  const { event } = updateSheetMusicMatchState(createMatchState(), softened);
  return { frameResult, softened, event };
}

describe('sheetMusicReading recognition tolerance', () => {
  it('accepts octave-equivalent detections in exercise mode', () => {
    const result = softenSheetMusicFrameResult({
      status: 'wrong',
      detectedPitch: 'D2',
      hz: 73.42,
      cents: -1200,
    }, 'D3');

    expect(result.status).toBe('correct');
  });

  it('keeps different pitch classes non-correct', () => {
    const result = softenSheetMusicFrameResult({
      status: 'wrong',
      detectedPitch: 'C#3',
      hz: 138.59,
      cents: -100,
    }, 'D3');

    expect(result.status).toBe('wrong');
  });

  it('accepts a usable correct frame without tuner-style streak blocking', () => {
    const { event, nextState } = updateSheetMusicMatchState(createMatchState(), {
      status: 'correct',
      detectedPitch: 'D3',
      hz: 146.83,
      cents: 0,
    });

    expect(event).toBe('accept');
    expect(nextState.accepted).toBe(true);
  });

  it('does not accept open E2 when the target note is A2', () => {
    const result = classifySheetMusicFixture('E2/e2.wav', 'A2');

    expect(result.softened.status).not.toBe('correct');
    expect(result.event).not.toBe('accept');
  }, 10_000);

  it('does not accept low open E2 when the target note is high E4', () => {
    const result = classifySheetMusicFixture('E2/e2.wav', 'E4');

    expect(result.frameResult.detectedPitch).toBe('E2');
    expect(result.softened.status).not.toBe('correct');
    expect(result.event).not.toBe('accept');
  }, 10_000);

  it('does not accept A3 when the target note is open A2', () => {
    const result = classifySheetMusicFixture('A3/a3.wav', 'A2');

    expect(result.frameResult.detectedPitch).toBe('A3');
    expect(result.softened.status).not.toBe('correct');
    expect(result.event).not.toBe('accept');
  }, 10_000);
});
