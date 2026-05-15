export const DEFAULT_TAGGED_ONSET_SCORING = Object.freeze({
  goodWindowMs: 30,
  acceptableWindowMs: 50,
  falsePositiveNearWindowMs: 100,
  goodMatchScore: 1,
  goodMatchMinScore: 0.8,
  acceptableMatchScore: 0.5,
  acceptableMatchMinScore: 0.2,
  missPenalty: 1.5,
  duplicatePenalty: 0.75,
  nearFalsePositivePenalty: 1.5,
  farFalsePositivePenalty: 2.5,
  overfirePenalty: 0.35,
});

function safeDivide(num, den) {
  return den === 0 ? 0 : num / den;
}

function normalizeOnsets(values) {
  return [...values]
    .filter(Number.isFinite)
    .sort((a, b) => a - b);
}

function scoreTimedMatch(distanceMs, scoring) {
  if (distanceMs <= scoring.goodWindowMs) {
    const span = Math.max(1, scoring.goodWindowMs);
    return scoring.goodMatchScore
      - (distanceMs / span) * (scoring.goodMatchScore - scoring.goodMatchMinScore);
  }

  const span = Math.max(1, scoring.acceptableWindowMs - scoring.goodWindowMs);
  return scoring.acceptableMatchScore
    - ((distanceMs - scoring.goodWindowMs) / span)
      * (scoring.acceptableMatchScore - scoring.acceptableMatchMinScore);
}

export function percentile(values, p) {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.min(sorted.length - 1, Math.max(0, Math.ceil(sorted.length * p) - 1));
  return sorted[index];
}

export function scoreTaggedOnsets(
  taggedOnsetsMs,
  detectedOnsetsMs,
  scoreSpec = DEFAULT_TAGGED_ONSET_SCORING,
) {
  const scoring = {
    ...DEFAULT_TAGGED_ONSET_SCORING,
    ...scoreSpec,
  };
  const tagged = normalizeOnsets(taggedOnsetsMs);
  const detected = normalizeOnsets(detectedOnsetsMs);
  const pairs = [];

  for (let tagIndex = 0; tagIndex < tagged.length; tagIndex++) {
    for (let detectionIndex = 0; detectionIndex < detected.length; detectionIndex++) {
      const distanceMs = Math.abs(detected[detectionIndex] - tagged[tagIndex]);
      if (distanceMs <= scoring.acceptableWindowMs) {
        pairs.push({ tagIndex, detectionIndex, distanceMs });
      }
    }
  }

  pairs.sort((a, b) => (
    a.distanceMs - b.distanceMs
    || a.tagIndex - b.tagIndex
    || a.detectionIndex - b.detectionIndex
  ));

  const matchedTags = new Set();
  const matchedDetections = new Set();
  const errorsMs = [];
  const signedErrorsMs = [];
  const matchedPairs = [];
  let goodMatches = 0;
  let acceptableMatches = 0;
  let matchScore = 0;

  for (const pair of pairs) {
    if (matchedTags.has(pair.tagIndex) || matchedDetections.has(pair.detectionIndex)) continue;
    matchedTags.add(pair.tagIndex);
    matchedDetections.add(pair.detectionIndex);
    const signedErrorMs = detected[pair.detectionIndex] - tagged[pair.tagIndex];
    errorsMs.push(pair.distanceMs);
    signedErrorsMs.push(signedErrorMs);
    matchedPairs.push({
      tagIndex: pair.tagIndex,
      detectionIndex: pair.detectionIndex,
      tagMs: tagged[pair.tagIndex],
      detectionMs: detected[pair.detectionIndex],
      errorMs: signedErrorMs,
      absErrorMs: pair.distanceMs,
      bucket: pair.distanceMs <= scoring.goodWindowMs ? 'good' : 'acceptable',
    });
    matchScore += scoreTimedMatch(pair.distanceMs, scoring);
    if (pair.distanceMs <= scoring.goodWindowMs) {
      goodMatches++;
    } else {
      acceptableMatches++;
    }
  }

  let duplicates = 0;
  let nearFalsePositives = 0;
  let farFalsePositives = 0;

  for (let detectionIndex = 0; detectionIndex < detected.length; detectionIndex++) {
    if (matchedDetections.has(detectionIndex)) continue;
    const nearestTag = tagged.reduce((nearest, onsetMs, tagIndex) => {
      const distanceMs = Math.abs(detected[detectionIndex] - onsetMs);
      return !nearest || distanceMs < nearest.distanceMs
        ? { tagIndex, distanceMs }
        : nearest;
    }, null);

    if (nearestTag && nearestTag.distanceMs <= scoring.acceptableWindowMs && matchedTags.has(nearestTag.tagIndex)) {
      duplicates++;
    } else if (nearestTag && nearestTag.distanceMs <= scoring.falsePositiveNearWindowMs) {
      nearFalsePositives++;
    } else {
      farFalsePositives++;
    }
  }

  const matches = matchedTags.size;
  const misses = tagged.length - matches;
  const falsePositives = duplicates + nearFalsePositives + farFalsePositives;
  const overfire = Math.max(0, detected.length - tagged.length);
  const score = matchScore
    - misses * scoring.missPenalty
    - duplicates * scoring.duplicatePenalty
    - nearFalsePositives * scoring.nearFalsePositivePenalty
    - farFalsePositives * scoring.farFalsePositivePenalty
    - overfire * overfire * scoring.overfirePenalty;
  const earlyMatches = signedErrorsMs.filter(value => value < 0).length;
  const lateMatches = signedErrorsMs.filter(value => value > 0).length;
  const exactMatches = signedErrorsMs.filter(value => value === 0).length;

  return {
    score,
    goodMatches,
    acceptableMatches,
    matches,
    misses,
    falsePositives,
    duplicates,
    nearFalsePositives,
    farFalsePositives,
    overfire,
    hitRate: safeDivide(matches, tagged.length),
    precision: safeDivide(matches, detected.length),
    recall: safeDivide(matches, tagged.length),
    f1: safeDivide(2 * matches, detected.length + tagged.length),
    earlyMatches,
    lateMatches,
    exactMatches,
    meanAbsErrorMs: errorsMs.length > 0
      ? errorsMs.reduce((sum, value) => sum + value, 0) / errorsMs.length
      : null,
    medianAbsErrorMs: percentile(errorsMs, 0.5),
    p95AbsErrorMs: percentile(errorsMs, 0.95),
    maxAbsErrorMs: errorsMs.length > 0 ? Math.max(...errorsMs) : null,
    meanSignedErrorMs: signedErrorsMs.length > 0
      ? signedErrorsMs.reduce((sum, value) => sum + value, 0) / signedErrorsMs.length
      : null,
    errorsMs,
    signedErrorsMs,
    matchedPairs,
  };
}
