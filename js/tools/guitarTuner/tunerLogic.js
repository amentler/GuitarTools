// Pure pitch detection and note calculation utilities – no DOM

export const STANDARD_TUNING = [
  { note: 'E', octave: 2 },
  { note: 'A', octave: 2 },
  { note: 'D', octave: 3 },
  { note: 'G', octave: 3 },
  { note: 'B', octave: 3 },
  { note: 'E', octave: 4 },
];

const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

/**
 * Detects the fundamental frequency in a PCM buffer via autocorrelation.
 * @param {Float32Array} buffer
 * @param {number} sampleRate
 * @returns {number|null} Hz, or null if silence / no clear pitch
 */
export function detectPitch(buffer, sampleRate) {
  // Silence check
  let rms = 0;
  for (let i = 0; i < buffer.length; i++) rms += buffer[i] * buffer[i];
  rms = Math.sqrt(rms / buffer.length);
  if (rms < 0.01) return null;

  const minPeriod = Math.floor(sampleRate / 1400); // ~70 Hz lower bound
  const maxPeriod = Math.floor(sampleRate / 70);   // ~1400 Hz upper bound
  const n = buffer.length;

  // Autocorrelation
  let bestTau = -1;
  let bestVal = -Infinity;

  for (let tau = minPeriod; tau <= maxPeriod; tau++) {
    let sum = 0;
    for (let i = 0; i < n - tau; i++) {
      sum += buffer[i] * buffer[i + tau];
    }
    if (sum > bestVal) {
      bestVal = sum;
      bestTau = tau;
    }
  }

  if (bestTau === -1) return null;

  // Parabolic interpolation for sub-sample accuracy
  const y1 = bestTau > minPeriod ? autocorr(buffer, bestTau - 1) : bestVal;
  const y2 = bestVal;
  const y3 = bestTau < maxPeriod ? autocorr(buffer, bestTau + 1) : bestVal;
  const denom = 2 * (2 * y2 - y1 - y3);
  const refinedTau = denom !== 0
    ? bestTau + (y1 - y3) / denom
    : bestTau;

  return sampleRate / refinedTau;
}

function autocorr(buffer, tau) {
  let sum = 0;
  const n = buffer.length;
  for (let i = 0; i < n - tau; i++) sum += buffer[i] * buffer[i + tau];
  return sum;
}

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
 * Returns true if the given note/octave is one of the standard guitar open strings.
 * @param {string} note
 * @param {number} octave
 * @returns {boolean}
 */
export function isStandardTuningNote(note, octave) {
  return STANDARD_TUNING.some(s => s.note === note && s.octave === octave);
}

// ── Rolling median ────────────────────────────────────────────────────────────

const HISTORY_SIZE = 5;

/**
 * Appends freq to history (capped at HISTORY_SIZE) and returns the median.
 * Mutates the passed array in place.
 * @param {number[]} history  mutable buffer (pass the module-level array)
 * @param {number}   freq
 * @returns {number} median frequency
 */
export function pushAndMedian(history, freq) {
  history.push(freq);
  if (history.length > HISTORY_SIZE) history.shift();
  const sorted = history.slice().sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 !== 0
    ? sorted[mid]
    : (sorted[mid - 1] + sorted[mid]) / 2;
}
