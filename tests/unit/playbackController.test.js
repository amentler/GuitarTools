import { describe, it, expect } from 'vitest';
import { PlaybackController } from '../../js/games/sheetMusicReading/playbackController.js';

// Note: Tests avoid calling start()/stop() because they require a browser
// AudioContext. We test the pure computation logic by directly manipulating
// the controller's internal state (_globalBeat, _beatsPerBar, _totalBeats).

// ── Initial state ─────────────────────────────────────────────────────────────

describe('PlaybackController initial state', () => {
  it('starts with isPlaying=false', () => {
    const pc = new PlaybackController();
    expect(pc.isPlaying).toBe(false);
  });

  it('starts with default beatsPerBar=4', () => {
    const pc = new PlaybackController();
    expect(pc._beatsPerBar).toBe(4);
  });

  it('starts with _globalBeat=-1 (before first beat fires)', () => {
    const pc = new PlaybackController();
    expect(pc._globalBeat).toBe(-1);
  });

  it('starts with _totalBeats=0 (no wrap by default)', () => {
    const pc = new PlaybackController();
    expect(pc._totalBeats).toBe(0);
  });
});

// ── getCurrentBeat ────────────────────────────────────────────────────────────

describe('PlaybackController.getCurrentBeat – 4/4', () => {
  it('returns { barIndex: 0, beatIndex: 0 } on first beat (globalBeat=0)', () => {
    const pc = new PlaybackController();
    pc._beatsPerBar = 4;
    pc._globalBeat = 0;
    expect(pc.getCurrentBeat()).toEqual({ barIndex: 0, beatIndex: 0 });
  });

  it('returns beatIndex=1 on second beat', () => {
    const pc = new PlaybackController();
    pc._beatsPerBar = 4;
    pc._globalBeat = 1;
    expect(pc.getCurrentBeat()).toEqual({ barIndex: 0, beatIndex: 1 });
  });

  it('returns beatIndex=3 on last beat of first bar', () => {
    const pc = new PlaybackController();
    pc._beatsPerBar = 4;
    pc._globalBeat = 3;
    expect(pc.getCurrentBeat()).toEqual({ barIndex: 0, beatIndex: 3 });
  });

  it('advances to bar 1 after 4 beats', () => {
    const pc = new PlaybackController();
    pc._beatsPerBar = 4;
    pc._globalBeat = 4;
    expect(pc.getCurrentBeat()).toEqual({ barIndex: 1, beatIndex: 0 });
  });

  it('handles beat 7 (bar 1, beat 3)', () => {
    const pc = new PlaybackController();
    pc._beatsPerBar = 4;
    pc._globalBeat = 7;
    expect(pc.getCurrentBeat()).toEqual({ barIndex: 1, beatIndex: 3 });
  });

  it('advances to bar 3 after 12 beats', () => {
    const pc = new PlaybackController();
    pc._beatsPerBar = 4;
    pc._globalBeat = 12;
    expect(pc.getCurrentBeat()).toEqual({ barIndex: 3, beatIndex: 0 });
  });
});

describe('PlaybackController.getCurrentBeat – 3/4', () => {
  it('advances to bar 1 after 3 beats', () => {
    const pc = new PlaybackController();
    pc._beatsPerBar = 3;
    pc._globalBeat = 3;
    expect(pc.getCurrentBeat()).toEqual({ barIndex: 1, beatIndex: 0 });
  });

  it('returns correct position within bar 1', () => {
    const pc = new PlaybackController();
    pc._beatsPerBar = 3;
    pc._globalBeat = 4; // bar 1, beat 1
    expect(pc.getCurrentBeat()).toEqual({ barIndex: 1, beatIndex: 1 });
  });

  it('handles last beat of bar 2 (beat 8)', () => {
    const pc = new PlaybackController();
    pc._beatsPerBar = 3;
    pc._globalBeat = 8; // bar 2, beat 2
    expect(pc.getCurrentBeat()).toEqual({ barIndex: 2, beatIndex: 2 });
  });
});

describe('PlaybackController.getCurrentBeat – 6/8', () => {
  it('advances to bar 1 after 6 beats', () => {
    const pc = new PlaybackController();
    pc._beatsPerBar = 6;
    pc._globalBeat = 6;
    expect(pc.getCurrentBeat()).toEqual({ barIndex: 1, beatIndex: 0 });
  });

  it('returns correct position within bar 1 at beat 7', () => {
    const pc = new PlaybackController();
    pc._beatsPerBar = 6;
    pc._globalBeat = 7;
    expect(pc.getCurrentBeat()).toEqual({ barIndex: 1, beatIndex: 1 });
  });

  it('handles last beat of first bar (beat 5)', () => {
    const pc = new PlaybackController();
    pc._beatsPerBar = 6;
    pc._globalBeat = 5;
    expect(pc.getCurrentBeat()).toEqual({ barIndex: 0, beatIndex: 5 });
  });
});

