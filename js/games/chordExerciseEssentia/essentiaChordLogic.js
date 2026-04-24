/**
 * essentiaChordLogic.js
 * Pure functions for HPCP-based chord matching.
 * No DOM, no audio, no WASM – fully unit-testable.
 *
 * Approach: compare a 12-bin HPCP vector against chord templates
 * using cosine similarity. Templates are derived from akkordData.js.
 */

import { CHORDS } from '../../data/akkordData.js';
import { getChordNotes } from '../../domain/chords/chordDetectionLogic.js';

// Pitch-class bin: C=0, C#=1, D=2, D#=3, E=4, F=5, F#=6, G=7, G#=8, A=9, A#=10, B=11
const NOTE_TO_BIN = { C: 0, 'C#': 1, D: 2, 'D#': 3, E: 4, F: 5, 'F#': 6, G: 7, 'G#': 8, A: 9, 'A#': 10, B: 11 };
const GERMAN_TO_BIN = {
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
const TYPE_INTERVALS = {
  Dur: [0, 4, 7],
  Moll: [0, 3, 7],
  dim: [0, 3, 6],
  '7': [0, 4, 7, 10],
  maj7: [0, 4, 7, 11],
  m7: [0, 3, 7, 10],
  sus2: [0, 2, 7],
  sus4: [0, 5, 7],
  add9: [0, 4, 7, 2],
};

const DEFAULT_PROFILE = {
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
};

const CHORD_TYPE_PROFILES = {
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
    minSupportMean: 0.34,
    minSeventhEnergy: 0.12,
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
    minSeventhEnergy: 0.002,
  },
};
const MIN_TRIAD_THIRD_SEPARATION = 0.05;
const MIN_SUSPENSION_ENERGY = 0.18;
const MIN_ADD9_ENERGY = 0.18;
const MIN_MAJOR_TRIAD_DOMINANT_SEVENTH_LEAKAGE = 0.08;
const MIN_MAJOR_SEVENTH_RATIO = 0.6;
const MIN_MINOR_SEVENTH_RATIO = 0.25;
const MIN_DOMINANT_VARIANT_SEVENTH_ENERGY = 0.09;
const MIN_SUSPENSION_TO_THIRD_RATIO = 0.6;

function stripChordAnnotation(chordName) {
  return chordName.replace(/\s*\([^)]*\)\s*$/, '').trim();
}

function parseChordDescriptor(chordName) {
  if (!chordName || typeof chordName !== 'string') return null;

  const cleaned = stripChordAnnotation(chordName);

  const hyphenMatch = cleaned.match(/^([A-Z][a-z]*)-([A-Za-z0-9]+)$/);
  if (hyphenMatch) {
    const root = hyphenMatch[1];
    const type = hyphenMatch[2];
    if (GERMAN_TO_BIN[root] !== undefined && TYPE_INTERVALS[type] !== undefined) {
      return { root, type };
    }
  }

  const suffixes = ['maj7', 'm7', 'sus2', 'sus4', 'add9', 'dim'];
  for (const suffix of suffixes) {
    if (!cleaned.endsWith(suffix)) continue;
    const root = cleaned.slice(0, -suffix.length);
    if (GERMAN_TO_BIN[root] !== undefined) return { root, type: suffix };
  }

  const dom7Match = cleaned.match(/^([A-Z][a-z]*)7$/);
  if (dom7Match) {
    const root = dom7Match[1];
    if (GERMAN_TO_BIN[root] !== undefined) {
      return { root, type: '7' };
    }
  }

  return null;
}

