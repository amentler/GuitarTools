import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createPlaybackController } from '../../js/games/sheetMusicReading/playbackController.js';

describe('playbackController', () => {
  let controller;
  let mockMetronome;
  
  beforeEach(() => {
    mockMetronome = {
      init: vi.fn(),
      start: vi.fn(),
      stop: vi.fn(),
      setBpm: vi.fn(),
      setBeatsPerMeasure: vi.fn(),
      setOnBeatAdvanceSeconds: vi.fn(),
      isPlaying: false,
      onBeat: null
    };
    controller = createPlaybackController({ metronome: mockMetronome });
  });

  it('initializes correctly', () => {
    expect(controller.getCurrentBeat()).toEqual({ barIndex: 0, beatIndex: 0 });
    expect(controller.isPlaying).toBe(false);
  });

  it('calculates position correctly during playback', () => {
    controller.start(100, 4, 8); // 4 bpb, 2 bars total
    
    // Simulate first beat
    mockMetronome.onBeat(0);
    expect(controller.getCurrentBeat()).toEqual({ barIndex: 0, beatIndex: 0 });
    
    // Second beat
    mockMetronome.onBeat(1);
    expect(controller.getCurrentBeat()).toEqual({ barIndex: 0, beatIndex: 1 });
    
    // Fifth beat (bar 1, beat 0)
    mockMetronome.onBeat(2);
    mockMetronome.onBeat(3);
    mockMetronome.onBeat(0); // Note: metronome.onBeat passes beatNumber within measure
    expect(controller.getCurrentBeat()).toEqual({ barIndex: 1, beatIndex: 0 });
  });

  it('handles wrap around correctly', () => {
    controller.start(100, 2, 2); // 2 beats total = 1 bar
    
    mockMetronome.onBeat(0); // bar 0, beat 0
    mockMetronome.onBeat(1); // bar 0, beat 1
    mockMetronome.onBeat(0); // wrap to bar 0, beat 0 (logic increments globalBeat)
    
    expect(controller.getCurrentBeat()).toEqual({ barIndex: 0, beatIndex: 0 });
  });

  it('calls onBeat callback with correct parameters', () => {
    const cb = vi.fn();
    controller.onBeat(cb);
    controller.start(100, 4, 16);
    
    mockMetronome.onBeat(0);
    expect(cb).toHaveBeenCalledWith({ barIndex: 0, beatIndex: 0, globalBeat: 0 });
  });
});
