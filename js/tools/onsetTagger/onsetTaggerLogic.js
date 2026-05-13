/**
 * onsetTaggerLogic.js
 *
 * Pure functions for the Onset Tagger tool.
 * No DOM, no audio — fully unit-testable.
 */

/**
 * Clamps value to [min, max].
 * @param {number} value
 * @param {number} min
 * @param {number} max
 * @returns {number}
 */
export function clamp(value, min, max) {
  if (value < min) return min;
  if (value > max) return max;
  return value;
}

/**
 * Computes min/max amplitude envelope for the range [startSec, endSec].
 * Returns empty arrays when range is zero or invalid.
 *
 * @param {Float32Array} samples
 * @param {number} sampleRate
 * @param {number} startSec
 * @param {number} endSec
 * @param {number} buckets  Number of bins to divide the range into
 * @returns {{ mins: Float32Array, maxs: Float32Array }}
 */
export function computeEnvelope(samples, sampleRate, startSec, endSec, buckets) {
  const rangeSec = endSec - startSec;
  if (rangeSec <= 0 || buckets <= 0) {
    return { mins: new Float32Array(0), maxs: new Float32Array(0) };
  }

  const startIdx = Math.max(0, Math.floor(startSec * sampleRate));
  const endIdx   = Math.min(samples.length, Math.ceil(endSec * sampleRate));
  const rangeLen = endIdx - startIdx;

  const mins = new Float32Array(buckets);
  const maxs = new Float32Array(buckets);

  for (let b = 0; b < buckets; b++) {
    const bStart = startIdx + Math.floor((b / buckets) * rangeLen);
    const bEnd   = startIdx + Math.floor(((b + 1) / buckets) * rangeLen);
    let mn = Infinity;
    let mx = -Infinity;
    for (let i = bStart; i < bEnd; i++) {
      const v = samples[i] ?? 0;
      if (v < mn) mn = v;
      if (v > mx) mx = v;
    }
    mins[b] = mn === Infinity  ? 0 : mn;
    maxs[b] = mx === -Infinity ? 0 : mx;
  }

  return { mins, maxs };
}

/**
 * Converts an absolute time (seconds) to a pixel x-coordinate within the
 * waveform plot, clamped to [0, plotWidth].
 *
 * @param {number} tSec       Absolute time in seconds
 * @param {number} rangeStart Start of the visible range (seconds)
 * @param {number} rangeEnd   End of the visible range (seconds)
 * @param {number} plotWidth  Total pixel width of the plot
 * @returns {number}
 */
export function timeToPixel(tSec, rangeStart, rangeEnd, plotWidth) {
  const range = rangeEnd - rangeStart;
  if (range <= 0) return 0;
  const fraction = (tSec - rangeStart) / range;
  return clamp(fraction * plotWidth, 0, plotWidth);
}

/**
 * Adds an onset timestamp (ms) to the list, keeping it sorted ascending.
 * Exact duplicates are ignored.
 *
 * @param {number[]} onsets   Existing onset list
 * @param {number} newOnsetMs New onset in milliseconds
 * @returns {number[]} New sorted list
 */
export function addOnset(onsets, newOnsetMs) {
  if (onsets.includes(newOnsetMs)) return onsets.slice();
  const next = onsets.slice();
  next.push(newOnsetMs);
  next.sort((a, b) => a - b);
  return next;
}

/**
 * Removes the onset at the given index.
 * Returns the unchanged list for out-of-bounds or negative indices.
 *
 * @param {number[]} onsets
 * @param {number} index
 * @returns {number[]}
 */
export function removeOnset(onsets, index) {
  if (index < 0 || index >= onsets.length) return onsets.slice();
  const next = onsets.slice();
  next.splice(index, 1);
  return next;
}

/**
 * Builds the final sidecar object from form values + onset list.
 * Overwrites any existing onsetsMs field.
 *
 * @param {object} formValues  Parsed sidecar fields (excluding onsetsMs)
 * @param {number[]} onsetsMs  Confirmed onsets in milliseconds
 * @returns {object}
 */
export function buildSidecarWithOnsets(formValues, onsetsMs) {
  return { ...formValues, onsetsMs };
}

/**
 * Computes the current playhead position in seconds, accounting for elapsed
 * real time, playback rate, and loop boundaries.
 *
 * @param {number} startTime       AudioContext.currentTime when playback began
 * @param {number} ctxCurrentTime  AudioContext.currentTime now
 * @param {number} playbackRate    Playback speed (0.25..1.0)
 * @param {number} rangeStart      Loop start (seconds)
 * @param {number} rangeEnd        Loop end (seconds)
 * @param {number} initialOffset   Buffer position when playback started (seconds)
 * @returns {number} Current playhead position (seconds, within [rangeStart, rangeEnd])
 */
export function computePlayheadPosition(startTime, ctxCurrentTime, playbackRate, rangeStart, rangeEnd, initialOffset) {
  const loopLen = rangeEnd - rangeStart;
  if (loopLen <= 0) return rangeStart;

  const elapsed = (ctxCurrentTime - startTime) * playbackRate;
  const offsetWithinLoop = initialOffset - rangeStart;
  const pos = (offsetWithinLoop + elapsed) % loopLen;
  return rangeStart + (pos < 0 ? pos + loopLen : pos);
}