function getChordDescriptor(chordName) {
  const parsed = parseChordDescriptor(chordName);
  if (!parsed) return null;

  const rootBin = GERMAN_TO_BIN[parsed.root];
  const intervals = TYPE_INTERVALS[parsed.type];
  if (rootBin === undefined || !intervals) return null;

  const descriptor = {
    type: parsed.type,
    rootBin,
    fifthBin: (rootBin + 7) % 12,
    expectedThirdBin: null,
    expectedSecondBin: null,
    expectedFourthBin: null,
    competingThirdBin: null,
    expectedSeventhBin: null,
    extensionSecondBin: null,
  };

  if (['Dur', '7', 'maj7', 'add9'].includes(parsed.type)) {
    descriptor.expectedThirdBin = (rootBin + 4) % 12;
    descriptor.competingThirdBin = (rootBin + 3) % 12;
  } else if (['Moll', 'm7', 'dim'].includes(parsed.type)) {
    descriptor.expectedThirdBin = (rootBin + 3) % 12;
    descriptor.competingThirdBin = (rootBin + 4) % 12;
  }

  if (parsed.type === '7') {
    descriptor.expectedSeventhBin = (rootBin + 10) % 12;
  } else if (parsed.type === 'maj7') {
    descriptor.expectedSeventhBin = (rootBin + 11) % 12;
  } else if (parsed.type === 'm7') {
    descriptor.expectedSeventhBin = (rootBin + 10) % 12;
  }

  if (parsed.type === 'sus2' || parsed.type === 'add9') {
    descriptor.expectedSecondBin = (rootBin + 2) % 12;
  }
  if (parsed.type === 'sus4') {
    descriptor.expectedFourthBin = (rootBin + 5) % 12;
  }

  if (!intervals.includes(2)) {
    descriptor.extensionSecondBin = (rootBin + 2) % 12;
  }

  return descriptor;
}

const CHORD_MATCH_SPECIAL_CASES = {
  'A-Moll (2-Finger)': {
    acceptedBestMatches: ['A-Moll (2-Finger)', 'Asus2'],
    allowAddedSecond: true,
  },
};
const CHORD_MATCH_EQUIVALENT_TARGETS = {
  'E-Moll (2-Finger)': 'E-Moll',
};

function getEffectiveTargetChordName(chordName) {
  return CHORD_MATCH_EQUIVALENT_TARGETS[chordName] ?? chordName;
}

function getChordProfile(descriptor) {
  if (!descriptor) return DEFAULT_PROFILE;
  return CHORD_TYPE_PROFILES[descriptor.type] ?? DEFAULT_PROFILE;
}

function sharesRoot(descriptorA, descriptorB) {
  if (!descriptorA || !descriptorB) return false;
  return descriptorA.rootBin === descriptorB.rootBin;
}

function isTriadModeSensitive(descriptor) {
  if (!descriptor) return false;
  return descriptor.type === 'Dur' || descriptor.type === 'Moll';
}

function isAnnotatedVariant(chordName) {
  const annotation = chordName.match(/\(([^)]*)\)/)?.[1]?.trim();
  if (!annotation) return false;

  return /finger|rock|klein/i.test(annotation);
}

function getMeanEnergy(hpcp, template, includeTemplateBins) {
  let sum = 0;
  let count = 0;
  for (let i = 0; i < hpcp.length; i++) {
    const isActive = template[i] > 0;
    if (isActive !== includeTemplateBins) continue;
    sum += hpcp[i];
    count += 1;
  }
  return count > 0 ? sum / count : 0;
}

function clampConfidence(score) {
  return Math.max(0, Math.min(1, score));
}

