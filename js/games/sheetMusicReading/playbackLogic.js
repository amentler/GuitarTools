/**
 * playbackLogic.js
 * 
 * Manages the playback state for sheet music reading.
 * Maps metronome beats to bars and beats.
 */

export function createPlaybackState(options = {}) {
  const {
    beatsPerBar = 4,
    totalBars = 4,
    loop = false,
    endless = false
  } = options;

  let globalBeatIndex = -1;
  let isRunning = false;

  return {
    get globalBeatIndex() { return globalBeatIndex; },
    get isRunning() { return isRunning; },

    start() {
      isRunning = true;
      globalBeatIndex = -1;
    },

    stop() {
      isRunning = false;
    },

    /**
     * Advances the playhead by one beat.
     * Returns true if advanced, false if reached end.
     */
    nextBeat() {
      if (!isRunning) return false;

      globalBeatIndex++;

      const maxBeat = totalBars * beatsPerBar;
      if (!endless && globalBeatIndex >= maxBeat) {
        if (loop) {
          globalBeatIndex = 0;
          return true;
        }
        isRunning = false;
        return false;
      }

      return true;
    },

    /**
     * Returns current position as { barIndex, beatIndex }
     */
    getPosition() {
      if (globalBeatIndex < 0) return { barIndex: 0, beatIndex: 0 };
      
      const barIndex = Math.floor(globalBeatIndex / beatsPerBar);
      const beatIndex = globalBeatIndex % beatsPerBar;
      
      return { barIndex, beatIndex };
    },

    reset() {
      globalBeatIndex = -1;
      isRunning = false;
    }
  };
}

/**
 * Calculates the absolute X-offset for a beat, relative to the SVG canvas.
 * @param {Array<{ noteStartX: number, noteEndX: number }>} staveLayout
 * @param {number} barIndex
 * @param {number} beatIndex
 * @param {number} beatsPerBar
 * @returns {number|null}
 */
export function calcBeatX(staveLayout, barIndex, beatIndex, beatsPerBar) {
  if (!staveLayout || !staveLayout[barIndex]) return null;

  const { noteStartX } = staveLayout[barIndex];

  // Equalize the note area for all bars based on the minimum bar width.
  // This prevents the "jumping" effect between wide bar 0 and narrow bars 1-3.
  const uniformNoteArea = Math.min(...staveLayout.map(s => s.noteEndX - s.noteStartX));
  const step = uniformNoteArea / beatsPerBar;

  return noteStartX + beatIndex * step;
}

/**
 * Calculates the X-offset for the playhead within a bar.
 * @param {number} beatIndex - 0-based beat index in bar
 * @param {number} beatsPerBar - total beats in bar
 * @param {number} barWidth - width of the bar in pixels
 * @param {number} startPadding - padding at start of bar (clef, etc.)
 */
export function calculatePlayheadX(beatIndex, beatsPerBar, barWidth, startPadding = 0) {
  const availableWidth = barWidth - startPadding;
  const step = availableWidth / beatsPerBar;
  return startPadding + beatIndex * step;
}
