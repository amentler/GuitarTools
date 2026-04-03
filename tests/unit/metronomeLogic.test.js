import { describe, it, expect } from 'vitest';
import { MetronomeLogic } from '../../js/tools/metronome/metronomeLogic.js';

describe('MetronomeLogic initial state', () => {
  it('starts with default BPM of 120 and 4 beats per measure', () => {
    const metro = new MetronomeLogic();
    expect(metro.bpm).toBe(120);
    expect(metro.beatsPerMeasure).toBe(4);
    expect(metro.currentBeat).toBe(0);
    expect(metro.nextNoteTime).toBe(0.0);
    expect(metro.isPlaying).toBe(false);
  });
});


describe('MetronomeLogic.setBpm', () => {
  it('sets BPM within the allowed range', () => {
    const metro = new MetronomeLogic();
    metro.setBpm(100);
    expect(metro.bpm).toBe(100);
  });

  it('clamps BPM to the minimum of 40', () => {
    const metro = new MetronomeLogic();
    metro.setBpm(10);
    expect(metro.bpm).toBe(40);
  });

  it('clamps BPM to the maximum of 240', () => {
    const metro = new MetronomeLogic();
    metro.setBpm(300);
    expect(metro.bpm).toBe(240);
  });

  it('accepts the boundary value 40', () => {
    const metro = new MetronomeLogic();
    metro.setBpm(40);
    expect(metro.bpm).toBe(40);
  });

  it('accepts the boundary value 240', () => {
    const metro = new MetronomeLogic();
    metro.setBpm(240);
    expect(metro.bpm).toBe(240);
  });
});

describe('MetronomeLogic.setBeatsPerMeasure', () => {
  it('sets beats per measure', () => {
    const metro = new MetronomeLogic();
    metro.setBeatsPerMeasure(3);
    expect(metro.beatsPerMeasure).toBe(3);
  });

  it('allows common time signatures', () => {
    const metro = new MetronomeLogic();
    for (const beats of [2, 3, 4, 6]) {
      metro.setBeatsPerMeasure(beats);
      expect(metro.beatsPerMeasure).toBe(beats);
    }
  });
});

describe('MetronomeLogic.nextNote', () => {
  it('advances currentBeat and wraps at beatsPerMeasure', () => {
    const metro = new MetronomeLogic();
    metro.nextNoteTime = 0;

    metro.nextNote();
    expect(metro.currentBeat).toBe(1);

    metro.nextNote();
    expect(metro.currentBeat).toBe(2);

    metro.nextNote();
    expect(metro.currentBeat).toBe(3);

    // Next call should wrap back to 0
    metro.nextNote();
    expect(metro.currentBeat).toBe(0);
  });

  it('advances nextNoteTime by secondsPerBeat', () => {
    const metro = new MetronomeLogic();
    metro.bpm = 120;
    metro.nextNoteTime = 1.0;
    metro.nextNote();
    // At 120 BPM, secondsPerBeat = 60/120 = 0.5
    expect(metro.nextNoteTime).toBeCloseTo(1.5);
  });
});
