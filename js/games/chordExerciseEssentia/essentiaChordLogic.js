/**
 * essentiaChordLogic.js
 * Pure functions for HPCP-based chord matching.
 * No DOM, no audio, no WASM – fully unit-testable.
 *
 * Approach: compare a 12-bin HPCP vector against chord templates
 * using cosine similarity. Templates are derived from akkordData.js.
 */

import { CHORD_RECOGNITION_CHORDS } from '../../data/akkordData.js';
import { getChordNotes } from '../../domain/chords/chordDetectionLogic.js';
import {
  NOTE_TO_BIN,
  DEFAULT_PROFILE,
  BASS_VARIANT_COUNTERPART,
  BASS_VARIANT_FUND_FACTOR,
  SUS_IDENTITY_COUNTERPART,
  SUS_IDENTITY_FUND_FACTOR,
  MIN_TRIAD_THIRD_SEPARATION,
  MIN_SUSPENSION_ENERGY,
  MAX_SUSPENSION_COMPETING_THIRD_ENERGY,
  MIN_ADD9_ENERGY,
  MIN_ADD9_THIRD_ENERGY,
  MIN_ADD9_TO_SECOND_RATIO,
  MIN_MAJOR_TRIAD_DOMINANT_SEVENTH_LEAKAGE,
  MIN_MAJOR_SEVENTH_RATIO,
  MIN_MINOR_SEVENTH_RATIO,
  MIN_DOMINANT_VARIANT_SEVENTH_ENERGY,
  MAX_SPARSE_DOMINANT_THIRD_ENERGY,
  MIN_SPARSE_DOMINANT_FIFTH_ENERGY,
  MIN_SUSPENSION_TO_THIRD_RATIO,
  OPEN_STRUM_CANDIDATE_NAME,
  OPEN_STRUM_BASE_BINS,
  OPEN_STRUM_TEMPLATE_OFFSETS,
  OPEN_STRUM_THRESHOLD,
  OPEN_STRUM_BEST_CHORD_MARGIN,
} from './essentiaChordConstants.js';
import {
  getChordDescriptor,
  getChordProfile,
  isTriadModeSensitive,
  isAnnotatedVariant,
  sharesRoot,
  CHORD_MATCH_SPECIAL_CASES,
  getEffectiveTargetChordName,
} from './essentiaChordDescriptors.js';

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
  let minorThirdEnergy = 0;
  let majorThirdEnergy = 0;

  if (descriptor) {
    rootEnergy = hpcp[descriptor.rootBin];
    fifthEnergy = hpcp[descriptor.fifthBin];
    minorThirdEnergy = hpcp[descriptor.minorThirdBin];
    majorThirdEnergy = hpcp[descriptor.majorThirdBin];
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
  const strongestThirdEnergy = Math.max(minorThirdEnergy, majorThirdEnergy);

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
    minorThirdEnergy,
    majorThirdEnergy,
    strongestThirdEnergy,
    competingThirdEnergy,
    extensionSecondEnergy,
    rawScore,
    score: clampConfidence(normalizedScore),
  };
}

function scoreChordCandidates(hpcp, templates) {
  let bestChordMatch = null;
  let bestChordScore = -1;
  let bestChordDescriptor = null;
  const scoreByChordName = new Map();

  for (const [name, template] of Object.entries(templates)) {
    const descriptor = getChordDescriptor(name);
    const score = scoreHpcpAgainstChord(hpcp, template, descriptor).score;
    scoreByChordName.set(name, score);
    if (score > bestChordScore) {
      bestChordScore = score;
      bestChordMatch = name;
      bestChordDescriptor = descriptor;
    }
  }

  const openStrumCandidate = scoreOpenStrumCandidate(hpcp);
  const bestMatch = openStrumCandidate.score > bestChordScore
    ? OPEN_STRUM_CANDIDATE_NAME
    : bestChordMatch;
  const bestScore = openStrumCandidate.score > bestChordScore
    ? openStrumCandidate.score
    : bestChordScore;

  return {
    bestMatch,
    bestScore,
    bestDescriptor: bestChordDescriptor,
    bestChordMatch,
    bestChordScore,
    bestChordDescriptor,
    openStrumCandidate,
    scoreByChordName,
  };
}