function scoreHpcpAgainstChord(hpcp, template, descriptor) {
  const profile = getChordProfile(descriptor);
  const weights = profile.weights;
  const supportMean = getMeanEnergy(hpcp, template, true);
  const leakageMean = getMeanEnergy(hpcp, template, false);
  let rootEnergy = 0;
  let fifthEnergy = 0;
  let expectedThirdEnergy = 0;
  let expectedSecondEnergy = 0;
  let expectedFourthEnergy = 0;
  let expectedSeventhEnergy = 0;
  let competingThirdEnergy = 0;
  let extensionSecondEnergy = 0;

  if (descriptor) {
    rootEnergy = hpcp[descriptor.rootBin];
    fifthEnergy = hpcp[descriptor.fifthBin];
    if (descriptor.expectedThirdBin !== null) {
      expectedThirdEnergy = hpcp[descriptor.expectedThirdBin];
    }
    if (descriptor.expectedSecondBin !== null) {
      expectedSecondEnergy = hpcp[descriptor.expectedSecondBin];
    }
    if (descriptor.expectedFourthBin !== null) {
      expectedFourthEnergy = hpcp[descriptor.expectedFourthBin];
    }
    if (descriptor.competingThirdBin !== null) {
      competingThirdEnergy = hpcp[descriptor.competingThirdBin];
    }
    if (descriptor.expectedSeventhBin !== null) {
      expectedSeventhEnergy = hpcp[descriptor.expectedSeventhBin];
    }
    if (descriptor.extensionSecondBin !== null) {
      extensionSecondEnergy = hpcp[descriptor.extensionSecondBin];
    }
  }

  const rawScore =
    weights.supportMean * supportMean +
    weights.root * rootEnergy +
    weights.fifth * fifthEnergy +
    weights.expectedThird * expectedThirdEnergy +
    weights.expectedSeventh * expectedSeventhEnergy -
    weights.leakageMean * leakageMean -
    weights.competingThird * competingThirdEnergy;
  const maxPositiveScore =
    weights.supportMean +
    (descriptor ? weights.root + weights.fifth : 0) +
    (descriptor && descriptor.expectedThirdBin !== null ? weights.expectedThird : 0) +
    (descriptor && descriptor.expectedSeventhBin !== null ? weights.expectedSeventh : 0);
  const normalizedScore = maxPositiveScore > 0 ? rawScore / maxPositiveScore : rawScore;

  return {
    profile,
    supportMean,
    leakageMean,
    rootEnergy,
    fifthEnergy,
    expectedThirdEnergy,
    expectedSecondEnergy,
    expectedFourthEnergy,
    expectedSeventhEnergy,
    competingThirdEnergy,
    extensionSecondEnergy,
    rawScore,
    score: clampConfidence(normalizedScore),
  };
}

function scoreChordCandidates(hpcp, templates) {
  let bestMatch = null;
  let bestScore = -1;
  let bestDescriptor = null;
  const scoreByChordName = new Map();

  for (const [name, template] of Object.entries(templates)) {
    const descriptor = getChordDescriptor(name);
    const score = scoreHpcpAgainstChord(hpcp, template, descriptor).score;
    scoreByChordName.set(name, score);
    if (score > bestScore) {
      bestScore = score;
      bestMatch = name;
      bestDescriptor = descriptor;
    }
  }

  return {
    bestMatch,
    bestScore,
    bestDescriptor,
    scoreByChordName,
  };
}

function evaluateRootAndBassEvidence(targetDescriptor, targetEvidence, profile, targetBassSupport) {
  const hasStrongRoot = !targetDescriptor || targetEvidence.rootEnergy >= profile.minRootEnergy;
  const hasStrongFifth = !targetDescriptor || targetEvidence.fifthEnergy >= profile.minFifthEnergy;
  const hasExpectedBass = !targetBassSupport || targetBassSupport.isLocallyDominant;

  return {
    hasStrongRoot,
    hasStrongFifth,
    hasExpectedBass,
  };
}

function evaluateTriadQualityEvidence(targetDescriptor, targetEvidence, profile) {
  const hasExpectedThird = !targetDescriptor ||
    targetDescriptor.expectedSeventhBin === null ||
    targetDescriptor.expectedThirdBin === null ||
    targetEvidence.expectedThirdEnergy >= profile.minExpectedThirdEnergy;
  const hasSeparatedTriadThird = !isTriadModeSensitive(targetDescriptor) ||
    targetEvidence.expectedThirdEnergy > targetEvidence.competingThirdEnergy + MIN_TRIAD_THIRD_SEPARATION;

  return {
    hasExpectedThird,
    hasSeparatedTriadThird,
  };
}

