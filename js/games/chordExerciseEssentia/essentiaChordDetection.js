/**
 * essentiaChordDetection.js
 * Microphone audio pipeline for HPCP-based chord detection.
 *
 * Pipeline:
 *   mic channel 1 → AnalyserNode.getFloatFrequencyData (Web Audio FFT)
 *   → peak-normalized spectrum → inline peak detection
 *   → essentia.HPCP (WASM, when available) or computeHpcpPureJS (fallback)
 *   → average over ANALYSIS_FRAMES → matchHpcpToChord
 *
 * The pure-JS fallback is used automatically when the essentia WASM fails to
 * compile (e.g. iOS < 16.4 lacks WebAssembly SIMD support). The two code paths
 * share the same templates and matching logic so results are comparable.
 */

import { getEssentia } from './essentiaLoader.js';
import {
  buildChordTemplates,
  matchHpcpToChord,
  averageHpcps,
  computeHpcpPureJS,
} from './essentiaChordLogic.js';

// ── Constants ─────────────────────────────────────────────────────────────────

const FFT_SIZE          = 4096;   // ~93 ms frame at 44100 Hz
const ATTACK_SETTLE_MS  = 150;    // wait after strum onset
const LISTEN_TIMEOUT_MS = 8000;   // give up after 8 s of silence
const ANALYSIS_FRAMES   = 6;      // frames to average after strum
const FRAME_INTERVAL_MS = 80;     // interval between analysis frames
const RMS_SPIKE_FACTOR  = 3;      // strum threshold = N × noise floor
const GUITAR_MIN_RMS    = 0.008;  // minimum RMS to consider as input
const PEAK_NOISE_FLOOR  = -80;    // dBFS: bins quieter than this are ignored

// referenceFrequency for HPCP: C4 = 261.626 Hz so bin 0 = C, matching
// NOTE_TO_BIN in essentiaChordLogic.js. Using 440 Hz (A4) would shift all bins
// by +9, making C land on bin 3 and breaking template matching entirely.
const HPCP_REFERENCE_HZ = 261.626;
const MIN_NORMALIZED_PEAK_MAG = 1e-9;
const NORMALIZED_SPECTRUM_PEAK_DB = 0;

// ── Chord templates (built once at module load) ───────────────────────────────

const CHORD_TEMPLATES = buildChordTemplates();

// ── Module-level audio state ──────────────────────────────────────────────────

let audioCtx = null;
let analyser = null;
let stream   = null;
let sourceNode = null;
let channelSplitter = null;
let essentiaHpcpAvailable = true;

// ── Internal helpers ──────────────────────────────────────────────────────────

async function ensureMic() {
  if (audioCtx && analyser && stream) return;
  _tearDown();
  stream   = await navigator.mediaDevices.getUserMedia({
    audio: { channelCount: { ideal: 1 } },
    video: false,
  });
  audioCtx = new AudioContext();
  if (audioCtx.state === 'suspended') {
    await audioCtx.resume();
  }
  analyser = audioCtx.createAnalyser();
  analyser.fftSize = FFT_SIZE;
  sourceNode = audioCtx.createMediaStreamSource(stream);

  // Match WAV fixtures: use one mono source channel instead of averaging stereo.
  // Fallback keeps older browser/test mocks working when ChannelSplitterNode is absent.
  if (typeof audioCtx.createChannelSplitter === 'function') {
    channelSplitter = audioCtx.createChannelSplitter(2);
    sourceNode.connect(channelSplitter);
    channelSplitter.connect(analyser, 0, 0);
  } else {
    sourceNode.connect(analyser);
  }
}

function _tearDown() {
  if (stream)   { stream.getTracks().forEach(t => t.stop()); stream = null; }
  sourceNode = null;
  channelSplitter = null;
  if (audioCtx) { audioCtx.close().catch(() => {}); audioCtx = null; analyser = null; }
}

function computeRms(buf) {
  let sum = 0;
  for (const v of buf) sum += v * v;
  return Math.sqrt(sum / buf.length);
}

/**
 * Pure function: detects spectral peaks from a dBFS frequency buffer.
 * freqData has length = frequencyBinCount = fftSize / 2.
 * Exported so tests can run the same logic on WAV-derived spectra.
 *
 * @param {Float32Array} freqData - dBFS values (output of getFloatFrequencyData or equivalent)
 * @param {number} sampleRate
 * @returns {{ peakFreqs: number[], peakMags: number[] }}
 */