function buildOpenStrumTemplate(offset) {
  const template = new Float32Array(12);
  for (const bin of OPEN_STRUM_BASE_BINS) {
    template[(bin + offset) % 12] = 1;
  }
  return template;
}

function scoreOpenStrumCandidate(hpcp) {
  let bestOffset = null;
  let bestEvidence = null;
  let bestScore = -1;

  for (const offset of OPEN_STRUM_TEMPLATE_OFFSETS) {
    const template = buildOpenStrumTemplate(offset);
    const supportMean = getMeanEnergy(hpcp, template, true);
    const leakageMean = getMeanEnergy(hpcp, template, false);
    const rawScore =
      DEFAULT_PROFILE.weights.supportMean * supportMean -
      DEFAULT_PROFILE.weights.leakageMean * leakageMean;
    const normalizedScore = rawScore / DEFAULT_PROFILE.weights.supportMean;
    const score = clampConfidence(normalizedScore);

    if (score > bestScore) {
      bestScore = score;
      bestOffset = offset;
      bestEvidence = {
        supportMean,
        leakageMean,
      };
    }
  }

  return {
    name: OPEN_STRUM_CANDIDATE_NAME,
    offset: bestOffset,
    score: bestScore,
    supportMean: bestEvidence?.supportMean ?? 0,
    leakageMean: bestEvidence?.leakageMean ?? 0,
  };
}

function evaluateOpenStrumRejectCandidate(openStrumCandidate, bestChordScore, targetDescriptor, confidence, chordExtensionEvidence) {
  const hasOpenStrumEvidence = openStrumCandidate.score >= OPEN_STRUM_THRESHOLD;
  const isNearBestChord = bestChordScore >= 0 &&
    openStrumCandidate.score >= bestChordScore - OPEN_STRUM_BEST_CHORD_MARGIN;
  const hasStrongSeventhOverride = Boolean(
    targetDescriptor?.expectedSeventhBin !== null &&
    chordExtensionEvidence.hasExpectedSeventh &&
    confidence >= openStrumCandidate.score + 0.12
  );

  return {
    hasOpenStrumEvidence,
    isNearBestChord,
    hasStrongSeventhOverride,
    rejectsChordClaim: hasOpenStrumEvidence && isNearBestChord && !hasStrongSeventhOverride,
  };
}