function evaluateChordExtensionEvidence(targetDescriptor, targetEvidence, profile, hpcp) {
  const hasExpectedSeventh = !targetDescriptor || targetEvidence.expectedSeventhEnergy >= profile.minSeventhEnergy;
  const hasControlledAddedSecond = !targetDescriptor ||
    targetDescriptor.type === '7' ||
    targetDescriptor.extensionSecondBin === null ||
    targetEvidence.fifthEnergy >= targetEvidence.extensionSecondEnergy;
  const hasControlledDominantSecondLeakage = !targetDescriptor ||
    targetDescriptor.type !== '7' ||
    targetEvidence.fifthEnergy >= targetEvidence.extensionSecondEnergy ||
    targetEvidence.expectedSeventhEnergy >= targetEvidence.extensionSecondEnergy;
  const hasSuspensionEvidence = !targetDescriptor ||
    (targetDescriptor.type !== 'sus2' && targetDescriptor.type !== 'sus4') ||
    (
      (targetDescriptor.type === 'sus2'
        ? targetEvidence.expectedSecondEnergy
        : targetEvidence.expectedFourthEnergy) >= MIN_SUSPENSION_ENERGY &&
      (targetDescriptor.type === 'sus2'
        ? targetEvidence.expectedSecondEnergy
        : targetEvidence.expectedFourthEnergy) >= targetEvidence.expectedThirdEnergy * MIN_SUSPENSION_TO_THIRD_RATIO &&
      (targetDescriptor.type === 'sus2'
        ? targetEvidence.expectedSecondEnergy
        : targetEvidence.expectedFourthEnergy) > targetEvidence.competingThirdEnergy
    );
  const hasAdd9Evidence = !targetDescriptor ||
    targetDescriptor.type !== 'add9' ||
    (
      targetEvidence.expectedSecondEnergy >= MIN_ADD9_ENERGY &&
      targetEvidence.expectedSecondEnergy >= targetEvidence.expectedThirdEnergy * 0.4
    );
  const hasMajorSeventhEvidence = !targetDescriptor ||
    targetDescriptor.type !== 'maj7' ||
    (
      targetEvidence.expectedSeventhEnergy >= profile.minSeventhEnergy &&
      targetEvidence.expectedSeventhEnergy >= targetEvidence.expectedThirdEnergy * MIN_MAJOR_SEVENTH_RATIO
    );
  const hasMinorSeventhEvidence = !targetDescriptor ||
    targetDescriptor.type !== 'm7' ||
    (
      targetEvidence.expectedSeventhEnergy >= profile.minSeventhEnergy &&
      targetEvidence.expectedSeventhEnergy >= targetEvidence.expectedThirdEnergy * MIN_MINOR_SEVENTH_RATIO
    );
  const hasControlledDominantSeventhLeakage = !targetDescriptor ||
    targetDescriptor.type !== 'Dur' ||
    hpcp[(targetDescriptor.rootBin + 10) % 12] < MIN_MAJOR_TRIAD_DOMINANT_SEVENTH_LEAKAGE;

  return {
    hasExpectedSeventh,
    hasControlledAddedSecond,
    hasControlledDominantSecondLeakage,
    hasSuspensionEvidence,
    hasAdd9Evidence,
    hasMajorSeventhEvidence,
    hasMinorSeventhEvidence,
    hasControlledDominantSeventhLeakage,
  };
}

function evaluateAnnotatedTargetAcceptance(targetChordName, effectiveTargetChordName, specialCase, bestMatch) {
  const requiresExactAnnotatedMatch = isAnnotatedVariant(effectiveTargetChordName) && !specialCase;
  const hasExactAnnotatedMatch = !requiresExactAnnotatedMatch || bestMatch === effectiveTargetChordName;

  return {
    requiresExactAnnotatedMatch,
    hasExactAnnotatedMatch,
  };
}

function evaluateBestMatchCompatibility({
  targetDescriptor,
  bestDescriptor,
  targetEvidence,
  profile,
  bestScore,
  confidence,
  bestMatch,
  targetTemplate,
  templates,
}) {
  const hasDominantSeventhEvidence = targetDescriptor?.expectedSeventhBin !== null &&
    targetEvidence.rootEnergy <= 0.15;
  const passesBestMatchTolerance = bestScore - confidence <= profile.bestMatchTolerance &&
    (!targetDescriptor || sharesRoot(targetDescriptor, bestDescriptor) || hasDominantSeventhEvidence);
  const allowsCrossRootSubset = !targetDescriptor || targetDescriptor.expectedSeventhBin === null;
  const passesSubsetAcceptance = isSubsetOf(templates[bestMatch], targetTemplate) &&
    (allowsCrossRootSubset || sharesRoot(targetDescriptor, bestDescriptor));
  const passesDominantSeventhVariantAcceptance = Boolean(
    targetDescriptor?.type === '7' &&
    bestDescriptor &&
    sharesRoot(targetDescriptor, bestDescriptor) &&
    targetEvidence.expectedSeventhEnergy >= MIN_DOMINANT_VARIANT_SEVENTH_ENERGY &&
    confidence >= profile.threshold,
  );

  return {
    hasDominantSeventhEvidence,
    passesBestMatchTolerance,
    passesSubsetAcceptance,
    passesDominantSeventhVariantAcceptance,
  };
}

