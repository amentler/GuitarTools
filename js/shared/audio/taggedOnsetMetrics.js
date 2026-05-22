export const DEFAULT_TAGGED_ONSET_METRIC_OPTIONS = Object.freeze({
  goodWindowMs: 30,
  acceptableWindowMs: 50,
  falsePositiveNearWindowMs: 100,
});
function safeDivide(num, den) {
  return den === 0 ? 0 : num / den;
}
function normalizeOnsets(values) {
  return [...(values ?? [])]
    .filter(Number.isFinite)
    .sort((a, b) => a - b);
}
function percentile(values, p) {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.min(sorted.length - 1, Math.max(0, Math.ceil(sorted.length * p) - 1));
  return sorted[index];
}
export function computeTaggedOnsetMetrics(taggedOnsetsMs, detectedOnsetsMs, options = {}) {
  const scoring = {
    ...DEFAULT_TAGGED_ONSET_METRIC_OPTIONS,
    ...options,
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
  let goodMatches = 0;
  let acceptableMatches = 0;
  for (const pair of pairs) {
    if (matchedTags.has(pair.tagIndex) || matchedDetections.has(pair.detectionIndex)) continue;
    matchedTags.add(pair.tagIndex);
    matchedDetections.add(pair.detectionIndex);
    const signedErrorMs = detected[pair.detectionIndex] - tagged[pair.tagIndex];
    errorsMs.push(pair.distanceMs);
    signedErrorsMs.push(signedErrorMs);
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
  const truePositives = matchedTags.size;
  const falseNegatives = tagged.length - truePositives;
  const falsePositives = duplicates + nearFalsePositives + farFalsePositives;
  const precision = safeDivide(truePositives, truePositives + falsePositives);
  const recall = safeDivide(truePositives, truePositives + falseNegatives);
  const earlyMatches = signedErrorsMs.filter(value => value < 0).length;
  const lateMatches = signedErrorsMs.filter(value => value > 0).length;
  return {
    counts: {
      truePositives,
      falsePositives,
      falseNegatives,
      trueNegatives: null,
      expected: tagged.length,
      detected: detected.length,
      goodMatches,
      acceptableMatches,
      misses: falseNegatives,
      duplicates,
      nearFalsePositives,
      farFalsePositives,
      earlyMatches,
      lateMatches,
    },
    metrics: {
      precision,
      recall,
      f1: safeDivide(2 * precision * recall, precision + recall),
      detectedExpectedRatio: safeDivide(detected.length, tagged.length),
      taggedHitRate: safeDivide(goodMatches + acceptableMatches, tagged.length),
      meanAbsErrorMs: errorsMs.length > 0
        ? errorsMs.reduce((sum, value) => sum + value, 0) / errorsMs.length
        : null,
      medianAbsErrorMs: percentile(errorsMs, 0.5),
      p95AbsErrorMs: percentile(errorsMs, 0.95),
      maxAbsErrorMs: errorsMs.length > 0 ? Math.max(...errorsMs) : null,
      meanSignedErrorMs: signedErrorsMs.length > 0
        ? signedErrorsMs.reduce((sum, value) => sum + value, 0) / signedErrorsMs.length
        : null,
    },
  };
}
function normalizeTrainingName(value) {
  return String(value ?? '')
    .replace(/\\/g, '/')
    .split('/')
    .pop()
    .replace(/^training_data_/i, '')
    .replace(/\.json$/i, '')
    .toLowerCase();
}
export function resolveOnsetModelTrainingStatus(baseName, trainingDataFiles) {
  if (!Array.isArray(trainingDataFiles) || trainingDataFiles.length === 0) {
    return { status: 'unknown', matchedFile: null };
  }
  const normalizedBaseName = normalizeTrainingName(baseName);
  if (!normalizedBaseName) {
    return { status: 'unknown', matchedFile: null };
  }
  const matchedFile = trainingDataFiles.find(file => normalizeTrainingName(file) === normalizedBaseName) ?? null;
  return {
    status: matchedFile ? 'trained' : 'not-trained',
    matchedFile,
  };
}
