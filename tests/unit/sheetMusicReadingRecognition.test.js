// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import {
  softenSheetMusicFrameResult,
  updateSheetMusicMatchState,
} from '../../js/games/sheetMusicReading/sheetMusicRecognition.js';
import { createMatchState } from '../../js/shared/audio/fastNoteMatcher.js';

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
});
