/**
 * playbackController.js
 * Bridges MetronomeLogic with sheet music playback.
 *
 * Tracks global beat position (not just beat within measure) so callers can
 * determine which bar and which beat within that bar are currently playing.
 *
 * Usage:
 *   const pc = new PlaybackController();
 *   pc.onBeat(({ barIndex, beatIndex }) => highlightNote(barIndex, beatIndex));
 *   pc.init();          // call after a user gesture (AudioContext requirement)
 *   pc.start(80, 4, 16); // 80 BPM, 4 beats/bar, 16 total beats (4 bars)
 *   pc.stop();
 */

import { MetronomeLogic } from '../../tools/metronome/metronomeLogic.js';

export class PlaybackController {
  constructor() {
    this._metronome = new MetronomeLogic();
    // Keep playback cursor visually a touch ahead of the click for easier reading.
    this._metronome.setOnBeatAdvanceSeconds(0.1);
    this._beatsPerBar = 4;
    this._totalBeats = 0;
    this._globalBeat = -1;
    this._onBeatCallback = null;

    // Wire the internal metronome callback once in the constructor.
    // The external callback (_onBeatCallback) is set via onBeat().
    this._metronome.onBeat = (_beatNumber) => {
      this._globalBeat++;
      if (this._onBeatCallback) {
        const { barIndex, beatIndex } = this.getCurrentBeat();
        this._onBeatCallback({ barIndex, beatIndex, globalBeat: this._globalBeat });
      }
    };
  }

  /**
   * Initializes the AudioContext. Must be called after a user gesture
   * (browser autoplay policy).
   */
  init() {
    this._metronome.init();
  }

  /**
   * Registers a callback that fires on every metronome beat.
   * @param {function({ barIndex: number, beatIndex: number, globalBeat: number }): void} callback
   */
  onBeat(callback) {
    this._onBeatCallback = callback;
  }

  /**
   * Starts playback from the beginning.
   * Lazily initialises the AudioContext on the first call (browser autoplay policy
   * requires this to happen inside a user-gesture handler).
   *
   * @param {number} bpm           - Beats per minute (40–240)
   * @param {number} beatsPerBar   - Beats per bar (time signature numerator)
   * @param {number} [totalBeats]  - Total beats in piece (for wrap-around). 0 = no wrap.
   */
  start(bpm, beatsPerBar, totalBeats = 0) {
    // Lazy AudioContext creation – safe to call multiple times (MetronomeLogic.init is idempotent).
    this._metronome.init();
    this._beatsPerBar = beatsPerBar || 4;
    this._totalBeats = totalBeats;
    this._globalBeat = -1;
    this._metronome.setBpm(bpm);
    this._metronome.setBeatsPerMeasure(beatsPerBar);
    this._metronome.start();
  }

  /**
   * Stops playback.
   */
  stop() {
    this._metronome.stop();
  }

  /**
   * Returns the current playback position as { barIndex, beatIndex }.
   * Both indices are 0-based.
   * If totalBeats is set, wraps around after the last beat.
   *
   * @returns {{ barIndex: number, beatIndex: number }}
   */
  getCurrentBeat() {
    const beat = Math.max(0, this._globalBeat);
    const effectiveBeat = this._totalBeats > 0
      ? beat % this._totalBeats
      : beat;
    const barIndex = Math.floor(effectiveBeat / this._beatsPerBar);
    const beatIndex = effectiveBeat % this._beatsPerBar;
    return { barIndex, beatIndex };
  }

  /**
   * Updates the BPM while playing. Takes effect on the next beat.
   * @param {number} bpm
   */
  setBpm(bpm) {
    this._metronome.setBpm(bpm);
  }

  /**
   * Whether the metronome is currently running.
   * @returns {boolean}
   */
  get isPlaying() {
    return this._metronome.isPlaying;
  }
}
