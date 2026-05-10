/**
 * audioAnalyseEngine.js
 *
 * Reine Analyse-Logik für das Audio-Analyse Werkzeug.
 * Kein DOM, kein State – nur pure Funktionen.
 *
 * Ablauf:
 *   1. WAV-Datei via AudioContext.decodeAudioData dekodieren → Float32Array
 *   2. Samples in gleichgroße Frames aufteilen (hopSize = fftSize, kein Overlap)
 *   3. Pro Frame: Onset-Detektor + Pitch-Erkennung + Input-Level
 *   4. AnalysisResult zurückgeben
 */

import { resolveGuitarOnsetStrategy } from '../../shared/audio/guitarOnsetStrategies.js';
import {
  detectPitch,
  frequencyToNote,
} from '../../shared/audio/guitarPitchDetection.js';
import { analyzeInputLevel } from '../../shared/audio/inputLevel.js';
import { getRecommendedFftSize } from '../../shared/audio/fastNoteMatcher.js';

/**
 * Dekodiert ein WAV-ArrayBuffer zu einem Float32Array (Kanal 0, mono).
 * Nutzt die native Browser-API AudioContext.decodeAudioData – kein eigener Decoder.
 *
 * @param {ArrayBuffer} arrayBuffer
 * @returns {Promise<{ samples: Float32Array, sampleRate: number }>}
 */
export async function decodeWav(arrayBuffer) {
  const audioCtx = new AudioContext();
  try {
    const audioBuffer = await audioCtx.decodeAudioData(arrayBuffer);
    const samples = new Float32Array(audioBuffer.getChannelData(0));
    const { sampleRate } = audioBuffer;
    return { samples, sampleRate };
  } finally {
    audioCtx.close().catch(() => {});
  }
}

/**
 * Analysiert ein Float32Array-Signal Frame für Frame.
 *
 * Pro Frame werden berechnet:
 *   - rms, clippingRatio, isValid         (Signalqualität)
 *   - broadbandFlux, bandRatio,
 *     activeBandRatio, confidence, isOnset (Onset-Detektor)
 *   - hz, note, octave, cents             (Pitch-Erkennung)
 *
 * @param {Float32Array} samples
 * @param {number} sampleRate
 * @param {{ onsetStrategyKey?: string }} [options]
 * @returns {AnalysisResult}
 *
 * @typedef {{
 *   frames: FrameData[],
 *   onsets: number[],
 *   sampleRate: number,
 *   fftSize: number,
 *   hopSize: number,
 *   duration: number,
 * }} AnalysisResult
 *
 * @typedef {{
 *   t: number,
 *   rms: number,
 *   clippingRatio: number,
 *   isValid: boolean,
 *   broadbandFlux: number,
 *   bandRatio: number,
 *   activeBandRatio: number,
 *   confidence: number,
 *   isOnset: boolean,
 *   hz: number|null,
 *   note: string|null,
 *   octave: number|null,
 *   cents: number|null,
 * }} FrameData
 */
export function analyzeAudio(samples, sampleRate, options = {}) {
  const fftSize = getRecommendedFftSize(null, sampleRate);
  const hopSize = fftSize;
  const duration = samples.length / sampleRate;

  const onsetStrategy = resolveGuitarOnsetStrategy(options.onsetStrategyKey);
  let onsetState = onsetStrategy.createState();

  const frames = [];
  const onsets = [];

  const frameCount = Math.floor((samples.length - fftSize) / hopSize) + 1;

  for (let i = 0; i < frameCount; i++) {
    const start = i * hopSize;
    const frame = samples.slice(start, start + fftSize);
    const tCenter = (start + fftSize / 2) / sampleRate;

    // Signalqualität
    const level = analyzeInputLevel(frame);

    // Onset-Erkennung
    const onsetResult = onsetStrategy.update(onsetState, { samples: frame });
    onsetState = onsetResult.nextState;

    const isOnset = onsetResult.event === 'onset';
    if (isOnset) {
      onsets.push(tCenter);
    }

    // Pitch-Erkennung (nur wenn Signal valide genug)
    let hz = null;
    let note = null;
    let octave = null;
    let cents = null;

    if (level.isValid) {
      hz = detectPitch(frame, sampleRate, { applyFilters: true });
      if (hz !== null && Number.isFinite(hz)) {
        const pitchInfo = frequencyToNote(hz);
        note = pitchInfo.note;
        octave = pitchInfo.octave;
        cents = pitchInfo.cents ?? null;
      } else {
        hz = null;
      }
    }

    frames.push({
      t: tCenter,
      rms: level.rms,
      clippingRatio: level.clippingRatio,
      isValid: level.isValid,
      broadbandFlux: onsetResult.broadbandFlux ?? 0,
      bandRatio: onsetResult.bandRatio ?? 0,
      activeBandRatio: onsetResult.activeBandRatio ?? 0,
      confidence: onsetResult.confidence ?? 0,
      isOnset,
      hz,
      note,
      octave,
      cents,
    });
  }

  return { frames, onsets, sampleRate, fftSize, hopSize, duration };
}
