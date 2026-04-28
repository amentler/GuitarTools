import { describe, it, expect } from 'vitest';
import { createPlaybackState, calculatePlayheadX } from '../../js/games/sheetMusicReading/playbackLogic.js';

describe('playbackLogic', () => {
  describe('createPlaybackState', () => {
    it('initializes with default values', () => {
      const state = createPlaybackState();
      expect(state.globalBeatIndex).toBe(-1);
      expect(state.isRunning).toBe(false);
      expect(state.getPosition()).toEqual({ barIndex: 0, beatIndex: 0 });
    });

    it('starts correctly', () => {
      const state = createPlaybackState();
      state.start();
      expect(state.isRunning).toBe(true);
      expect(state.globalBeatIndex).toBe(-1);
    });

    it('advances beats correctly', () => {
      const state = createPlaybackState({ beatsPerBar: 4, totalBars: 2 });
      state.start();
      
      expect(state.nextBeat()).toBe(true);
      expect(state.globalBeatIndex).toBe(0);
      expect(state.getPosition()).toEqual({ barIndex: 0, beatIndex: 0 });
      
      expect(state.nextBeat()).toBe(true);
      expect(state.globalBeatIndex).toBe(1);
      expect(state.getPosition()).toEqual({ barIndex: 0, beatIndex: 1 });
      
      // Advance to bar 1
      state.nextBeat(); // 2
      state.nextBeat(); // 3
      state.nextBeat(); // 4
      expect(state.getPosition()).toEqual({ barIndex: 1, beatIndex: 0 });
    });

    it('stops at the end in non-looping mode', () => {
      const state = createPlaybackState({ beatsPerBar: 2, totalBars: 1 });
      state.start();
      
      expect(state.nextBeat()).toBe(true); // beat 0
      expect(state.nextBeat()).toBe(true); // beat 1
      expect(state.nextBeat()).toBe(false); // end reached
      expect(state.isRunning).toBe(false);
    });

    it('loops correctly', () => {
      const state = createPlaybackState({ beatsPerBar: 2, totalBars: 1, loop: true });
      state.start();
      
      state.nextBeat(); // 0
      state.nextBeat(); // 1
      expect(state.nextBeat()).toBe(true); // loop to 0
      expect(state.globalBeatIndex).toBe(0);
      expect(state.isRunning).toBe(true);
    });

    it('handles endless mode', () => {
      const state = createPlaybackState({ beatsPerBar: 2, totalBars: 1, endless: true });
      state.start();
      
      state.nextBeat(); // 0
      state.nextBeat(); // 1
      expect(state.nextBeat()).toBe(true); // 2 (beyond totalBars)
      expect(state.globalBeatIndex).toBe(2);
      expect(state.getPosition()).toEqual({ barIndex: 1, beatIndex: 0 });
    });

    it('resets correctly', () => {
      const state = createPlaybackState();
      state.start();
      state.nextBeat();
      state.reset();
      expect(state.globalBeatIndex).toBe(-1);
      expect(state.isRunning).toBe(false);
    });
  });

  describe('calculatePlayheadX', () => {
    it('calculates position correctly without padding', () => {
      expect(calculatePlayheadX(0, 4, 100)).toBe(0);
      expect(calculatePlayheadX(1, 4, 100)).toBe(25);
      expect(calculatePlayheadX(2, 4, 100)).toBe(50);
      expect(calculatePlayheadX(3, 4, 100)).toBe(75);
    });

    it('calculates position correctly with padding', () => {
      const padding = 20;
      const width = 120; // 100 available
      expect(calculatePlayheadX(0, 4, width, padding)).toBe(20);
      expect(calculatePlayheadX(1, 4, width, padding)).toBe(45);
      expect(calculatePlayheadX(2, 4, width, padding)).toBe(70);
      expect(calculatePlayheadX(3, 4, width, padding)).toBe(95);
    });
  });
});
