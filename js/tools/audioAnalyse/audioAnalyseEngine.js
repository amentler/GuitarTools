/**
 * audioAnalyseEngine.js
 *
 * Reine Analyse-Logik für das Audio-Analyse Werkzeug.
 * Kein DOM, kein State – nur pure Funktionen.
 *
 * Ablauf:
 *   1. WAV-Datei via AudioContext.decodeAudioData dekodieren → AudioBuffer + Float32Array
 *   2. OfflineAudioContext + AnalyserNode: frequencyData pro Frame via
 *      getFloatFrequencyData() – identisch zur live Analyse in „Noten lesen"
 *   3. Pro Frame: Onset-Detektor (frequencyData + samples) + Pitch-Erkennung + Input-Level
 *   4. AnalysisResult zurückgeben
 */

import { resolveGuitarOnsetStrategy } from '../../shared/audio/guitarOnsetStrategies.js';
import { analyzeInputLevel } from '../../shared/audio/inputLevel.js';
import { createMatchState } from '../../shared/audio/fastNoteMatcher.js';
import { collectFrameData } from '../../shared/audio/collectFrameData.js';
import { NOTES } from '../../shared/music/sheetMusicLogic.js';
import {
  classifySheetMusicFrame,
  resolveSheetMusicRecognitionStrategy,
  SHEET_MUSIC_CENTS_TOLERANCE,
  updateSheetMusicMatchState,
} from '../../shared/audio/sheetMusicRecognition.js';

const DEFAULT_ANALYSIS_TARGET = `${NOTES[0].name}${NOTES[0].octave}`;

/**
 * Dekodiert ein WAV-ArrayBuffer zu einem Float32Array (Kanal 0, mono) + AudioBuffer.
 *
 * @param {ArrayBuffer} arrayBuffer
 * @returns {Promise<{ samples: Float32Array, sampleRate: number, audioBuffer: AudioBuffer }>}
 */
export async function decodeWav(arrayBuffer) {
  const audioCtx = new AudioContext();
  try {
    const audioBuffer = await audioCtx.decodeAudioData(arrayBuffer);
    const samples = new Float32Array(audioBuffer.getChannelData(0));
    const { sampleRate } = audioBuffer;
    return { samples, sampleRate, audioBuffer };
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
 *   - hz, note, octave, cents             (Noten-lesen-Erkennung)
 *
 * @param {Float32Array} samples
 * @param {number} sampleRate
 * @param {{ onsetStrategyKey?: string, pitchStrategyKey?: string, targetSequence?: string[] }} [options]
 * @returns {Promise<AnalysisResult>}
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
export async function analyzeAudio(samples, sampleRate, options = {}) {
  const pitchStrategy = resolveSheetMusicRecognitionStrategy(options.pitchStrategyKey);
  const targetSequence = Array.isArray(options.targetSequence) ? options.targetSequence : [];
  let targetIndex = 0;
  let currentTarget = targetSequence[targetIndex] ?? null;
  let matchState = createMatchState();
  let awaitingOnset = true;
  const fftSize = pitchStrategy.getRecommendedFftSize(currentTarget, sampleRate);
  const hopSize = fftSize;
  const duration = samples.length / sampleRate;

  const onsetStrategy = resolveGuitarOnsetStrategy(options.onsetStrategyKey);
  let onsetState = onsetStrategy.createState();
  let lastOnsetResult = null;

  // Frequency data via OfflineAudioContext + AnalyserNode (gleicher Pfad wie Übung)
  const frameInputs = await collectFrameData(samples, sampleRate, fftSize, hopSize);

  const frames = [];
  const onsets = [];

  for (let i = 0; i < frameInputs.length; i++) {
    const { samples: frame, frequencyData } = frameInputs[i];
    const tCenter = (i * hopSize + fftSize / 2) / sampleRate;

    // Signalqualität
    const level = analyzeInputLevel(frame);

    // Onset-Erkennung – gleicher Aufruf wie in sheetMusicReading.analyzeFrame()
    const onsetResult = onsetStrategy.update(onsetState, { frequencyData, samples: frame });
    onsetState = onsetResult.nextState;
    lastOnsetResult = onsetResult;

    const isOnset = onsetResult.event === 'onset';
    if (isOnset) {
      onsets.push(tCenter);
    }

    // Noten-lesen-Erkennung (nur wenn Signal valide genug)
    let hz = null;
    let note = null;
    let octave = null;
    let cents = null;

    if (level.isValid) {
      const frameResult = classifySheetMusicFrame(
        frame,
        sampleRate,
        currentTarget ?? DEFAULT_ANALYSIS_TARGET,
        {
          tolerateCents: SHEET_MUSIC_CENTS_TOLERANCE,
          strategyKey: options.pitchStrategyKey,
        },
      );

      if (frameResult.detectedPitch && Number.isFinite(frameResult.hz)) {
        const parsed = parsePitch(frameResult.detectedPitch);
        hz = frameResult.hz;
        note = parsed?.name ?? null;
        octave = parsed?.octave ?? null;
        cents = Number.isFinite(frameResult.cents) ? frameResult.cents : null;
      }

      if (currentTarget) {
        let effective = frameResult.status === 'wrong'
          ? { ...frameResult, status: 'unsure' }
          : frameResult;
        if (awaitingOnset) {
          effective = { ...effective, status: 'unsure' };
        }

        const { nextState, event } = updateSheetMusicMatchState(matchState, effective);
        matchState = nextState;
        if (event === 'accept') {
          targetIndex++;
          currentTarget = targetSequence[targetIndex] ?? null;
          matchState = createMatchState();
          awaitingOnset = true;
        }
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
      spectralNoveltyBins: onsetResult.spectralNoveltyBins ?? 0,
      relativeRms: onsetResult.relativeRms ?? 0,
      relativeFlux: onsetResult.relativeFlux ?? 0,
      sustainFloorRms: onsetResult.sustainFloorRms ?? 0,
      fluxHistory: onsetResult.fluxHistory ?? 0,
      gateRelativeRms: onsetResult.relativeRmsAttack ?? false,
      gateRelativeFlux: onsetResult.relativeSpectralAttack ?? false,
      gateConfirmed: onsetResult.confirmedWeakRmsFluxAttack ?? false,
      gateCooldownOverride: onsetResult.cooldownOverrideAttack ?? false,
      gateBroadbandOr: onsetResult.broadbandOrAttack ?? false,
      hz,
      note,
      octave,
      cents,
    });
  }

  return { frames, onsets, sampleRate, fftSize, hopSize, duration, onsetOptions: lastOnsetResult?.options ?? null };
}

function parsePitch(pitch) {
  const match = /^([A-G]#?)(-?\d+)$/.exec(pitch ?? '');
  if (!match) return null;
  return { name: match[1], octave: Number.parseInt(match[2], 10) };
}
