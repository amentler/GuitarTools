/**
 * chordDetection.js
 * Audio capture + spectral analysis for chord detection.
 *
 * Exports:
 *   detectChord(chordName) → Promise<{ isCorrect, missingNotes, extraNotes, confidence, timedOut? }>
 *   stopListening()
 *   detectPeaksFromSpectrum(freqData, sampleRate, minFreqHz, maxFreqHz, minDbThreshold) → number[]
 */

import { GUITAR_MIN_RMS, analyzeInputLevel } from '../../tools/guitarTuner/pitchLogic.js';
import { identifyNotesFromPeaks, matchChordToTarget } from './chordDetectionLogic.js';

// ── Constants ─────────────────────────────────────────────────────────────────

const FFT_SIZE = 16384;              // high resolution for chord detection
const GUITAR_MIN_FREQUENCY = 70;     // Hz – lowest guitar fundamental (low E)
const GUITAR_MAX_FREQUENCY = 1200;   // Hz – upper limit for fundamental detection
const MIN_DB_THRESHOLD = -55;        // dB threshold for peak detection
const ATTACK_SETTLE_MS = 150;        // wait after strum onset before analyzing
const LISTEN_TIMEOUT_MS = 8000;      // give up after 8 seconds of silence
const ANALYSIS_FRAMES = 6;           // number of frames to average after strum
const FRAME_INTERVAL_MS = 50;        // interval between analysis frames
const RMS_SPIKE_MULTIPLIER = 3;      // strum threshold = N × GUITAR_MIN_RMS

// ── Module-level audio state ──────────────────────────────────────────────────

let audioCtx = null;
let analyser = null;
let stream = null;

// ── Pure export: peak detection ───────────────────────────────────────────────

/**
 * Detects spectral peaks in a frequency-domain buffer.
 *
 * @param {Float32Array} freqData - dB values from AnalyserNode.getFloatFrequencyData()
 * @param {number} sampleRate - Audio context sample rate (Hz)
 * @param {number} minFreqHz - Lower frequency bound to search
 * @param {number} maxFreqHz - Upper frequency bound to search
 * @param {number} minDbThreshold - Minimum dB value for a bin to be considered a peak
 * @returns {number[]} Frequencies (Hz) of local maxima, sorted ascending
 */
export function detectPeaksFromSpectrum(freqData, sampleRate, minFreqHz, maxFreqHz, minDbThreshold) {
  const peaks = [];
  const numBins = freqData.length;

  // Edge case: need at least 3 bins to check neighbors
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

  return peaks; // already sorted by frequency (bin order = ascending freq)
}

// ── Internal helpers ──────────────────────────────────────────────────────────

/**
 * Sets up microphone access and AudioContext if not already running.
 * Idempotent – calling while already running is a no-op.
 */
async function ensureMic() {
  if (audioCtx && analyser && stream) return;

  // Tear down any partial state before re-initialising
  _tearDown();

  stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
  audioCtx = new AudioContext();
  analyser = audioCtx.createAnalyser();
  analyser.fftSize = FFT_SIZE;
  audioCtx.createMediaStreamSource(stream).connect(analyser);
}

function _tearDown() {
  if (stream) {
    stream.getTracks().forEach(t => t.stop());
    stream = null;
  }
  if (audioCtx) {
    audioCtx.close().catch(() => {});
    audioCtx = null;
    analyser = null;
  }
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Listens for a guitar strum, analyses the spectrum across several frames,
 * then matches the detected notes against the target chord.
 *
 * @param {string} chordName - e.g. 'C-Dur', 'G-Dur'
 * @returns {Promise<{ isCorrect: boolean, missingNotes: string[], extraNotes: string[], confidence: number, timedOut?: boolean }>}
 */
export async function detectChord(chordName) {
  try {
    await ensureMic();
  } catch {
    return { isCorrect: false, confidence: 0, missingNotes: [], extraNotes: [] };
  }

  const rmsThreshold = RMS_SPIKE_MULTIPLIER * GUITAR_MIN_RMS;

  return new Promise(resolve => {
    let strumDetected = false;
    let intervalId = null;
    let timeoutId = null;

    function cleanup() {
      clearInterval(intervalId);
      clearTimeout(timeoutId);
    }

    function resolveWith(result) {
      cleanup();
      resolve(result);
    }

    // ── Timeout ─────────────────────────────────────────────────────────────
    timeoutId = setTimeout(() => {
      if (!strumDetected) {
        resolveWith({
          isCorrect: false,
          confidence: 0,
          missingNotes: [],
          extraNotes: [],
          timedOut: true,
        });
      }
    }, LISTEN_TIMEOUT_MS);

    // ── Strum detection loop ─────────────────────────────────────────────────
    intervalId = setInterval(() => {
      if (!analyser || strumDetected) return;

      const timeDomainBuffer = new Float32Array(analyser.fftSize);
      analyser.getFloatTimeDomainData(timeDomainBuffer);
      const { rms } = analyzeInputLevel(timeDomainBuffer);

      if (rms > rmsThreshold) {
        strumDetected = true;
        clearInterval(intervalId);

        // Wait for attack transient to settle, then collect analysis frames
        setTimeout(() => {
          if (!analyser) {
            resolveWith({ isCorrect: false, confidence: 0, missingNotes: [], extraNotes: [] });
            return;
          }
          collectAndResolve();
        }, ATTACK_SETTLE_MS);
      }
    }, FRAME_INTERVAL_MS);

    // ── Analysis after strum ─────────────────────────────────────────────────
    function collectAndResolve() {
      if (!analyser) {
        resolveWith({ isCorrect: false, confidence: 0, missingNotes: [], extraNotes: [] });
        return;
      }

      const sampleRate = audioCtx ? audioCtx.sampleRate : 44100;
      const allDetectedNotes = [];
      let frame = 0;

      const analysisId = setInterval(() => {
        if (!analyser) {
          clearInterval(analysisId);
          resolveWith({ isCorrect: false, confidence: 0, missingNotes: [], extraNotes: [] });
          return;
        }

        const freqData = new Float32Array(analyser.frequencyBinCount);
        analyser.getFloatFrequencyData(freqData);

        const peaks = detectPeaksFromSpectrum(
          freqData,
          sampleRate,
          GUITAR_MIN_FREQUENCY,
          GUITAR_MAX_FREQUENCY,
          MIN_DB_THRESHOLD,
        );

        const notes = identifyNotesFromPeaks(peaks);
        allDetectedNotes.push(...notes);

        frame++;
        if (frame >= ANALYSIS_FRAMES) {
          clearInterval(analysisId);
          clearTimeout(timeoutId);

          // Deduplicate: unique note names across all frames
          const uniqueNotes = [];
          const seen = new Set();
          for (const n of allDetectedNotes) {
            if (!seen.has(n.note)) {
              seen.add(n.note);
              uniqueNotes.push(n);
            }
          }

          const result = matchChordToTarget(uniqueNotes, chordName);
          resolve(result);
        }
      }, FRAME_INTERVAL_MS);
    }
  });
}

/**
 * Tears down the microphone and AudioContext.
 * Safe to call multiple times.
 */
export function stopListening() {
  _tearDown();
}
