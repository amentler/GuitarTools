import path from 'path';
import { fileURLToPath } from 'url';
import { readWavFile } from './wavDecoder.js';
import {
  findStrumOnsetSample,
  computeDbSpectrum,
} from './chordHpcpExtraction.js';
import { getChordBassNote } from '../../js/domain/chords/chordDetectionLogic.js';
import {
  buildBassNeighborScores,
  buildBassSupportByChord,
} from '../../js/games/chordExerciseEssentia/essentiaBassScore.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CHORD_FIXTURES_DIR = path.join(__dirname, '../fixtures/chords');
const CHORD_BASS_FFT_SIZE = 16384;
const CHORD_BASS_FRAME_OFFSET_MS = 20;

export function extractBassScoreForChordFromSamples(samples, sampleRate, chordName, options = {}) {
  const bassNote = getChordBassNote(chordName);
  if (!bassNote) return null;

  const onsetSample = findStrumOnsetSample(samples, sampleRate);
  const frameOffsetSamples = Math.floor(sampleRate * (options.frameOffsetMs ?? CHORD_BASS_FRAME_OFFSET_MS) / 1000);
  const frameStart = Math.min(
    Math.max(0, onsetSample + frameOffsetSamples),
    Math.max(0, samples.length - CHORD_BASS_FFT_SIZE),
  );
  const frame = samples.slice(frameStart, frameStart + CHORD_BASS_FFT_SIZE);
  const spectrum = computeDbSpectrum(frame, CHORD_BASS_FFT_SIZE);

  return {
    bassNote,
    onsetSample,
    frameStart,
    spectrum,
    ...buildBassNeighborScores(spectrum, sampleRate, bassNote, options),
  };
}

export function extractBassScoreForChordFromWav(relativeWavFile, chordName, options = {}) {
  const { samples, sampleRate } = readWavFile(path.join(CHORD_FIXTURES_DIR, relativeWavFile));
  return extractBassScoreForChordFromSamples(samples, sampleRate, chordName, options);
}

export function extractBassSupportMapFromSamples(samples, sampleRate, chordNames, options = {}) {
  const onsetSample = findStrumOnsetSample(samples, sampleRate);
  const frameOffsetSamples = Math.floor(sampleRate * (options.frameOffsetMs ?? CHORD_BASS_FRAME_OFFSET_MS) / 1000);
  const frameStart = Math.min(
    Math.max(0, onsetSample + frameOffsetSamples),
    Math.max(0, samples.length - CHORD_BASS_FFT_SIZE),
  );
  const frame = samples.slice(frameStart, frameStart + CHORD_BASS_FFT_SIZE);
  const spectrum = computeDbSpectrum(frame, CHORD_BASS_FFT_SIZE);

  return buildBassSupportByChord(spectrum, sampleRate, chordNames, options);
}

export function extractBassSupportMapFromWav(relativeWavFile, chordNames, options = {}) {
  const { samples, sampleRate } = readWavFile(path.join(CHORD_FIXTURES_DIR, relativeWavFile));
  return extractBassSupportMapFromSamples(samples, sampleRate, chordNames, options);
}
