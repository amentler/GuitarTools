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
 * Keeps a visible range inside the recording while preserving a tiny non-zero
 * window for waveform rendering and loop playback.
 *
 * @param {number} startSec
 * @param {number} endSec
 * @param {number} durationSec
 * @param {'start'|'end'|'both'} changedEdge
 * @param {number} minWindowSec
 * @returns {{ start: number, end: number }}
 */
export function constrainVisibleRange(startSec, endSec, durationSec, changedEdge = 'both', minWindowSec = 0.01) {
  const duration = Math.max(0, durationSec);
  if (duration <= 0) return { start: 0, end: 0 };
  const minWindow = clamp(minWindowSec, Math.min(0.001, duration), duration);
  let start = clamp(Number.isFinite(startSec) ? startSec : 0, 0, duration);
  let end = clamp(Number.isFinite(endSec) ? endSec : duration, 0, duration);

  if (end - start >= minWindow) {
    return { start, end };
  }

  if (changedEdge === 'start') {
    if (end - minWindow >= 0) {
      start = end - minWindow;
    } else {
      start = 0;
      end = minWindow;
    }
  } else if (changedEdge === 'end') {
    if (start + minWindow <= duration) {
      end = start + minWindow;
    } else {
      end = duration;
      start = duration - minWindow;
    }
  } else {
    const center = clamp((start + end) / 2, minWindow / 2, duration - minWindow / 2);
    start = center - minWindow / 2;
    end = center + minWindow / 2;
  }

  return { start, end };
}

/**
 * Computes dynamic slider bounds for the Onset Tagger's independent zoom
 * handles.
 *
 * @param {number} startSec
 * @param {number} endSec
 * @param {number} durationSec
 * @returns {{ start: { min: number, max: number, value: number }, end: { min: number, max: number, value: number } }}
 */
export function computeRangeSliderState(startSec, endSec, durationSec) {
  const duration = Math.max(0, durationSec);
  const start = clamp(Number.isFinite(startSec) ? startSec : 0, 0, duration);
  const end = clamp(Number.isFinite(endSec) ? endSec : duration, start, duration);
  return {
    start: { min: 0, max: end, value: start },
    end: { min: start, max: duration, value: end },
  };
}

/**
 * Zooms or unzooms a range by moving each edge by a fraction of the current
 * visible distance.
 *
 * @param {number} startSec
 * @param {number} endSec
 * @param {number} durationSec
 * @param {'in'|'out'} direction
 * @param {number} stepFraction
 * @param {number} minWindowSec
 * @returns {{ start: number, end: number }}
 */
