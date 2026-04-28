/**
 * playbackController.js
 * Bridges MetronomeLogic with sheet music playback.
 * 
 * Tracks global beat position so callers can determine which bar and beat
 * are currently playing.
 */

import { MetronomeLogic } from '../../shared/audio/metronomeLogic.js';

export function createPlaybackController(dependencies = {}) {
  const {
    metronome = new MetronomeLogic(dependencies)
  } = dependencies;

  // Keep playback cursor visually a touch ahead of the click for easier reading.
  metronome.setOnBeatAdvanceSeconds(0.1);

  let beatsPerBar = 4;
  let totalBeats = 0;
  let globalBeat = -1;
  let onBeatCallback = null;

  metronome.onBeat = (_beatNumber) => {
    globalBeat++;
    if (onBeatCallback) {
      const position = getCurrentBeat();
      onBeatCallback({ ...position, globalBeat });
    }
  };

  function getCurrentBeat() {
    const beat = Math.max(0, globalBeat);
    const effectiveBeat = totalBeats > 0 ? beat % totalBeats : beat;
    const barIndex = Math.floor(effectiveBeat / beatsPerBar);
    const beatIndex = effectiveBeat % beatsPerBar;
    return { barIndex, beatIndex };
  }

  return {
    init() {
      metronome.init();
    },

    onBeat(callback) {
      onBeatCallback = callback;
    },

    start(bpm, bpb, total = 0) {
      metronome.init();
      beatsPerBar = bpb || 4;
      totalBeats = total;
      globalBeat = -1;
      metronome.setBpm(bpm);
      metronome.setBeatsPerMeasure(bpb);
      metronome.start();
    },

    stop() {
      metronome.stop();
    },

    setBpm(bpm) {
      metronome.setBpm(bpm);
    },

    getCurrentBeat,

    get isPlaying() {
      return metronome.isPlaying;
    }
  };
}

// Keep class for compatibility with existing code during transition
export class PlaybackController {
  constructor() {
    this._controller = createPlaybackController();
  }
  init() { this._controller.init(); }
  onBeat(cb) { this._controller.onBeat(cb); }
  start(bpm, bpb, total) { this._controller.start(bpm, bpb, total); }
  stop() { this._controller.stop(); }
  setBpm(bpm) { this._controller.setBpm(bpm); }
  getCurrentBeat() { return this._controller.getCurrentBeat(); }
  get isPlaying() { return this._controller.isPlaying; }
}