function findBestAcceptedAlias(specialCase, scoreByChordName) {
  let bestAcceptedAliasName = null;
  let bestAcceptedAliasScore = -1;

  if (!specialCase) {
    return {
      bestAcceptedAliasName,
      bestAcceptedAliasScore,
    };
  }

  for (const name of specialCase.acceptedBestMatches) {
    const score = scoreByChordName.get(name) ?? -1;
    if (score > bestAcceptedAliasScore) {
      bestAcceptedAliasScore = score;
      bestAcceptedAliasName = name;
    }
  }

  return {
    bestAcceptedAliasName,
    bestAcceptedAliasScore,
  };
}

function passesSpecialCaseAcceptance({
  specialCase,
  bestAcceptedAliasScore,
  threshold,
  rootAndBassEvidence,
  chordExtensionEvidence,
  annotatedTargetAcceptance,
  hasEnoughChordSupport,
}) {
  return Boolean(
    specialCase &&
    bestAcceptedAliasScore >= threshold &&
    rootAndBassEvidence.hasStrongRoot &&
    rootAndBassEvidence.hasStrongFifth &&
    chordExtensionEvidence.hasExpectedSeventh &&
    rootAndBassEvidence.hasExpectedBass &&
    annotatedTargetAcceptance.hasExactAnnotatedMatch &&
    chordExtensionEvidence.hasSuspensionEvidence &&
    chordExtensionEvidence.hasAdd9Evidence &&
    chordExtensionEvidence.hasMajorSeventhEvidence &&
    chordExtensionEvidence.hasMinorSeventhEvidence &&
    chordExtensionEvidence.hasControlledDominantSeventhLeakage &&
    chordExtensionEvidence.hasControlledDominantSecondLeakage &&
    (specialCase.allowAddedSecond || chordExtensionEvidence.hasControlledAddedSecond) &&
    hasEnoughChordSupport
  );
}

function passesCoreEvidence({
  confidence,
  threshold,
  rootAndBassEvidence,
  triadQualityEvidence,
  chordExtensionEvidence,
  annotatedTargetAcceptance,
  hasEnoughChordSupport,
}) {
  return confidence >= threshold &&
    rootAndBassEvidence.hasStrongRoot &&
    rootAndBassEvidence.hasStrongFifth &&
    triadQualityEvidence.hasExpectedThird &&
    triadQualityEvidence.hasSeparatedTriadThird &&
    chordExtensionEvidence.hasExpectedSeventh &&
    rootAndBassEvidence.hasExpectedBass &&
    annotatedTargetAcceptance.hasExactAnnotatedMatch &&
    chordExtensionEvidence.hasSuspensionEvidence &&
    chordExtensionEvidence.hasAdd9Evidence &&
    chordExtensionEvidence.hasMajorSeventhEvidence &&
    chordExtensionEvidence.hasMinorSeventhEvidence &&
    chordExtensionEvidence.hasControlledDominantSeventhLeakage &&
    chordExtensionEvidence.hasControlledDominantSecondLeakage &&
    chordExtensionEvidence.hasControlledAddedSecond &&
    hasEnoughChordSupport;
}

/**
 * Builds a 12-bin binary template for every chord in akkordData.
 * Each bin is 1 if the pitch class is part of the chord, 0 otherwise.
 *
 * @returns {Object.<string, Float32Array>} map from chord name to 12-bin template
 */
export function buildChordTemplates() {
  const templates = {};
  for (const chordName of Object.keys(CHORDS)) {
    const notes = getChordNotes(chordName);
    const template = new Float32Array(12);
    for (const { note } of notes) {
      const bin = NOTE_TO_BIN[note];
      if (bin !== undefined) template[bin] = 1;
    }
    templates[chordName] = template;
  }
  return templates;
}

