// Pitch-class bin: C=0, C#=1, D=2, D#=3, E=4, F=5, F#=6, G=7, G#=8, A=9, A#=10, B=11
export const NOTE_TO_BIN = { C: 0, 'C#': 1, D: 2, 'D#': 3, E: 4, F: 5, 'F#': 6, G: 7, 'G#': 8, A: 9, 'A#': 10, B: 11 };
export const GERMAN_TO_BIN = {
  C: 0,
  Cis: 1, Des: 1,
  D: 2,
  Dis: 3, Es: 3,
  E: 4, Fes: 4,
  Eis: 5,
  F: 5,
  Fis: 6, Ges: 6,
  G: 7,
  Gis: 8, As: 8,
  A: 9,
  Ais: 10, B: 10,
  H: 11,
};
export const TYPE_INTERVALS = {
  Dur: [0, 4, 7],
  Moll: [0, 3, 7],
  dim: [0, 3, 6],
  '7': [0, 4, 7, 10],
  '7sus4': [0, 5, 7, 10],
  maj7: [0, 4, 7, 11],
  m7: [0, 3, 7, 10],
  sus2: [0, 2, 7],
  sus4: [0, 5, 7],
  add9: [0, 4, 7, 2],
};

export const DEFAULT_PROFILE = {
  weights: {
    supportMean: 0.48,
    root: 0.22,
    fifth: 0.12,
    expectedThird: 0.12,
    expectedSeventh: 0,
    leakageMean: 0.18,
    competingThird: 0.04,
  },
  threshold: 0.5,
  bestMatchTolerance: 0.12,
  minRootEnergy: 0.2,
  minFifthEnergy: 0.12,
  minExpectedThirdEnergy: 0.05,
  minSupportMean: 0.32,
  minSeventhEnergy: 0,
  minBassFundamentalToNeighborRatio: 0.05,
};

export const CHORD_TYPE_PROFILES = {
  add9: {
    ...DEFAULT_PROFILE,
    threshold: 0.6,
    minSupportMean: 0.36,
  },
  maj7: {
    ...DEFAULT_PROFILE,
    threshold: 0.54,
    minSupportMean: 0.34,
    minSeventhEnergy: 0.18,
  },
  m7: {
    ...DEFAULT_PROFILE,
    threshold: 0.54,
    sameRootTolerance: 0.06,
    minSupportMean: 0.34,
    minSeventhEnergy: 0.2,
  },
  sus2: {
    ...DEFAULT_PROFILE,
    threshold: 0.58,
    minSupportMean: 0.34,
  },
  sus4: {
    ...DEFAULT_PROFILE,
    threshold: 0.58,
    minSupportMean: 0.34,
  },
  '7': {
    weights: {
      supportMean: 0.42,
      root: 0.18,
      fifth: 0.08,
      expectedThird: 0.1,
      expectedSeventh: 0.22,
      leakageMean: 0.12,
      competingThird: 0.03,
    },
    threshold: 0.26,
    bestMatchTolerance: 0.2,
    minRootEnergy: 0.1,
    minFifthEnergy: 0.04,
    minExpectedThirdEnergy: 0.05,
    minSupportMean: 0.26,
    minSeventhEnergy: 0.05,
    minDominantVariantConfidence: 0.45,
  },
  '7sus4': {
    weights: {
      supportMean: 0.42,
      root: 0.18,
      fifth: 0.08,
      expectedThird: 0,
      expectedSeventh: 0.22,
      leakageMean: 0.12,
      competingThird: 0.03,
    },
    threshold: 0.3,
    bestMatchTolerance: 0.12,
    minRootEnergy: 0.1,
    minFifthEnergy: 0.04,
    minExpectedThirdEnergy: 0,
    minSupportMean: 0.28,
    minSeventhEnergy: 0.08,
  },
};
export const BASS_VARIANT_COUNTERPART = {
  'C-Dur': 'C-Dur (1-Finger)',
  'C-Dur (1-Finger)': 'C-Dur',
  'G-Dur': 'G-Dur (1-Finger)',
  'G-Dur (1-Finger)': 'G-Dur',
};
export const BASS_VARIANT_FUND_FACTOR = 1.1;

// Sus-identity pairs share the same pitch classes but have different bass roots.
// H1-fundamentals at low guitar frequencies are unreliable (body resonance distorts
// the spectrum), so a higher tolerance factor is required vs Phase-3 octave pairs.
export const SUS_IDENTITY_COUNTERPART = {
  'Csus4': 'Fsus2',
  'Fsus2': 'Csus4',
  'Csus2': 'Gsus4',
  'Gsus4': 'Csus2',
  'Asus2': 'Esus4',
  'Esus4': 'Asus2',
  'Asus4': 'Dsus2',
  'Dsus2': 'Asus4',
};
export const SUS_IDENTITY_FUND_FACTOR = 5;

export const MIN_TRIAD_THIRD_SEPARATION = 0.05;
export const MIN_SUSPENSION_ENERGY = 0.18;
export const MAX_SUSPENSION_COMPETING_THIRD_ENERGY = 0.3;
export const MIN_ADD9_ENERGY = 0.18;
export const MIN_ADD9_THIRD_ENERGY = 0.3;
export const MIN_ADD9_TO_SECOND_RATIO = 0.5;
export const MIN_MAJOR_TRIAD_DOMINANT_SEVENTH_LEAKAGE = 0.08;
export const MIN_MAJOR_SEVENTH_RATIO = 0.6;
export const MIN_MINOR_SEVENTH_RATIO = 0.25;
export const MIN_DOMINANT_VARIANT_SEVENTH_ENERGY = 0.09;
export const MAX_SPARSE_DOMINANT_THIRD_ENERGY = 0.3;
export const MIN_SPARSE_DOMINANT_FIFTH_ENERGY = 0.8;
export const MIN_SUSPENSION_TO_THIRD_RATIO = 1.2;
export const OPEN_STRUM_CANDIDATE_NAME = 'open-strum';
export const OPEN_STRUM_BASE_BINS = [4, 9, 2, 7, 11];
export const OPEN_STRUM_TEMPLATE_OFFSETS = [0, 1, 2, 3, 4, 5];
export const OPEN_STRUM_THRESHOLD = 0.45;
export const OPEN_STRUM_BEST_CHORD_MARGIN = 0.22;
