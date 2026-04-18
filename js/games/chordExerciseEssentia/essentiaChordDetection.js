/**
 * essentiaChordDetection.js
 * Microphone audio pipeline for HPCP-based chord detection.
 *
 * Pipeline:
 *   mic → AnalyserNode → getFloatFrequencyData (Web Audio FFT)
 *   → inline peak detection → essentia.HPCP
 *   → average over ANALYSIS_FRAMES → matchHpcpToChord
 *
 * The Web Audio AnalyserNode handles windowing + FFT natively (no WASM calls
 * for those steps), so only essentia.HPCP() runs in WASM. This is simpler,
 * faster on mobile, and avoids potential frameSize mismatches in Windowing.
 */

import { getEssentia } from './essentiaLoader.js';
import { buildChordTemplates, matchHpcpToChord, averageHpcps } from './essentiaChordLogic.js';

// ── Constants ─────────────────────────────────────────────────────────────────

const FFT_SIZE           = 4096;   // ~93 ms frame at 44100 Hz
const ATTACK_SETTLE_MS   = 150;    // wait after strum onset
const LISTEN_TIMEOUT_MS  = 8000;   // give up after 8 s of silence
const ANALYSIS_FRAMES    = 6;      // frames to average after strum
const FRAME_INTERVAL_MS  = 80;     // interval between analysis frames
const RMS_SPIKE_FACTOR   = 3;      // strum threshold = N × noise floor
const GUITAR_MIN_RMS     = 0.008;  // minimum RMS to consider as input
const PEAK_NOISE_FLOOR   = -80;    // dBFS: bins quieter than this are ignored

// ── Chord templates (built once at module load) ───────────────────────────────

const CHORD_TEMPLATES = buildChordTemplates();

// ── Module-level audio state ──────────────────────────────────────────────────

let audioCtx = null;
let analyser = null;
let stream   = null;

// ── Internal helpers ──────────────────────────────────────────────────────────

async function ensureMic() {
  if (audioCtx && analyser && stream) return;
  _tearDown();
  stream   = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
  audioCtx = new AudioContext();
  analyser = audioCtx.createAnalyser();
  analyser.fftSize = FFT_SIZE;
  audioCtx.createMediaStreamSource(stream).connect(analyser);
}

function _tearDown() {
  if (stream)   { stream.getTracks().forEach(t => t.stop()); stream = null; }
  if (audioCtx) { audioCtx.close().catch(() => {}); audioCtx = null; analyser = null; }
}

function computeRms(buf) {
  let sum = 0;
  for (const v of buf) sum += v * v;
  return Math.sqrt(sum / buf.length);
}

/**
 * Computes a 12-bin HPCP vector from the AnalyserNode's current frequency data.
 *
 * The Web Audio AnalyserNode performs windowing + FFT natively. We read dBFS
 * magnitudes, detect local-maximum peaks in the guitar range (40–5000 Hz), and
 * pass them to essentia.HPCP() which maps them onto 12 pitch-class bins.
 *
 * @param {InstanceType<window.Essentia>} essentia
 * @param {AnalyserNode} analyserNode
 * @param {number} sampleRate
 * @returns {Float32Array} 12-element HPCP vector (values in [0, 1])
 */
function computeHpcp(essentia, analyserNode, sampleRate) {
  const fftSize  = analyserNode.fftSize;
  const freqData = new Float32Array(analyserNode.frequencyBinCount); // fftSize / 2
  analyserNode.getFloatFrequencyData(freqData);

  const binWidth = sampleRate / fftSize;
  const minBin   = Math.max(1, Math.floor(40 / binWidth));
  const maxBin   = Math.min(freqData.length - 2, Math.ceil(5000 / binWidth));

  const peakFreqs = [];
  const peakMags  = [];

  for (let i = minBin; i <= maxBin; i++) {
    const db = freqData[i];
    // local maximum above noise floor
    if (db > freqData[i - 1] && db > freqData[i + 1] && db > PEAK_NOISE_FLOOR) {
      peakFreqs.push(i * binWidth);
      peakMags.push(Math.pow(10, db / 20)); // dBFS → linear magnitude
    }
  }

  if (!peakFreqs.length) return new Float32Array(12);

  const freqVec = essentia.arrayToVector(new Float32Array(peakFreqs));
  const magVec  = essentia.arrayToVector(new Float32Array(peakMags));

  // HPCP maps spectral peaks onto 12 pitch-class bins (C…B).
  const { hpcp } = essentia.HPCP(
    freqVec, magVec,
    true,            // bandPreset
    500,             // bandSplitFrequency (Hz)
    0,               // harmonics
    5000,            // maxFrequency
    false,           // maxShifted
    40,              // minFrequency
    false,           // nonLinear
    'unitMax',       // normalized
    440,             // referenceFrequency
    sampleRate,
    12,              // size (12-bin chroma)
    'squaredCosine', // weightType
    1,               // windowSize
  );
  freqVec.delete();
  magVec.delete();

  const result = new Float32Array(essentia.vectorToArray(hpcp));
  hpcp.delete();

  return result;
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Listens for a guitar strum, computes HPCP over several frames, and
 * matches the result against the target chord.
 *
 * @param {string} chordName - e.g. 'C-Dur'
 * @returns {Promise<{ isCorrect: boolean, confidence: number, bestMatch: string|null, timedOut?: boolean, essentiaError?: boolean }>}
 */
export async function detectChordEssentia(chordName) {
  let essentia;
  try {
    [essentia] = await Promise.all([getEssentia(), ensureMic()]);
  } catch {
    return { isCorrect: false, confidence: 0, bestMatch: null, essentiaError: true };
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

    // ── Timeout ───────────────────────────────────────────────────────────────
    timeoutId = setTimeout(() => {
      if (!strumDetected) {
        resolveWith({ isCorrect: false, confidence: 0, bestMatch: null, timedOut: true });
      }
    }, LISTEN_TIMEOUT_MS);

    // ── Strum detection loop ──────────────────────────────────────────────────
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

    // ── Analysis after strum ──────────────────────────────────────────────────
    async function collectAndResolve() {
      if (!analyser) { resolveWith({ isCorrect: false, confidence: 0, bestMatch: null }); return; }

      const hpcps = [];
      for (let i = 0; i < ANALYSIS_FRAMES; i++) {
        if (i > 0) await new Promise(r => setTimeout(r, FRAME_INTERVAL_MS));
        if (!analyser) break;
        try {
          hpcps.push(computeHpcp(essentia, analyser, sampleRate));
        } catch {
          // single frame error is non-fatal; skip and continue
        }
      }

      clearTimeout(timeoutId);
      if (!hpcps.length) {
        resolve({ isCorrect: false, confidence: 0, bestMatch: null });
        return;
      }

      const avgHpcp = averageHpcps(hpcps);
      resolve(matchHpcpToChord(avgHpcp, chordName, CHORD_TEMPLATES));
    }
  });
}

/**
 * Tears down microphone and AudioContext.
 * Safe to call multiple times.
 */
export function stopListeningEssentia() {
  _tearDown();
}