function evaluateRootAndBassEvidence(targetDescriptor, targetEvidence, profile, targetBassSupport, bassSupportByChord, targetChordName) {
  const hasStrongRoot = !targetDescriptor || targetEvidence.rootEnergy >= profile.minRootEnergy;
  const hasStrongFifth = !targetDescriptor || targetEvidence.fifthEnergy >= profile.minFifthEnergy;
  const hasExpectedBass = !targetBassSupport || targetBassSupport.isLocallyDominant;
  const fundamentalScore = targetBassSupport?.expected?.fundamentalScore ?? 0;
  const strongestNeighborScore = targetBassSupport?.strongestNeighbor ?? 0;
  const fundamentalToNeighborRatio = strongestNeighborScore > 0
    ? fundamentalScore / strongestNeighborScore
    : (fundamentalScore > 0 ? Number.POSITIVE_INFINITY : 0);
  const hasStrongBassFundamental = !targetBassSupport ||
    fundamentalToNeighborRatio >= (profile.minBassFundamentalToNeighborRatio ?? 0);

  const counterpartName = BASS_VARIANT_COUNTERPART[targetChordName];
  const counterpartBassSupport = counterpartName && bassSupportByChord ? bassSupportByChord[counterpartName] : null;
  const targetFund = targetBassSupport?.expected.fundamentalScore ?? targetBassSupport?.expected.score ?? 0;
  const counterpartFund = counterpartBassSupport?.expected.fundamentalScore ?? counterpartBassSupport?.expected.score ?? 0;
  const hasBassVariantPriority = !counterpartBassSupport || !targetBassSupport ||
    targetFund * BASS_VARIANT_FUND_FACTOR >= counterpartFund;

  const susCounterpartName = SUS_IDENTITY_COUNTERPART[targetChordName];
  const susCounterpartBassSupport = susCounterpartName && bassSupportByChord ? bassSupportByChord[susCounterpartName] : null;
  const susCounterpartFund = susCounterpartBassSupport?.expected.fundamentalScore ?? susCounterpartBassSupport?.expected.score ?? 0;
  const hasSusIdentityPriority = !susCounterpartBassSupport || !targetBassSupport ||
    targetFund * SUS_IDENTITY_FUND_FACTOR >= susCounterpartFund;

  return {
    hasStrongRoot,
    hasStrongFifth,
    hasExpectedBass,
    hasStrongBassFundamental,
    hasBassVariantPriority: hasBassVariantPriority && hasSusIdentityPriority,
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
  const hasSparseDominantTriadEvidence = Boolean(
    targetDescriptor?.type === '7' &&
    targetEvidence.expectedThirdEnergy <= MAX_SPARSE_DOMINANT_THIRD_ENERGY &&
    targetEvidence.fifthEnergy >= MIN_SPARSE_DOMINANT_FIFTH_ENERGY
  );
  const hasExpectedSeventh = !targetDescriptor ||
    targetEvidence.expectedSeventhEnergy >= profile.minSeventhEnergy ||
    hasSparseDominantTriadEvidence;
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
        : targetEvidence.expectedFourthEnergy) >= targetEvidence.strongestThirdEnergy * MIN_SUSPENSION_TO_THIRD_RATIO &&
      (targetDescriptor.type === 'sus2'
        ? targetEvidence.expectedSecondEnergy
        : targetEvidence.expectedFourthEnergy) > targetEvidence.strongestThirdEnergy &&
      targetEvidence.strongestThirdEnergy <= MAX_SUSPENSION_COMPETING_THIRD_ENERGY
    );
  const hasAdd9Evidence = !targetDescriptor ||
    targetDescriptor.type !== 'add9' ||
    (
      targetEvidence.expectedSecondEnergy >= MIN_ADD9_ENERGY &&
      targetEvidence.expectedSecondEnergy >= targetEvidence.expectedThirdEnergy * 0.4 &&
      targetEvidence.expectedThirdEnergy >= MIN_ADD9_THIRD_ENERGY &&
      targetEvidence.expectedThirdEnergy >= targetEvidence.expectedSecondEnergy * MIN_ADD9_TO_SECOND_RATIO
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
    hasSparseDominantTriadEvidence,
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
  const rootsMatch = sharesRoot(targetDescriptor, bestDescriptor);
  const activeTolerance = rootsMatch
    ? (profile.sameRootTolerance ?? profile.bestMatchTolerance)
    : profile.bestMatchTolerance;
  const passesBestMatchTolerance = bestScore - confidence <= activeTolerance &&
    (!targetDescriptor || rootsMatch || hasDominantSeventhEvidence);
  const allowsCrossRootSubset = !targetDescriptor || targetDescriptor.expectedSeventhBin === null;
  const passesSubsetAcceptance = isSubsetOf(templates[bestMatch], targetTemplate) &&
    (allowsCrossRootSubset || sharesRoot(targetDescriptor, bestDescriptor));
  const passesDominantSeventhVariantAcceptance = Boolean(
    targetDescriptor?.type === '7' &&
    bestDescriptor &&
    sharesRoot(targetDescriptor, bestDescriptor) &&
    targetEvidence.expectedSeventhEnergy >= MIN_DOMINANT_VARIANT_SEVENTH_ENERGY &&
    confidence >= profile.threshold &&
    (profile.minDominantVariantConfidence === undefined ||
      confidence >= profile.minDominantVariantConfidence)
  );

  return {
    hasDominantSeventhEvidence,
    rootsMatch,
    activeTolerance,
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
  const minimumAcceptedScore = specialCase?.minimumAcceptedScore ?? threshold;

  return Boolean(
    specialCase &&
    bestAcceptedAliasScore >= minimumAcceptedScore &&
    rootAndBassEvidence.hasStrongRoot &&
    rootAndBassEvidence.hasStrongFifth &&
    chordExtensionEvidence.hasExpectedSeventh &&
    rootAndBassEvidence.hasExpectedBass &&
    rootAndBassEvidence.hasStrongBassFundamental &&
    rootAndBassEvidence.hasBassVariantPriority &&
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
    rootAndBassEvidence.hasBassVariantPriority &&
    triadQualityEvidence.hasExpectedThird &&
    triadQualityEvidence.hasSeparatedTriadThird &&
    chordExtensionEvidence.hasExpectedSeventh &&
    rootAndBassEvidence.hasExpectedBass &&
    rootAndBassEvidence.hasStrongBassFundamental &&
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
 * Builds a 12-bin binary template for every curated recognition chord.
 * Each bin is 1 if the pitch class is part of the chord, 0 otherwise.
 *
 * @returns {Object.<string, Float32Array>} map from chord name to 12-bin template
 */
export function buildChordTemplates() {
  const templates = {};
  for (const chordName of Object.keys(CHORD_RECOGNITION_CHORDS)) {
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
export function matchChordPath(hpcp, targetChordName, templates, thresholdOverride, options = {}) {
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
  const {
    bestMatch,
    bestScore,
    bestChordMatch,
    bestChordScore,
    bestChordDescriptor,
    openStrumCandidate,
    scoreByChordName,
  } = candidateScores;

  const threshold = thresholdOverride ?? profile.threshold;
  const hasEnoughChordSupport = targetEvidence.supportMean >= profile.minSupportMean;
  const specialCase = CHORD_MATCH_SPECIAL_CASES[effectiveTargetChordName] ?? CHORD_MATCH_SPECIAL_CASES[targetChordName];
  const rootAndBassEvidence = evaluateRootAndBassEvidence(targetDescriptor, targetEvidence, profile, targetBassSupport, bassSupportByChord, targetChordName);
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
    bestDescriptor: bestChordDescriptor,
    targetEvidence,
    profile,
    bestScore: bestChordScore,
    confidence,
    bestMatch: bestChordMatch,
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
  const openStrumRejectCandidate = evaluateOpenStrumRejectCandidate(
    openStrumCandidate,
    bestChordScore,
    targetDescriptor,
    confidence,
    chordExtensionEvidence,
  );
  const fingerprintFallbackBestMatch = openStrumRejectCandidate.rejectsChordClaim
    ? OPEN_STRUM_CANDIDATE_NAME
    : bestMatch;
  const acceptsCoreEvidence = passesCoreEvidence({
    confidence,
    threshold,
    rootAndBassEvidence,
    triadQualityEvidence,
    chordExtensionEvidence,
    annotatedTargetAcceptance,
    hasEnoughChordSupport,
  });
  const acceptsMatcherFallback = Boolean(options.acceptMatcherFallback?.({
    targetChordName,
    effectiveTargetChordName,
    targetDescriptor,
    targetEvidence,
    confidence,
    annotatedTargetAcceptance,
    hpcp,
    bestMatch: fingerprintFallbackBestMatch,
  }));
  const isCorrect = acceptsSpecialCase || (
    (
      !openStrumRejectCandidate.rejectsChordClaim &&
      acceptsCoreEvidence && (
        bestChordMatch === targetChordName ||
        bestChordMatch === effectiveTargetChordName ||
        bestMatchCompatibility.passesBestMatchTolerance ||
        bestMatchCompatibility.passesSubsetAcceptance ||
        bestMatchCompatibility.passesDominantSeventhVariantAcceptance
      )
    ) ||
    acceptsMatcherFallback
  );
  const reportedSpecialCaseBestMatch = specialCase?.reportAsTarget
    ? effectiveTargetChordName
    : bestAcceptedAliasName;
  const reportedBestMatch = acceptsSpecialCase
    ? reportedSpecialCaseBestMatch
    : (openStrumRejectCandidate.rejectsChordClaim ? OPEN_STRUM_CANDIDATE_NAME : bestMatch);
  const reportedBestScore = acceptsSpecialCase && specialCase?.reportAsTarget
    ? confidence
    : (acceptsSpecialCase
      ? bestAcceptedAliasScore
      : (reportedBestMatch === OPEN_STRUM_CANDIDATE_NAME ? openStrumCandidate.score : bestScore));

  return {
    isCorrect,
    confidence,
    bestMatch: reportedBestMatch,
    bestScore: reportedBestScore,
    bassSupport: targetBassSupport,
  };
}

export function matchHpcpToChord(hpcp, targetChordName, templates, thresholdOverride, options = {}) {
  return matchChordPath(hpcp, targetChordName, templates, thresholdOverride, options);
}