/**
 * Cosine similarity between two numeric arrays of equal length.
 * Returns 0 if either vector is all-zero.
 *
 * @param {ArrayLike<number>} a
 * @param {ArrayLike<number>} b
 * @returns {number} similarity in [0, 1]
 */
export function cosineSimilarity(a, b) {
  let dot = 0, normA = 0, normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot   += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  if (normA === 0 || normB === 0) return 0;
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

/**
 * Averages an array of 12-bin HPCP vectors (element-wise mean).
 *
 * @param {Array<ArrayLike<number>>} hpcps
 * @returns {Float32Array} averaged 12-bin vector
 */
export function averageHpcps(hpcps) {
  const avg = new Float32Array(12);
  if (!hpcps.length) return avg;
  for (const h of hpcps) {
    for (let i = 0; i < 12; i++) avg[i] += h[i];
  }
  const n = hpcps.length;
  for (let i = 0; i < 12; i++) avg[i] /= n;
  return avg;
}

/**
 * Computes a 12-bin HPCP vector from spectral peak frequencies and magnitudes
 * in pure JavaScript — no WASM required.
 *
 * referenceFrequency = C4 = 261.626 Hz so that bin 0 = C, matching NOTE_TO_BIN
 * and the templates built by buildChordTemplates().
 *
 * Using A4 = 440 Hz as the reference (as the essentia default does) would shift
 * all bins by +9, making C land on bin 3 and breaking template matching.
 *
 * @param {number[]} peakFreqs         Peak frequencies in Hz
 * @param {number[]} peakMags          Corresponding linear magnitudes
 * @param {number}  [referenceFrequency=261.626]  Frequency of bin 0 (C4)
 * @param {number}  [hpcpSize=12]
 * @param {number}  [windowSize=1]     squaredCosine window width in bins
 * @returns {Float32Array} 12-bin HPCP (values normalised to [0, 1])
 */
export function computeHpcpPureJS(peakFreqs, peakMags, referenceFrequency = 261.626, hpcpSize = 12, windowSize = 1) {
  const hpcp = new Float32Array(hpcpSize);
  const half = windowSize / 2;

  for (let i = 0; i < peakFreqs.length; i++) {
    const f = peakFreqs[i];
    const m = peakMags[i];
    if (f <= 0 || m <= 0) continue;

    // Fractional pitch-class bin position (octave-invariant via modulo)
    const pc = ((hpcpSize * Math.log2(f / referenceFrequency)) % hpcpSize + hpcpSize) % hpcpSize;

    for (let b = 0; b < hpcpSize; b++) {
      let dist = Math.abs(b - pc);
      if (dist > hpcpSize / 2) dist = hpcpSize - dist; // circular wrap
      if (dist <= half) {
        const w = Math.cos((Math.PI * dist) / windowSize);
        hpcp[b] += m * w * w; // squaredCosine weight
      }
    }
  }

  // unitMax normalisation
  let maxVal = 0;
  for (const v of hpcp) if (v > maxVal) maxVal = v;
  if (maxVal > 0) for (let b = 0; b < hpcpSize; b++) hpcp[b] /= maxVal;

  return hpcp;
}

/**
 * Returns true when every active bin of subTemplate is also active in superTemplate.
 * Used to detect when the best-matching chord is a pitch-class subset of the target,
 * which indicates the recording contains all required notes (the cosine denominator
 * effect just favours the smaller template).
 */
function isSubsetOf(subTemplate, superTemplate) {
  for (let i = 0; i < 12; i++) {
    if (subTemplate[i] > 0 && superTemplate[i] === 0) return false;
  }
  return true;
}

/**
 * Matches an HPCP vector against the target chord using cosine similarity.
 *
 * The result is "correct" when:
 *   - the target chord's cosine similarity ≥ threshold, AND one of:
 *     a) the target is the best match overall
 *     b) the best match is within 0.05 of the target (ties / variants)
 *     c) the best match is a pitch-class subset of the target — cosine similarity
 *        systematically favours smaller templates (smaller L2 norm), so if the
 *        top-scoring chord contains only notes that are also in the target, the
 *        recording does contain all required notes and the target should be accepted
 *        (e.g. Esus2 [E,B] ⊂ E-Dur [E,G#,B] when G# is present but weak).
 *
 * @param {ArrayLike<number>} hpcp           12-bin HPCP vector
 * @param {string}            targetChordName chord to match against
 * @param {Object}            templates       map from chord name to template (from buildChordTemplates)
 * @param {number}            [thresholdOverride] minimum similarity override for "correct"
 * @returns {{ isCorrect: boolean, confidence: number, bestMatch: string|null, bestScore: number }}
 */
export function matchHpcpToChord(hpcp, targetChordName, templates, thresholdOverride, options = {}) {
  const effectiveTargetChordName = getEffectiveTargetChordName(targetChordName);
  const targetTemplate = templates[effectiveTargetChordName];
  if (!targetTemplate) {
    return { isCorrect: false, confidence: 0, bestMatch: null, bestScore: 0 };
  }

  const targetDescriptor = getChordDescriptor(effectiveTargetChordName);
  const targetEvidence = scoreHpcpAgainstChord(hpcp, targetTemplate, targetDescriptor);
  const profile = targetEvidence.profile;
  const bassSupportByChord = options.bassSupportByChord ?? null;
  const targetBassSupport = bassSupportByChord?.[effectiveTargetChordName] ?? bassSupportByChord?.[targetChordName] ?? null;
  const confidence = targetEvidence.score;
  const candidateScores = scoreChordCandidates(hpcp, templates);
  const { bestMatch, bestScore, bestDescriptor, scoreByChordName } = candidateScores;

  const threshold = thresholdOverride ?? profile.threshold;
  const hasEnoughChordSupport = targetEvidence.supportMean >= profile.minSupportMean;
  const specialCase = CHORD_MATCH_SPECIAL_CASES[effectiveTargetChordName] ?? CHORD_MATCH_SPECIAL_CASES[targetChordName];
  const rootAndBassEvidence = evaluateRootAndBassEvidence(targetDescriptor, targetEvidence, profile, targetBassSupport);
  const triadQualityEvidence = evaluateTriadQualityEvidence(targetDescriptor, targetEvidence, profile);
  const chordExtensionEvidence = evaluateChordExtensionEvidence(targetDescriptor, targetEvidence, profile, hpcp);
  const annotatedTargetAcceptance = evaluateAnnotatedTargetAcceptance(
    targetChordName,
    effectiveTargetChordName,
    specialCase,
    bestMatch,
  );
  const bestMatchCompatibility = evaluateBestMatchCompatibility({
    targetDescriptor,
    bestDescriptor,
    targetEvidence,
    profile,
    bestScore,
    confidence,
    bestMatch,
    targetTemplate,
    templates,
  });
  const { bestAcceptedAliasName, bestAcceptedAliasScore } = findBestAcceptedAlias(specialCase, scoreByChordName);
  const acceptsSpecialCase = passesSpecialCaseAcceptance({
    specialCase,
    bestAcceptedAliasScore,
    threshold,
    rootAndBassEvidence,
    chordExtensionEvidence,
    annotatedTargetAcceptance,
    hasEnoughChordSupport,
  });
  const acceptsCoreEvidence = passesCoreEvidence({
    confidence,
    threshold,
    rootAndBassEvidence,
    triadQualityEvidence,
    chordExtensionEvidence,
    annotatedTargetAcceptance,
    hasEnoughChordSupport,
  });
  const isCorrect = acceptsSpecialCase || (
    acceptsCoreEvidence && (
      bestMatch === targetChordName ||
      bestMatch === effectiveTargetChordName ||
      bestMatchCompatibility.passesBestMatchTolerance ||
      bestMatchCompatibility.passesSubsetAcceptance ||
      bestMatchCompatibility.passesDominantSeventhVariantAcceptance
    )
  );

  return {
    isCorrect,
    confidence,
    bestMatch: acceptsSpecialCase ? bestAcceptedAliasName : bestMatch,
    bestScore: acceptsSpecialCase ? bestAcceptedAliasScore : bestScore,
    bassSupport: targetBassSupport,
  };
}