export function detectEssentiaPeaks(freqData, sampleRate) {
  const fftSize  = freqData.length * 2; // frequencyBinCount = fftSize / 2
  const binWidth = sampleRate / fftSize;
  const minBin   = Math.max(1, Math.floor(40 / binWidth));
  const maxBin   = Math.min(freqData.length - 2, Math.ceil(5000 / binWidth));

  const peakFreqs = [];
  const peakMags  = [];

  for (let i = minBin; i <= maxBin; i++) {
    const db = freqData[i];
    if (db > freqData[i - 1] && db > freqData[i + 1] && db > PEAK_NOISE_FLOOR) {
      peakFreqs.push(i * binWidth);
      peakMags.push(Math.pow(10, db / 20)); // dBFS → linear magnitude
    }
  }

  return { peakFreqs, peakMags };
}

export function normalizePeakMagnitudes(peakMags) {
  if (!peakMags.length) return [];
  const maxMagnitude = Math.max(...peakMags);
  if (maxMagnitude <= MIN_NORMALIZED_PEAK_MAG) return peakMags.map(() => 0);
  return peakMags.map(magnitude => magnitude / maxMagnitude);
}

/** Thin wrapper: reads AnalyserNode state and calls the pure detectEssentiaPeaks. */
function detectPeaks(analyserNode, sampleRate) {
  const freqData = new Float32Array(analyserNode.frequencyBinCount);
  analyserNode.getFloatFrequencyData(freqData);
  return detectEssentiaPeaks(normalizeFrequencyDataToPeak(freqData), sampleRate);
}

export function normalizeFrequencyDataToPeak(freqData) {
  let maxDb = -Infinity;
  for (const value of freqData) {
    if (Number.isFinite(value) && value > maxDb) maxDb = value;
  }
  if (!Number.isFinite(maxDb)) return new Float32Array(freqData);

  const offset = NORMALIZED_SPECTRUM_PEAK_DB - maxDb;
  const normalized = new Float32Array(freqData.length);
  for (let i = 0; i < freqData.length; i++) {
    normalized[i] = Number.isFinite(freqData[i]) ? freqData[i] + offset : freqData[i];
  }
  return normalized;
}

/**
 * Computes HPCP using the essentia WASM module.
 * Must only be called when essentia is available.
 */
function computeHpcpEssentia(essentia, peakFreqs, peakMags, sampleRate) {
  if (!peakFreqs.length) return new Float32Array(12);
  if (typeof essentia?.arrayToVector !== 'function' || typeof essentia?.vectorToArray !== 'function') {
    throw new TypeError('EssentiaJS HPCP helpers are not available on this instance');
  }

  const freqVec = essentia.arrayToVector(new Float32Array(peakFreqs));
  const magVec  = essentia.arrayToVector(new Float32Array(peakMags));

  const { hpcp } = essentia.HPCP(
    freqVec, magVec,
    true,              // bandPreset
    500,               // bandSplitFrequency
    0,                 // harmonics
    5000,              // maxFrequency
    false,             // maxShifted
    40,                // minFrequency
    false,             // nonLinear
    'unitMax',         // normalized
    HPCP_REFERENCE_HZ, // referenceFrequency — C4, not A4
    sampleRate,
    12,                // size
    'squaredCosine',   // weightType
    1,                 // windowSize
  );
  freqVec.delete();
  magVec.delete();

  const result = new Float32Array(essentia.vectorToArray(hpcp));
  hpcp.delete();
  return result;
}

function computePureJsHpcp(peakFreqs, peakMags) {
  return computeHpcpPureJS(peakFreqs, peakMags, HPCP_REFERENCE_HZ);
}

/**
 * Computes a 12-bin HPCP vector from the current AnalyserNode state.
 * Uses essentia WASM when available, otherwise falls back to pure-JS.
 */
