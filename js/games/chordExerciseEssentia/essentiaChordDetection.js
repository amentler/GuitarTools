/**
 * essentiaChordDetection.js
 * Microphone audio pipeline for HPCP-based chord detection.
 *
 * Pipeline:
 *   mic → AnalyserNode → time-domain frame
 *   → essentia Windowing → Spectrum → SpectralPeaks → HPCP
 *   → average over ANALYSIS_FRAMES → matchHpcpToChord
 *
 * HPCP (Harmonic Pitch Class Profile) is much more robust than
 * raw FFT-peak detection because it integrates harmonic energy
 * into 12 pitch-class bins before comparing against chord templates.
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
 * Computes a 12-bin HPCP vector from a time-domain audio frame.
 * All intermediate essentia WASM vectors are explicitly deleted to prevent
 * memory leaks on the WASM heap.
 *
 * @param {InstanceType<window.Essentia>} essentia
 * @param {Float32Array} samples  - time-domain samples (length = FFT_SIZE)
 * @param {number}       sampleRate
 * @returns {Float32Array} 12-element HPCP vector (values in [0, 1])
 */
function computeHpcp(essentia, samples, sampleRate) {
  const frameSize = samples.length;

  // Convert to WASM vector
  const signal = essentia.arrayToVector(samples);

  // Apply Hann window (size must match frame to avoid partial windowing)
  const { frame: windowed } = essentia.Windowing(signal, true, frameSize, 'hann', 0, true);
  signal.delete();

  // Magnitude spectrum (output size = frameSize/2 + 1)
  const { spectrum } = essentia.Spectrum(windowed, frameSize);
  windowed.delete();

  // Find spectral peaks in the guitar fundamental range
  const { frequencies, magnitudes } = essentia.SpectralPeaks(
    spectrum,
    0,          // magnitudeThreshold
    5000,       // maxFrequency (Hz)
    100,        // maxPeaks
    40,         // minFrequency – lowest guitar string (E2 ≈ 82 Hz, but allow lower)
    'magnitude', // orderBy strongest peaks first
    sampleRate,
  );
  spectrum.delete();

  // HPCP: maps spectral peaks to 12 pitch-class bins
  // harmonics=0 means only the fundamental of each peak contributes;
  // the squaredCosine weight type gives smooth bin transitions.
  const { hpcp } = essentia.HPCP(
    frequencies, magnitudes,
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
  frequencies.delete();
  magnitudes.delete();

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
 * @returns {Promise<{ isCorrect: boolean, confidence: number, bestMatch: string|null, timedOut?: boolean }>}
 */
export async function detectChordEssentia(chordName) {
  let essentia;
  try {
    [essentia] = await Promise.all([getEssentia(), ensureMic()]);
  } catch {
    return { isCorrect: false, confidence: 0, bestMatch: null };
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
        const buf = new Float32Array(FFT_SIZE);
        analyser.getFloatTimeDomainData(buf);
        try {
          hpcps.push(computeHpcp(essentia, buf, sampleRate));
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
