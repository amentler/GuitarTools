/**
 * Tests the VexFlow Voice parameters derived from getTimeSignatureConfig.
 * sheetMusicSVG.js computes `beatValue = noteDuration === 'e' ? 8 : 4`
 * and passes `{ num_beats: beatsPerBar, beat_value: beatValue }` to VexFlow Voice.
 * This file verifies those derived values are correct for all supported signatures.
 */
import { describe, it, expect } from 'vitest';
import { getTimeSignatureConfig } from '../../js/games/sheetMusicReading/sheetMusicLogic.js';

function getVoiceParams(timeSignature) {
  const config = getTimeSignatureConfig(timeSignature) || getTimeSignatureConfig('4/4');
  const { beatsPerBar, noteDuration, vfTimeSig } = config;
  const beatValue = noteDuration === 'e' ? 8 : 4;
  return { num_beats: beatsPerBar, beat_value: beatValue, vfTimeSig };
}

describe('VexFlow Voice parameters derived from time signature config', () => {
  it('4/4 → num_beats=4, beat_value=4', () => {
    expect(getVoiceParams('4/4')).toMatchObject({ num_beats: 4, beat_value: 4 });
  });

  it('3/4 → num_beats=3, beat_value=4', () => {
    expect(getVoiceParams('3/4')).toMatchObject({ num_beats: 3, beat_value: 4 });
  });

  it('2/4 → num_beats=2, beat_value=4', () => {
    expect(getVoiceParams('2/4')).toMatchObject({ num_beats: 2, beat_value: 4 });
  });

  it('3/8 → num_beats=3, beat_value=8', () => {
    expect(getVoiceParams('3/8')).toMatchObject({ num_beats: 3, beat_value: 8 });
  });

  it('6/8 → num_beats=6, beat_value=8', () => {
    expect(getVoiceParams('6/8')).toMatchObject({ num_beats: 6, beat_value: 8 });
  });

  it('quarter-note signatures always produce beat_value=4', () => {
    for (const sig of ['2/4', '3/4', '4/4']) {
      expect(getVoiceParams(sig).beat_value).toBe(4);
    }
  });

  it('eighth-note signatures always produce beat_value=8', () => {
    for (const sig of ['3/8', '6/8']) {
      expect(getVoiceParams(sig).beat_value).toBe(8);
    }
  });

  it('vfTimeSig matches the input signature string for all supported sigs', () => {
    for (const sig of ['2/4', '3/4', '4/4', '3/8', '6/8']) {
      expect(getVoiceParams(sig).vfTimeSig).toBe(sig);
    }
  });

  it('unknown time signature falls back to 4/4 defaults', () => {
    expect(getVoiceParams('5/4')).toMatchObject({ num_beats: 4, beat_value: 4 });
  });
});