function computeHpcp(essentia, analyserNode, sampleRate) {
  const { peakFreqs, peakMags } = detectPeaks(analyserNode, sampleRate);
  const normalizedPeakMags = normalizePeakMagnitudes(peakMags);
  const pureJsHpcp = computePureJsHpcp(peakFreqs, normalizedPeakMags);

  if (essentia && essentiaHpcpAvailable) {
    try {
      return {
        hpcp: computeHpcpEssentia(essentia, peakFreqs, normalizedPeakMags, sampleRate),
        pureJsHpcp,
      };
    } catch {
      essentiaHpcpAvailable = false;
    }
  }
  return {
    hpcp: pureJsHpcp,
    pureJsHpcp,
  };
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Listens for a guitar strum, computes HPCP over several frames, and
 * matches the result against the target chord.
 *
 * When the essentia WASM is unavailable (e.g. iOS < 16.4 lacks SIMD support),
 * the function falls back to a pure-JS HPCP implementation so the exercise
 * still works — the result includes `wasm: false` in that case.
 *
 * @param {string} chordName - e.g. 'C-Dur'
 * @returns {Promise<{ isCorrect, confidence, bestMatch, timedOut?, essentiaError?, wasm? }>}
 */
export async function detectChordEssentia(chordName) {
  let essentia = null;
  essentiaHpcpAvailable = true;

  try {
    [essentia] = await Promise.all([getEssentia(), ensureMic()]);
  } catch {
    // Essentia WASM unavailable (SIMD / memory / network failure).
    // Attempt mic-only with pure-JS HPCP as fallback.
    try {
      await ensureMic();
    } catch {
      return { isCorrect: false, confidence: 0, bestMatch: null, essentiaError: true };
    }
    // essentia stays null → computeHpcp uses pure-JS path
  }

  const rmsThreshold = RMS_SPIKE_FACTOR * GUITAR_MIN_RMS;
  const sampleRate   = audioCtx?.sampleRate ?? 44100;

  return new Promise(resolve => {
    let strumDetected = false;
    let pollId = null;
    let timeoutId = null;

    function cleanup() {
      clearInterval(pollId);
      clearTimeout(timeoutId);
    }
    function resolveWith(r) {
      cleanup();
      resolve(r);
    }

    timeoutId = setTimeout(() => {
      if (!strumDetected)
        resolveWith({ isCorrect: false, confidence: 0, bestMatch: null, timedOut: true });
    }, LISTEN_TIMEOUT_MS);

    pollId = setInterval(() => {
      if (!analyser || strumDetected) return;
      const buf = new Float32Array(FFT_SIZE);
      analyser.getFloatTimeDomainData(buf);
      if (computeRms(buf) > rmsThreshold) {
        strumDetected = true;
        clearInterval(pollId);
        setTimeout(() => collectAndResolve(), ATTACK_SETTLE_MS);
      }
    }, 50);

    async function collectAndResolve() {
      if (!analyser) { resolveWith({ isCorrect: false, confidence: 0, bestMatch: null }); return; }

      const hpcps = [];
      const pureJsHpcps = [];
      for (let i = 0; i < ANALYSIS_FRAMES; i++) {
        if (i > 0) await new Promise(r => setTimeout(r, FRAME_INTERVAL_MS));
        if (!analyser) break;
        try {
          const frameResult = computeHpcp(essentia, analyser, sampleRate);
          hpcps.push(frameResult.hpcp);
          pureJsHpcps.push(frameResult.pureJsHpcp);
        } catch {
          // single frame failure is non-fatal
        }
      }

      clearTimeout(timeoutId);
      if (!hpcps.length) { resolve({ isCorrect: false, confidence: 0, bestMatch: null }); return; }

      const avgHpcp = averageHpcps(hpcps);
      const avgPureJsHpcp = averageHpcps(pureJsHpcps);
      const result = matchHpcpToChord(avgHpcp, chordName, CHORD_TEMPLATES);
      const pureJsResult = matchHpcpToChord(avgPureJsHpcp, chordName, CHORD_TEMPLATES);
      const usingWasmNow = essentia !== null && essentiaHpcpAvailable;

      // The Pure-JS HPCP path is covered by frozen regression fixtures.
      // When WASM disagrees with that baseline, prefer the stricter outcome
      // to avoid silence/noise false positives in the live browser path.
      if (usingWasmNow && result.isCorrect && !pureJsResult.isCorrect) {
        resolve({
          ...pureJsResult,
          wasm: true,
        });
        return;
      }

      resolve({
        ...result,
        wasm: usingWasmNow,
      });
    }
  });
}

/** Tears down microphone and AudioContext. Safe to call multiple times. */
export function stopListeningEssentia() {
  _tearDown();
}
