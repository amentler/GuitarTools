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
import { computeDbSpectrum } from '../../shared/audio/dbSpectrum.js';
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
 * Sammelt frequencyData + timeDomainData für jeden Frame offline via
 * OfflineAudioContext + AnalyserNode.getFloatFrequencyData() –
 * identisch zur live Analyse in sheetMusicReading.js.
 *
 * @param {Float32Array} samples
 * @param {number} sampleRate
 * @param {number} fftSize
 * @param {number} hopSize
 * @returns {Promise<Array<{ samples: Float32Array, frequencyData: Float32Array }>>}
 */
async function collectFrameData(samples, sampleRate, fftSize, hopSize) {
  const frameCount = Math.floor((samples.length - fftSize) / hopSize) + 1;

  if (typeof OfflineAudioContext.prototype.suspend !== 'function') {
    return Array.from({ length: frameCount }, (_, i) => {
      const frame = samples.slice(i * hopSize, i * hopSize + fftSize);
      return {
        samples: frame,
        frequencyData: computeDbSpectrum(frame, fftSize),
      };
    });
  }

  const totalLength = Math.max(samples.length, frameCount * hopSize + fftSize);

  const offCtx = new OfflineAudioContext(1, totalLength, sampleRate);
  const audioBuffer = offCtx.createBuffer(1, samples.length, sampleRate);
  audioBuffer.copyToChannel(samples, 0);

  const analyser = offCtx.createAnalyser();
  analyser.fftSize = fftSize;
  analyser.smoothingTimeConstant = 0; // frame-by-frame, ohne Glättung

  const source = offCtx.createBufferSource();
  source.buffer = audioBuffer;
  source.connect(analyser);
  analyser.connect(offCtx.destination);

  const frameTimeDomain = new Array(frameCount);
  const frameFreq = new Array(frameCount);

  // Suspend am Ende jedes Frame-Fensters und Daten vom AnalyserNode lesen.
  // Das ist die gleiche API wie in analyzeFrame() in sheetMusicReading.js.
  for (let i = 0; i < frameCount; i++) {
    const suspendTime = (i * hopSize + fftSize) / sampleRate;
    offCtx.suspend(suspendTime).then(() => {
      const td = new Float32Array(fftSize);
      const fd = new Float32Array(analyser.frequencyBinCount);
      analyser.getFloatTimeDomainData(td);
      analyser.getFloatFrequencyData(fd);
      frameTimeDomain[i] = td;
      frameFreq[i] = fd;
      offCtx.resume();
    });
  }

  source.start(0);
  await offCtx.startRendering();

  return frameTimeDomain.map((td, i) => ({
    samples: td,
    frequencyData: frameFreq[i],
  }));
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
      hz,
      note,
      octave,
      cents,
    });
  }

  return { frames, onsets, sampleRate, fftSize, hopSize, duration };
}

function parsePitch(pitch) {
  const match = /^([A-G]#?)(-?\d+)$/.exec(pitch ?? '');
  if (!match) return null;
  return { name: match[1], octave: Number.parseInt(match[2], 10) };
}
