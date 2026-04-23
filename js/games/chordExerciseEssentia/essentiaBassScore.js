import { NOTE_NAMES, noteToFrequency } from '../../domain/pitch/pitchCore.js';
import { getChordBassNote } from '../../domain/chords/chordDetectionLogic.js';

const DEFAULT_SEARCH_CENTS = 20;
const DEFAULT_HARMONICS = [1, 2, 3, 4, 5];
const DEFAULT_HARMONIC_WEIGHTS = [1.2, 1, 0.8, 0.6, 0.5];

function midiToCandidate(midi) {
  const note = NOTE_NAMES[((midi % 12) + 12) % 12];
  const octave = Math.floor(midi / 12) - 1;
  return {
    midi,
    note,
    octave,
    label: `${note}${octave}`,
    frequency: noteToFrequency(note, octave),
  };
}

function findPeakLinearMagnitudeNearFrequency(freqData, sampleRate, targetFrequency, searchCents = DEFAULT_SEARCH_CENTS) {
  const frequencyBinWidth = sampleRate / (freqData.length * 2);
  const minFrequency = targetFrequency * Math.pow(2, -searchCents / 1200);
  const maxFrequency = targetFrequency * Math.pow(2, searchCents / 1200);
  const minBin = Math.max(0, Math.floor(minFrequency / frequencyBinWidth));
  const maxBin = Math.min(freqData.length - 1, Math.ceil(maxFrequency / frequencyBinWidth));

  let maxMagnitude = 0;
  for (let bin = minBin; bin <= maxBin; bin++) {
    const db = freqData[bin];
    if (!Number.isFinite(db)) continue;
    maxMagnitude = Math.max(maxMagnitude, Math.pow(10, db / 20));
  }

  return maxMagnitude;
}

export function scoreBassCandidateFromSpectrum(freqData, sampleRate, candidateFrequency, options = {}) {
  const harmonics = options.harmonics ?? DEFAULT_HARMONICS;
  const harmonicWeights = options.harmonicWeights ?? DEFAULT_HARMONIC_WEIGHTS;
  const searchCents = options.searchCents ?? DEFAULT_SEARCH_CENTS;
  const maxFrequency = options.maxFrequency ?? 900;

  let score = 0;
  for (let i = 0; i < harmonics.length; i++) {
    const harmonicFrequency = candidateFrequency * harmonics[i];
    if (harmonicFrequency > maxFrequency) break;
    const weight = harmonicWeights[i] ?? 0;
    score += weight * findPeakLinearMagnitudeNearFrequency(freqData, sampleRate, harmonicFrequency, searchCents);
  }

  return score;
}

export function buildBassNeighborScores(freqData, sampleRate, bassNote, options = {}) {
  const bassMidi = (bassNote.octave + 1) * 12 + NOTE_NAMES.indexOf(bassNote.note);
  const lowerNeighbor = midiToCandidate(bassMidi - 1);
  const expected = midiToCandidate(bassMidi);
  const upperNeighbor = midiToCandidate(bassMidi + 1);

  return {
    lowerNeighbor: {
      ...lowerNeighbor,
      score: scoreBassCandidateFromSpectrum(freqData, sampleRate, lowerNeighbor.frequency, options),
    },
    expected: {
      ...expected,
      score: scoreBassCandidateFromSpectrum(freqData, sampleRate, expected.frequency, options),
    },
    upperNeighbor: {
      ...upperNeighbor,
      score: scoreBassCandidateFromSpectrum(freqData, sampleRate, upperNeighbor.frequency, options),
    },
  };
}

export function evaluateBassSupportForChord(freqData, sampleRate, chordName, options = {}) {
  const bassNote = getChordBassNote(chordName);
  if (!bassNote) return null;

  const neighborhood = buildBassNeighborScores(freqData, sampleRate, bassNote, options);
  const strongestNeighbor = Math.max(neighborhood.lowerNeighbor.score, neighborhood.upperNeighbor.score);
  const denominator = Math.max(neighborhood.expected.score, strongestNeighbor, 1e-9);
  const margin = (neighborhood.expected.score - strongestNeighbor) / denominator;

  return {
    chordName,
    bassNote,
    ...neighborhood,
    strongestNeighbor,
    margin,
    isLocallyDominant: neighborhood.expected.score > strongestNeighbor,
  };
}

export function buildBassSupportByChord(freqData, sampleRate, chordNames, options = {}) {
  return Object.fromEntries(
    chordNames.map(chordName => [chordName, evaluateBassSupportForChord(freqData, sampleRate, chordName, options)]),
  );
}
