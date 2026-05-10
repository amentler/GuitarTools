/**
 * essentiaSheetMusicStrategy.js
 *
 * Essentia-based pitch recognition strategy for the „Noten lesen" exercise.
 *
 * Creates a strategy object compatible with the SHEET_MUSIC_RECOGNITION_STRATEGIES
 * interface.  The strategy must be created with a live Essentia instance:
 *
 *   // Browser
 *   import { getEssentia } from '../chordExerciseEssentia/essentiaLoader.js';
 *   const ess = await getEssentia();
 *   const strategy = createEssentiaSheetMusicStrategy(ess);
 *
 *   // Node.js / SFP tests
 *   import { loadEssentiaForNode } from '../../../tests/helpers/essentiaNodeWasmLoader.js';
 *   const ess = await loadEssentiaForNode();
 *   const strategy = createEssentiaSheetMusicStrategy(ess);
 *
 * Algorithm: Essentia PitchYin (time-domain YIN – works directly on a Float32Array
 * of samples, no pre-computed spectrum needed).
 *
 * Frame pipeline:
 *   samples → RMS gate → PitchYin → frequencyToNote → cents comparison
 *          → softenSheetMusicFrameResult (D3/D2 special case)
 *
 * The same `getRecommendedFftSize` as the fast-note-matcher is used so the SFP
 * and the game controller read the same frame size.
 */

import {
  frequencyToNote,
  noteToFrequency,
  GUITAR_MIN_RMS,
} from '../../shared/audio/guitarPitchDetection.js';
import { getRecommendedFftSize } from '../../shared/audio/fastNoteMatcher.js';
import {
  SHEET_MUSIC_CENTS_TOLERANCE,
  softenSheetMusicFrameResult,
  getSheetMusicTargetHarmonicScore,
  SHEET_MUSIC_TARGET_HARMONIC_THRESHOLD,
} from './sheetMusicRecognition.js';

export const ESSENTIA_STRATEGY_KEY = 'essentia-pitch-yin';

// Minimum PitchYin confidence to treat a detection as reliable.
const MIN_PITCH_CONFIDENCE = 0.4;

function parsePitch(pitch) {
  const match = /^([A-G]#?)(-?\d+)$/.exec(pitch ?? '');
  if (!match) return null;
  return { name: match[1], octave: Number.parseInt(match[2], 10) };
}

function frameRms(samples) {
  let sum = 0;
  for (let i = 0; i < samples.length; i++) sum += samples[i] * samples[i];
  return Math.sqrt(sum / Math.max(1, samples.length));
}

/**
 * Creates a sheet-music recognition strategy backed by Essentia PitchYin.
 *
 * @param {object} essentia - Initialised Essentia instance (from EssentiaClass)
 * @returns {object} Strategy object compatible with SHEET_MUSIC_RECOGNITION_STRATEGIES
 */
export function createEssentiaSheetMusicStrategy(essentia) {
  if (!essentia || typeof essentia.PitchYin !== 'function') {
    throw new Error('createEssentiaSheetMusicStrategy: valid Essentia instance required');
  }

  function classifyFrame(samples, sampleRate, targetPitch, options = {}) {
    const tolerateCents = options.tolerateCents ?? SHEET_MUSIC_CENTS_TOLERANCE;
    const minRms = options.minRms ?? GUITAR_MIN_RMS;

    // RMS gate — identical to fast-note-matcher behaviour
    const rms = frameRms(samples);
    if (rms < minRms) {
      return { status: 'unsure', detectedPitch: null, hz: null, cents: null };
    }

    const target = parsePitch(targetPitch);
    if (!target) {
      return { status: 'unsure', detectedPitch: null, hz: null, cents: null };
    }

    // Run Essentia PitchYin on the raw sample frame.
    // frameSize MUST match samples.length — Essentia throws if they differ.
    // minFrequency = 70 Hz (GUITAR_MIN_FREQUENCY) prevents locking onto
    // sub-harmonic noise, matching the fast-note-matcher's full-range policy.
    // IMPORTANT: vec.delete() must be called after use to free WASM heap memory.
    let pitch;
    let pitchConfidence;
    let vec = null;
    try {
      const frame = samples instanceof Float32Array ? samples : new Float32Array(samples);
      vec = essentia.arrayToVector(frame);
      ({ pitch, pitchConfidence } = essentia.PitchYin(
        vec,
        frame.length, // frameSize — must equal input length
        true,         // interpolate
        1200,         // maxFrequency (well above guitar range)
        70,           // minFrequency (GUITAR_MIN_FREQUENCY)
        sampleRate,   // actual sample rate of the audio
        0.15,         // tolerance
      ));
    } catch {
      vec?.delete();
      return { status: 'unsure', detectedPitch: null, hz: null, cents: null };
    }
    vec.delete();

    if (!Number.isFinite(pitch) || pitch <= 0 || pitchConfidence < MIN_PITCH_CONFIDENCE) {
      // Low-confidence detection: fall through to harmonic score check below
      const targetHz = noteToFrequency(target.name, target.octave);
      const harmThreshold = options.targetHarmonicThreshold ?? SHEET_MUSIC_TARGET_HARMONIC_THRESHOLD;
      const harmonicScore = getSheetMusicTargetHarmonicScore(samples, sampleRate, targetPitch);
      if (harmonicScore >= harmThreshold) {
        return softenSheetMusicFrameResult({
          status: 'correct',
          detectedPitch: targetPitch,
          hz: targetHz,
          cents: 0,
          targetHarmonicScore: harmonicScore,
        }, targetPitch);
      }
      return { status: 'unsure', detectedPitch: null, hz: null, cents: null };
    }

    const { note, octave } = frequencyToNote(pitch);
    const detectedPitch = `${note}${octave}`;
    const targetHz = noteToFrequency(target.name, target.octave);
    const centsToTarget = 1200 * Math.log2(pitch / targetHz);

    const baseResult = note === target.name && octave === target.octave && Math.abs(centsToTarget) <= tolerateCents
      ? { status: 'correct', detectedPitch, hz: pitch, cents: centsToTarget }
      : { status: 'wrong', detectedPitch, hz: pitch, cents: centsToTarget };

    const result = softenSheetMusicFrameResult(baseResult, targetPitch);
    if (result.status === 'correct') return result;

    // Harmonic-score fallback: catches cases where PitchYin detects a harmonic
    // instead of the fundamental but the target partial energy is strong enough.
    const harmThreshold = options.targetHarmonicThreshold ?? SHEET_MUSIC_TARGET_HARMONIC_THRESHOLD;
    const harmonicScore = getSheetMusicTargetHarmonicScore(samples, sampleRate, targetPitch);
    if (harmonicScore >= harmThreshold) {
      return softenSheetMusicFrameResult({
        ...result,
        status: 'correct',
        detectedPitch: targetPitch,
        hz: targetHz,
        cents: 0,
        targetHarmonicScore: harmonicScore,
      }, targetPitch);
    }

    return { ...result, targetHarmonicScore: harmonicScore };
  }

  return {
    key: ESSENTIA_STRATEGY_KEY,
    label: 'Essentia PitchYin',
    description: 'Pitch-Erkennung via Essentia.js PitchYin (WASM, time-domain YIN) mit Zielton-Harmonik-Fallback.',
    classifyFrame,
    getRecommendedFftSize,
  };
}
