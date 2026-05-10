import {
  classifyFrame,
  getRecommendedFftSize,
  updateMatchState,
} from '../../shared/audio/fastNoteMatcher.js';
import { noteToFrequency } from '../../shared/audio/guitarPitchDetection.js';

export const SHEET_MUSIC_RECOGNITION_STRATEGY_KEYS = {
  FAST_NOTE_MATCHER: 'fast-note-matcher',
};

export const SHEET_MUSIC_CENTS_TOLERANCE = 70;
export const SHEET_MUSIC_ACCEPT_STREAK = 1;
export const SHEET_MUSIC_TARGET_HARMONIC_THRESHOLD = 0.55;

function parsePitch(pitch) {
  const match = /^([A-G]#?)(-?\d+)$/.exec(pitch ?? '');
  if (!match) return null;
  return { name: match[1], octave: Number.parseInt(match[2], 10) };
}

export function softenSheetMusicFrameResult(frameResult, targetPitch) {
  if (frameResult.status === 'correct') return frameResult;
  if (frameResult.status !== 'wrong' || !frameResult.detectedPitch) return frameResult;

  const target = parsePitch(targetPitch);
  const detected = parsePitch(frameResult.detectedPitch);
  if (
    target?.name === 'D'
    && target.octave === 3
    && detected?.name === 'D'
    && detected.octave === 2
  ) {
    return { ...frameResult, status: 'correct' };
  }
  return frameResult;
}

function frameRms(samples) {
  let sum = 0;
  for (let i = 0; i < samples.length; i++) {
    sum += samples[i] * samples[i];
  }
  return Math.sqrt(sum / Math.max(1, samples.length));
}

function harmonicAmplitude(samples, sampleRate, frequency) {
  let re = 0;
  let im = 0;
  const windowDenominator = Math.max(1, samples.length - 1);
  for (let i = 0; i < samples.length; i++) {
    const window = 0.5 * (1 - Math.cos((2 * Math.PI * i) / windowDenominator));
    const phase = (2 * Math.PI * frequency * i) / sampleRate;
    const sample = samples[i] * window;
    re += sample * Math.cos(phase);
    im -= sample * Math.sin(phase);
  }
  return Math.hypot(re, im) / Math.max(1, samples.length / 2);
}

export function getSheetMusicTargetHarmonicScore(samples, sampleRate, targetPitch) {
  const target = parsePitch(targetPitch);
  if (!target) return 0;

  const targetHz = noteToFrequency(target.name, target.octave);
  const rms = frameRms(samples);
  if (rms <= 0) return 0;

  let weighted = 0;
  let weightTotal = 0;
  const harmonicWeights = [1, 0.75, 0.5];
  for (let harmonic = 1; harmonic <= harmonicWeights.length; harmonic++) {
    const frequency = targetHz * harmonic;
    if (frequency >= sampleRate / 2) continue;
    const weight = harmonicWeights[harmonic - 1];
    weighted += harmonicAmplitude(samples, sampleRate, frequency) * weight;
    weightTotal += weight;
  }

  return weightTotal > 0 ? weighted / rms : 0;
}

export function classifyFastNoteMatcherSheetMusicFrame(samples, sampleRate, targetPitch, options = {}) {
  const frameResult = softenSheetMusicFrameResult(
    classifyFrame(samples, sampleRate, targetPitch, {
      tolerateCents: options.tolerateCents ?? SHEET_MUSIC_CENTS_TOLERANCE,
      minRms: options.minRms,
    }),
    targetPitch,
  );

  if (frameResult.status === 'correct') return frameResult;

  const target = parsePitch(targetPitch);
  const threshold = options.targetHarmonicThreshold ?? SHEET_MUSIC_TARGET_HARMONIC_THRESHOLD;
  const targetHarmonicScore = getSheetMusicTargetHarmonicScore(samples, sampleRate, targetPitch);
  if (target && targetHarmonicScore >= threshold) {
    return {
      ...frameResult,
      status: 'correct',
      detectedPitch: targetPitch,
      hz: noteToFrequency(target.name, target.octave),
      cents: 0,
      targetHarmonicScore,
    };
  }

  return { ...frameResult, targetHarmonicScore };
}

export const SHEET_MUSIC_RECOGNITION_STRATEGIES = [
  {
    key: SHEET_MUSIC_RECOGNITION_STRATEGY_KEYS.FAST_NOTE_MATCHER,
    label: 'fast-note-matcher',
    description: 'Aktuelle JS-Erkennung mit YIN/HPS, Sheet-Toleranz und Zielton-Harmonik.',
    classifyFrame: classifyFastNoteMatcherSheetMusicFrame,
    getRecommendedFftSize,
  },
];

export function getSheetMusicRecognitionStrategies() {
  return SHEET_MUSIC_RECOGNITION_STRATEGIES;
}

export function resolveSheetMusicRecognitionStrategy(strategyKey) {
  return SHEET_MUSIC_RECOGNITION_STRATEGIES.find(strategy => strategy.key === strategyKey)
    ?? SHEET_MUSIC_RECOGNITION_STRATEGIES[0];
}

export function classifySheetMusicFrame(samples, sampleRate, targetPitch, options = {}) {
  const strategy = resolveSheetMusicRecognitionStrategy(options.strategyKey);
  return strategy.classifyFrame(samples, sampleRate, targetPitch, options);
}

export function updateSheetMusicMatchState(matchState, frameResult) {
  if (SHEET_MUSIC_ACCEPT_STREAK <= 1 && frameResult.status === 'correct') {
    return {
      nextState: {
        ...matchState,
        correctStreak: 1,
        wrongStreak: 0,
        accepted: true,
      },
      event: 'accept',
    };
  }
  return updateMatchState(matchState, frameResult);
}
