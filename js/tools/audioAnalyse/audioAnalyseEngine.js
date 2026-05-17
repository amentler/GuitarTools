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
import { ONSET_FFT_SIZE, ONSET_HOP_SIZE, ONSET_HOP_DIVISOR } from '../../shared/audio/onsetPipelineConfig.js';

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
 * @param {number} requestedFftSize
 * @param {number} requestedHopSize
 * @returns {Promise<{
 *   frames: Array<{ samples: Float32Array, frequencyData: Float32Array }>,
 *   actualFftSize: number,
 *   actualHopSize: number,
 *   actualSampleRate: number,
 *   collectFrameDataPath: 'offline-audio-context' | 'js-fft-fallback',
 * }>}
 */
export async function collectFrameData(samples, sampleRate, requestedFftSize, requestedHopSize) {
  const frameCount = Math.floor((samples.length - requestedFftSize) / requestedHopSize) + 1;

  if (typeof OfflineAudioContext.prototype.suspend !== 'function') {
    const frames = Array.from({ length: frameCount }, (_, i) => {
      const frame = samples.slice(i * requestedHopSize, i * requestedHopSize + requestedFftSize);
      return {
        samples: frame,
        frequencyData: computeDbSpectrum(frame, requestedFftSize),
      };
    });
    return {
      frames,
      actualFftSize: requestedFftSize,
      actualHopSize: requestedHopSize,
      actualSampleRate: sampleRate,
      collectFrameDataPath: 'js-fft-fallback',
    };
  }

  const totalLength = Math.max(samples.length, frameCount * requestedHopSize + requestedFftSize);

  const offCtx = new OfflineAudioContext(1, totalLength, sampleRate);
  const audioBuffer = offCtx.createBuffer(1, samples.length, sampleRate);
  audioBuffer.copyToChannel(samples, 0);

  const analyser = offCtx.createAnalyser();
  analyser.fftSize = requestedFftSize;
  analyser.smoothingTimeConstant = 0; // frame-by-frame, ohne Glättung

  const actualFftSize = analyser.fftSize;
  const actualHopSize = Math.round(actualFftSize / ONSET_HOP_DIVISOR);

  const source = offCtx.createBufferSource();
  source.buffer = audioBuffer;
  source.connect(analyser);
  analyser.connect(offCtx.destination);

  const frameTimeDomain = new Array(frameCount);
  const frameFreq = new Array(frameCount);

  // Suspend am Ende jedes Frame-Fensters und Daten vom AnalyserNode lesen.
  // Das ist die gleiche API wie in analyzeFrame() in sheetMusicReading.js.
  for (let i = 0; i < frameCount; i++) {
    const suspendTime = (i * requestedHopSize + requestedFftSize) / sampleRate;
    offCtx.suspend(suspendTime).then(() => {
      const td = new Float32Array(actualFftSize);
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

  const frames = frameTimeDomain.map((td, i) => ({
    samples: td,
    frequencyData: frameFreq[i],
  }));
  return {
    frames,
    actualFftSize,
    actualHopSize,
    actualSampleRate: sampleRate,
    collectFrameDataPath: 'offline-audio-context',
  };
}

/**
 * Analysiert ein Float32Array-Signal Frame für Frame.
 *
 * Verwendet zwei unabhängige Pipelines:
 *   - Onset-Pipeline:  ONSET_FFT_SIZE=1024, ONSET_HOP_SIZE=256
 *   - Pitch-Pipeline:  getRecommendedFftSize() (note-adaptiv), hopSize=fftSize
 *
 * Pitch-Daten werden zeitlich auf die Onset-Frames gemappt.
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
 *   onsetFftSize: number,
 *   onsetHopSize: number,
 *   pitchFftSize: number,
 *   pitchHopSize: number,
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

  // ── Onset Pipeline ─────────────────────────────────────────────────────────
  const onsetFftSize = ONSET_FFT_SIZE;
  const onsetHopSize = ONSET_HOP_SIZE;

  // ── Pitch Pipeline ─────────────────────────────────────────────────────────
  const pitchFftSize = pitchStrategy.getRecommendedFftSize(currentTarget, sampleRate);
  const pitchHopSize = pitchFftSize;

  const duration = samples.length / sampleRate;

  // Collect frames for both pipelines in parallel
  const [onsetFrameResult, pitchFrameResult] = await Promise.all([
    collectFrameData(samples, sampleRate, onsetFftSize, onsetHopSize),
    collectFrameData(samples, sampleRate, pitchFftSize, pitchHopSize),
  ]);

  const onsetFrames = onsetFrameResult.frames;
  const pitchFrames = pitchFrameResult.frames;

  // ── Pitch analysis on pitch frames ─────────────────────────────────────────
  let matchState = createMatchState();
  let awaitingOnset = true;
  /** @type {Array<{ t: number, hz: number|null, note: string|null, octave: number|null, cents: number|null }>} */
  const pitchData = [];

  for (let i = 0; i < pitchFrames.length; i++) {
    const { samples: pFrame } = pitchFrames[i];
    const tCenter = (i * pitchHopSize + pitchFftSize / 2) / sampleRate;
    const level = analyzeInputLevel(pFrame);

    let hz = null;
    let note = null;
    let octave = null;
    let cents = null;

    if (level.isValid) {
      const frameResult = classifySheetMusicFrame(
        pFrame,
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

    pitchData.push({ t: tCenter, hz, note, octave, cents });
  }

  // ── Onset analysis on onset frames ─────────────────────────────────────────
  const onsetStrategy = resolveGuitarOnsetStrategy(options.onsetStrategyKey);
  let onsetState = onsetStrategy.createState();
  let lastOnsetResult = null;

  const frames = [];
  const onsets = [];

  for (let i = 0; i < onsetFrames.length; i++) {
    const { samples: frame, frequencyData } = onsetFrames[i];
    const tCenter = (i * onsetHopSize + onsetFftSize / 2) / sampleRate;

    // Signalqualität
    const level = analyzeInputLevel(frame);

    // Onset-Erkennung
    const onsetResult = onsetStrategy.update(onsetState, { frequencyData, samples: frame });
    onsetState = onsetResult.nextState;
    lastOnsetResult = onsetResult;

    const isOnset = onsetResult.event === 'onset';
    if (isOnset) {
      onsets.push(tCenter);
    }

    // Map nearest pitch data to this onset frame
    const nearest = findNearestPitchData(pitchData, tCenter);

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
      hz: nearest?.hz ?? null,
      note: nearest?.note ?? null,
      octave: nearest?.octave ?? null,
      cents: nearest?.cents ?? null,
    });
  }

  return {
    frames,
    onsets,
    sampleRate,
    onsetFftSize: onsetFrameResult.actualFftSize,
    onsetHopSize: onsetFrameResult.actualHopSize,
    pitchFftSize: pitchFrameResult.actualFftSize,
    pitchHopSize: pitchFrameResult.actualHopSize,
    // Legacy aliases for existing consumers (e.g. audioAnalyse.js showStats)
    fftSize: onsetFrameResult.actualFftSize,
    hopSize: onsetFrameResult.actualHopSize,
    duration,
    onsetOptions: lastOnsetResult?.options ?? null,
  };
}

/** Finds the pitch data entry whose time is closest to tSec. */
function findNearestPitchData(pitchData, tSec) {
  if (!pitchData.length) return null;
  let best = pitchData[0];
  let bestDist = Math.abs(pitchData[0].t - tSec);
  for (let i = 1; i < pitchData.length; i++) {
    const dist = Math.abs(pitchData[i].t - tSec);
    if (dist < bestDist) { bestDist = dist; best = pitchData[i]; }
  }
  return best;
}

function parsePitch(pitch) {
  const match = /^([A-G]#?)(-?\d+)$/.exec(pitch ?? '');
  if (!match) return null;
  return { name: match[1], octave: Number.parseInt(match[2], 10) };
}
