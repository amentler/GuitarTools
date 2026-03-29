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
 * Detects the fundamental frequency using the YIN algorithm.
 * More reliable than naive autocorrelation – correctly identifies the
 * fundamental even when overtones have higher energy.
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

  const minPeriod = Math.floor(sampleRate / 1400);
  const maxPeriod = Math.floor(sampleRate / 70);
  const halfN = Math.floor(buffer.length / 2);

  // Step 1: squared difference function
  // d[tau] = sum_i (x[i] - x[i+tau])^2
  const diff = new Float32Array(maxPeriod + 1);
  for (let tau = 1; tau <= maxPeriod; tau++) {
    let sum = 0;
    for (let i = 0; i < halfN; i++) {
      const delta = buffer[i] - buffer[i + tau];
      sum += delta * delta;
    }
    diff[tau] = sum;
  }

  // Step 2: cumulative mean normalized difference function
  // d'[0] = 1, d'[tau] = d[tau] / ((1/tau) * sum_{j=1}^{tau} d[j])
  const cmnd = new Float32Array(maxPeriod + 1);
  cmnd[0] = 1;
  let runningSum = 0;
  for (let tau = 1; tau <= maxPeriod; tau++) {
    runningSum += diff[tau];
    cmnd[tau] = runningSum === 0 ? 0 : (diff[tau] * tau) / runningSum;
  }

  // Step 3: find first tau >= minPeriod where cmnd dips below threshold,
  // then walk to the local minimum of that dip
  const THRESHOLD = 0.15;
  let bestTau = -1;

  for (let tau = minPeriod; tau <= maxPeriod - 1; tau++) {
    if (cmnd[tau] < THRESHOLD) {
      while (tau + 1 <= maxPeriod && cmnd[tau + 1] < cmnd[tau]) tau++;
      bestTau = tau;
      break;
    }
  }

  // Fallback: no dip below threshold – pick absolute minimum in range
  if (bestTau === -1) {
    let minVal = Infinity;
    for (let tau = minPeriod; tau <= maxPeriod; tau++) {
      if (cmnd[tau] < minVal) { minVal = cmnd[tau]; bestTau = tau; }
    }
    // Only accept if reasonably confident
    if (minVal > 0.5) return null;
  }

  // Step 4: parabolic interpolation for sub-sample accuracy
  if (bestTau > 1 && bestTau < maxPeriod) {
    const y1 = cmnd[bestTau - 1];
    const y2 = cmnd[bestTau];
    const y3 = cmnd[bestTau + 1];
    const denom = 2 * (2 * y2 - y1 - y3);
    if (denom !== 0) bestTau = bestTau + (y1 - y3) / denom;
  }

  return sampleRate / bestTau;
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