describe('PlaybackController.getCurrentBeat – wrap-around with totalBeats', () => {
  it('wraps back to bar 0 after totalBeats beats', () => {
    const pc = new PlaybackController();
    pc._beatsPerBar = 4;
    pc._totalBeats = 16; // 4 bars of 4/4
    pc._globalBeat = 16; // exactly at wrap point
    expect(pc.getCurrentBeat()).toEqual({ barIndex: 0, beatIndex: 0 });
  });

  it('wraps correctly mid-piece', () => {
    const pc = new PlaybackController();
    pc._beatsPerBar = 4;
    pc._totalBeats = 16;
    pc._globalBeat = 17; // beat 17 → effective beat 1
    expect(pc.getCurrentBeat()).toEqual({ barIndex: 0, beatIndex: 1 });
  });

  it('does not wrap when totalBeats is 0', () => {
    const pc = new PlaybackController();
    pc._beatsPerBar = 4;
    pc._totalBeats = 0;
    pc._globalBeat = 100;
    expect(pc.getCurrentBeat()).toEqual({ barIndex: 25, beatIndex: 0 });
  });

  it('clamps negative globalBeat to 0', () => {
    const pc = new PlaybackController();
    pc._beatsPerBar = 4;
    pc._globalBeat = -1; // pre-start state
    expect(pc.getCurrentBeat()).toEqual({ barIndex: 0, beatIndex: 0 });
  });
});

// ── setBpm ────────────────────────────────────────────────────────────────────

describe('PlaybackController.setBpm', () => {
  it('delegates to internal metronome', () => {
    const pc = new PlaybackController();
    pc.setBpm(100);
    expect(pc._metronome.bpm).toBe(100);
  });

  it('clamps BPM to minimum 40 (via metronome)', () => {
    const pc = new PlaybackController();
    pc.setBpm(10);
    expect(pc._metronome.bpm).toBe(40);
  });

  it('clamps BPM to maximum 240 (via metronome)', () => {
    const pc = new PlaybackController();
    pc.setBpm(999);
    expect(pc._metronome.bpm).toBe(240);
  });

  it('accepts boundary value 40', () => {
    const pc = new PlaybackController();
    pc.setBpm(40);
    expect(pc._metronome.bpm).toBe(40);
  });

  it('accepts boundary value 240', () => {
    const pc = new PlaybackController();
    pc.setBpm(240);
    expect(pc._metronome.bpm).toBe(240);
  });
});

// ── onBeat callback ───────────────────────────────────────────────────────────

describe('PlaybackController.onBeat callback', () => {
  it('registers callback without error', () => {
    const pc = new PlaybackController();
    expect(() => pc.onBeat(() => {})).not.toThrow();
  });

  it('registered callback fires when metronome onBeat is triggered', () => {
    const pc = new PlaybackController();
    pc._beatsPerBar = 4;
    pc._globalBeat = -1;

    const calls = [];
    pc.onBeat(data => calls.push(data));

    // Simulate metronome firing beat 0
    pc._metronome.onBeat(0);
    expect(calls).toHaveLength(1);
    expect(calls[0]).toEqual({ barIndex: 0, beatIndex: 0, globalBeat: 0 });

    // Simulate metronome firing beat 1
    pc._metronome.onBeat(1);
    expect(calls).toHaveLength(2);
    expect(calls[1]).toEqual({ barIndex: 0, beatIndex: 1, globalBeat: 1 });
  });

  it('advances barIndex after beatsPerBar beats', () => {
    const pc = new PlaybackController();
    pc._beatsPerBar = 4;
    pc._globalBeat = -1;

    const barIndices = [];
    pc.onBeat(({ barIndex }) => barIndices.push(barIndex));

    // Fire 5 beats (0–4)
    for (let i = 0; i < 5; i++) {
      pc._metronome.onBeat(i % 4);
    }
    expect(barIndices).toEqual([0, 0, 0, 0, 1]);
  });

  it('replacing callback with null stops notifications', () => {
    const pc = new PlaybackController();
    pc._beatsPerBar = 4;
    pc._globalBeat = -1;

    const calls = [];
    pc.onBeat(data => calls.push(data));
    pc._metronome.onBeat(0);
    expect(calls).toHaveLength(1);

    pc.onBeat(null);
    pc._metronome.onBeat(1);
    expect(calls).toHaveLength(1); // no new call
  });
});