export function computeSteppedZoomRange(
  startSec,
  endSec,
  durationSec,
  direction,
  stepFraction = 0.1,
  minWindowSec = 0.01,
) {
  const current = constrainVisibleRange(startSec, endSec, durationSec, 'both', minWindowSec);
  const distance = current.end - current.start;
  const step = distance * Math.max(0, stepFraction);
  const nextStart = direction === 'out' ? current.start - step : current.start + step;
  const nextEnd = direction === 'out' ? current.end + step : current.end - step;
  return constrainVisibleRange(nextStart, nextEnd, durationSec, 'both', minWindowSec);
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
 * Adds an onset timestamp and returns the sorted list plus the new index.
 * Exact duplicates select the existing onset.
 *
 * @param {number[]} onsets
 * @param {number} newOnsetMs
 * @returns {{ onsetsMs: number[], index: number }}
 */
export function addOnsetWithIndex(onsets, newOnsetMs) {
  const existingIndex = onsets.indexOf(newOnsetMs);
  if (existingIndex !== -1) return { onsetsMs: onsets.slice(), index: existingIndex };
  const onsetsMs = addOnset(onsets, newOnsetMs);
  return { onsetsMs, index: onsetsMs.indexOf(newOnsetMs) };
}

/**
 * Moves an onset to a new timestamp, keeping the list sorted.
 *
 * @param {number[]} onsets
 * @param {number} index
 * @param {number} nextOnsetMs
 * @returns {{ onsetsMs: number[], index: number }}
 */
export function moveOnset(onsets, index, nextOnsetMs) {
  if (index < 0 || index >= onsets.length) return { onsetsMs: onsets.slice(), index: -1 };
  const next = onsets.slice();
  next.splice(index, 1);
  next.push(nextOnsetMs);
  next.sort((a, b) => a - b);
  return { onsetsMs: next, index: next.indexOf(nextOnsetMs) };
}

/**
 * Merges candidate onsets into an existing list when they are far enough away
 * from all accepted onsets.
 *
 * @param {number[]} existingMs
 * @param {number[]} incomingMs
 * @param {number} minDistanceMs
 * @returns {{ onsetsMs: number[], added: number, skipped: number }}
 */
export function mergeOnsetsWithMinDistance(existingMs, incomingMs, minDistanceMs) {
  const accepted = existingMs.slice().sort((a, b) => a - b);
  let added = 0;
  let skipped = 0;
  const sortedIncoming = incomingMs
    .filter(ms => Number.isFinite(ms))
    .map(ms => Math.round(ms))
    .sort((a, b) => a - b);

  for (const ms of sortedIncoming) {
    const tooClose = accepted.some(existing => Math.abs(existing - ms) < minDistanceMs);
    if (tooClose) {
      skipped++;
      continue;
    }
    accepted.push(ms);
    accepted.sort((a, b) => a - b);
    added++;
  }

  return { onsetsMs: accepted, added, skipped };
}

/**
 * Computes a visible range around a selected timestamp.
 *
 * @param {number} centerSec
 * @param {number} durationSec
 * @param {number} preferredWindowSec
 * @returns {{ start: number, end: number }}
 */
export function computeFocusedRange(centerSec, durationSec, preferredWindowSec = 1) {
  const duration = Math.max(0, durationSec);
  if (duration <= 0) return { start: 0, end: 0 };
  const windowSec = clamp(preferredWindowSec, Math.min(0.01, duration), duration);
  const half = windowSec / 2;
  let start = clamp(centerSec - half, 0, Math.max(0, duration - windowSec));
  let end = start + windowSec;
  if (end > duration) {
    end = duration;
    start = Math.max(0, end - windowSec);
  }
  return { start, end };
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
 * Generates a stable 12-character alphanumeric unique recording id.
 * @returns {string}
 */
export function generateRecordingUid() {
  return Math.random().toString(36).slice(2, 8) + Math.random().toString(36).slice(2, 8);
}

/**
 * Extracts the last 5 alphanumeric characters of an id as a stable random suffix
 * that can be used in auto-generated baseNames.
 * @param {string} id
 * @returns {string}
 */
export function extractRandomSuffix(id) {
  const clean = String(id ?? '').replace(/[^a-z0-9]/gi, '');
  return clean.slice(-5) || Math.random().toString(36).slice(2, 7);
}

/**
 * Builds an auto-generated baseName from recording metadata.
 * Format: [role_]category_bpmBPM_suffix
 * The trainingRole token is omitted when it equals 'random'.
 *
 * @param {{ trainingRole?: string, category?: string, bpm?: string|number }} meta
 * @param {string} suffix  Random suffix (stable per recording)
 * @returns {string}
 */
export function buildGeneratedBaseName({ trainingRole, category, bpm } = {}, suffix = '') {
  const role = (!trainingRole || trainingRole === 'random') ? null : trainingRole;
  const cat  = category || 'unknown';
  const bpmStr = bpm ? `${bpm}bpm` : '0bpm';
  const parts = role ? [role, cat, bpmStr] : [cat, bpmStr];
  return normalizeRecordingBaseName([...parts, suffix || 'x'].join('_'));
}

/**
 * Normalizes an old sidecar format to the current format:
 * - Migrates tempoBpm → bpm (if bpm is missing)
 * - Removes the tempoBpm field
 * - Generates a stable id if none is present
 *
 * Does NOT update updatedAt — that happens on explicit save.
 *
 * @param {object} sidecar
 * @returns {object}
 */
export function normalizeSidecarFormat(sidecar) {
  const s = { ...sidecar };
  if (!s.bpm && s.tempoBpm) s.bpm = s.tempoBpm;
  delete s.tempoBpm;
  if (!s.id) s.id = generateRecordingUid();
  return s;
}

/**
 * Builds the final sidecar object from form values + onset list.
 * Overwrites any existing onsetsMs field.
 * Preserves stable fields (id, recordedAt) from meta if provided.
 * Always writes a fresh updatedAt timestamp.
 *
 * @param {object} formValues  Parsed sidecar fields (excluding onsetsMs)
 * @param {number[]} onsetsMs  Confirmed onsets in milliseconds
 * @param {{ id?: string, baseName?: string }} [meta]  Stable identity fields
 * @returns {object}
 */
export function buildSidecarWithOnsets(formValues, onsetsMs, meta = {}) {
  const result = { ...formValues, onsetsMs, updatedAt: new Date().toISOString() };
  if (meta.id)       result.id       = meta.id;
  if (meta.baseName) result.baseName = meta.baseName;
  return result;
}

export function normalizeRecordingBaseName(input, fallback = 'recording') {
  const raw = String(input ?? '').trim()
    .replace(/\.(wav|json|zip)$/i, '')
    .replace(/[\\/]+/g, '_')
    .replace(/\s+/g, '_')
    .replace(/[^a-zA-Z0-9._-]/g, '_')
    .replace(/_+/g, '_')
    .replace(/^[._-]+|[._-]+$/g, '');
  if (raw) return raw;
  const fallbackName = String(fallback ?? '').trim().replace(/\.(wav|json|zip)$/i, '');
  return fallbackName || 'recording';
}

const TRAINING_ROLE_TOKENS = ['train', 'validation'];

/**
 * Inserts, replaces, or removes a training-role token in a baseName.
 * The token is placed before the last underscore-separated segment
 * (which is typically the random suffix).
 *
 * @param {string} baseName     Current baseName, e.g. "notenlesen_4_4_120bpm_abc12"
 * @param {string} trainingRole One of "train" | "validation" | "random" | ""
 * @returns {string}            Updated baseName
 */
export function applyTrainingRoleToBaseName(baseName, trainingRole) {
  const parts = String(baseName ?? '').split('_').filter(Boolean);
  const withoutRole = parts.filter(p => !TRAINING_ROLE_TOKENS.includes(p));
  if (!trainingRole || trainingRole === 'random') return withoutRole.join('_') || baseName;
  if (withoutRole.length >= 2) {
    withoutRole.splice(withoutRole.length - 1, 0, trainingRole);
  } else {
    withoutRole.push(trainingRole);
  }
  return withoutRole.join('_');
}


export function resolveRecordingFileBaseName(source, id, entry = {}) {
  if (source === 'sheet-music') {
    return entry.baseName ?? entry.id ?? id ?? 'notenlesen';
  }
  if (source === 'chord-recorder') {
    return entry.baseName ?? id ?? 'recording';
  }
  return entry.baseName ?? entry.id ?? id ?? 'recording';
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

/**
 * Computes BPM from a list of onset timestamps (ms) by extrapolating the
 * average interval between first and last onset over the total beat count.
 *
 * @param {number[]} onsetsMs  Array of onset timestamps in milliseconds
 * @returns {number|null}      Rounded BPM value, or null if fewer than 2 onsets
 */
export function computeAutoBpm(onsetsMs) {
  const sorted = onsetsMs
    .filter(ms => Number.isFinite(ms))
    .slice()
    .sort((a, b) => a - b);
  if (sorted.length < 2) return null;
  const spanMs = sorted[sorted.length - 1] - sorted[0];
  if (spanMs <= 0) return null;
  const beatCount = sorted.length - 1;
  return Math.round((beatCount / spanMs) * 60000);
}
