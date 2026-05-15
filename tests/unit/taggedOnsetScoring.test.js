import { describe, expect, it } from 'vitest';
import { scoreTaggedOnsets } from '../../scripts/taggedOnsetScoring.mjs';
import { summarizeOnsetMetrics } from '../helpers/sheetMusicSequenceFingerprint.js';

describe('taggedOnsetScoring', () => {
  it('tracks signed timing metrics for matched tagged onsets', () => {
    const score = scoreTaggedOnsets(
      [1000, 2000, 3000],
      [995, 2035, 3090],
    );

    expect(score.matches).toBe(2);
    expect(score.goodMatches).toBe(1);
    expect(score.acceptableMatches).toBe(1);
    expect(score.misses).toBe(1);
    expect(score.meanAbsErrorMs).toBe(20);
    expect(score.medianAbsErrorMs).toBe(5);
    expect(score.p95AbsErrorMs).toBe(35);
    expect(score.maxAbsErrorMs).toBe(35);
    expect(score.meanSignedErrorMs).toBe(15);
    expect(score.earlyMatches).toBe(1);
    expect(score.lateMatches).toBe(1);
  });

  it('summarizes tagged and untagged onset cases together', () => {
    const taggedScore = scoreTaggedOnsets(
      [1000, 2000, 3000],
      [1005, 2035, 2800, 3600],
    );
    const summary = summarizeOnsetMetrics([
      {
        fixture: { file: 'tagged.wav', taggedOnsetsMs: [1000, 2000, 3000] },
        expectedCount: 3,
        onsetCount: 4,
        onsetStatus: 'mixed',
        onsetTaggedScore: taggedScore,
      },
      {
        fixture: { file: 'untagged.wav', taggedOnsetsMs: null },
        expectedCount: 2,
        onsetCount: 1,
        onsetStatus: 'under',
        onsetTaggedScore: null,
      },
    ]);

    expect(summary.counts.truePositives).toBe(3);
    expect(summary.counts.falsePositives).toBe(2);
    expect(summary.counts.falseNegatives).toBe(2);
    expect(summary.counts.taggedFixtures).toBe(1);
    expect(summary.counts.totalTaggedOnsets).toBe(3);
    expect(summary.counts.goodMatches).toBe(1);
    expect(summary.counts.acceptableMatches).toBe(1);
    expect(summary.counts.misses).toBe(1);
    expect(summary.counts.duplicates).toBe(0);
    expect(summary.counts.mixed).toBe(1);
    expect(summary.counts.under).toBe(1);
    expect(summary.metrics.onsetPrecision).toBe(0.6);
    expect(summary.metrics.onsetRecall).toBe(0.6);
    expect(summary.metrics.onsetF1).toBe(0.6);
    expect(summary.metrics.taggedHitRate).toBeCloseTo(2 / 3, 6);
    expect(summary.metrics.goodHitRate).toBeCloseTo(1 / 3, 6);
    expect(summary.metrics.meanAbsErrorMs).toBe(20);
    expect(summary.metrics.p95AbsErrorMs).toBe(35);
    expect(summary.metrics.meanSignedErrorMs).toBe(20);
  });
});
