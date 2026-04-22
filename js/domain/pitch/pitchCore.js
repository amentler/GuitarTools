export const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

/**
 * Converts a frequency to the nearest note, octave, and cents offset.
 * @param {number} freq Hz
 * @returns {{ note: string, octave: number, cents: number }}
 */
export function frequencyToNote(freq) {
  const midiNum = 12 * Math.log2(freq / 440) + 69;
  const midiRounded = Math.round(midiNum);
  const noteIndex = ((midiRounded % 12) + 12) % 12;
  const octave = Math.floor(midiRounded / 12) - 1;
  const cents = (midiNum - midiRounded) * 100;
  return { note: NOTE_NAMES[noteIndex], octave, cents };
}

/**
 * Converts a note name and octave to frequency in Hz.
 * @param {string} note
 * @param {number} octave
 * @returns {number}
 */
export function noteToFrequency(note, octave) {
  const idx = NOTE_NAMES.indexOf(note);
  const midi = (octave + 1) * 12 + idx;
  return 440 * Math.pow(2, (midi - 69) / 12);
}
