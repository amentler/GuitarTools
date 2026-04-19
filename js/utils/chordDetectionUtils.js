/**
 * chordDetectionUtils.js
 * Shared utility functions for chord detection across different exercises.
 */

import { CHORDS } from '../data/akkordData.js';
import { frequencyToNote, NOTE_NAMES } from '../tools/guitarTuner/pitchLogic.js';

// Open string MIDI numbers for strings 1–6 (index 0 = string 1 = high e = E4).
const OPEN_STRING_MIDI = [64, 59, 55, 50, 45, 40];

/**
 * Converts a MIDI note number to { note, octave }.
 */
function midiToNote(midi) {
  const noteIndex = ((midi % 12) + 12) % 12;
  const octave = Math.floor(midi / 12) - 1;
  return { note: NOTE_NAMES[noteIndex], octave };
}

/**
 * Returns the sounding notes for the given chord name.
 * Muted strings are excluded; open strings (fret 0) are included.
 */
export function getChordNotes(chordName) {
  const positions = CHORDS[chordName];
  if (!positions) return [];

  return positions
    .filter(pos => !pos.muted)
    .map(pos => {
      const stringIndex = pos.string - 1;
      const openMidi = OPEN_STRING_MIDI[stringIndex];
      const midi = openMidi + pos.fret;
      const { note, octave } = midiToNote(midi);
      return { note, octave, string: pos.string, fret: pos.fret };
    });
}

/**
 * Detects spectral peaks in a frequency-domain buffer.
 */
export function detectPeaksFromSpectrum(freqData, sampleRate, minFreqHz, maxFreqHz, minDbThreshold) {
  const peaks = [];
  const numBins = freqData.length;

  if (numBins < 3) return peaks;

  for (let i = 1; i < numBins - 1; i++) {
    const freq = (i * sampleRate) / (numBins * 2);

    if (freq < minFreqHz) continue;
    if (freq > maxFreqHz) break;

    const val = freqData[i];
    if (
      val > minDbThreshold &&
      val > freqData[i - 1] &&
      val > freqData[i + 1]
    ) {
      peaks.push(freq);
    }
  }

  return peaks;
}

/**
 * Converts an array of frequency peaks to detected note objects.
 */
export function identifyNotesFromPeaks(freqPeaks) {
  return freqPeaks
    .filter(freq => freq > 0)
    .map(freq => {
      const result = frequencyToNote(freq);
      return { ...result, frequency: freq };
    });
}
