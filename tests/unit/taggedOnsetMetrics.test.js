import { describe, expect, it } from 'vitest';
import {
  computeTaggedOnsetMetrics,
  resolveOnsetModelTrainingStatus,
} from '../../js/shared/audio/taggedOnsetMetrics.js';

describe('computeTaggedOnsetMetrics', () => {
  it('reports perfect matches as all true positives', () => {
    const result = computeTaggedOnsetMetrics([100, 500, 900], [102, 498, 900]);

    expect(result.counts.truePositives).toBe(3);
    expect(result.counts.falsePositives).toBe(0);
    expect(result.counts.falseNegatives).toBe(0);
    expect(result.metrics.precision).toBe(1);
    expect(result.metrics.recall).toBe(1);
    expect(result.metrics.f1).toBe(1);
  });

  it('counts missed tags as false negatives', () => {
    const result = computeTaggedOnsetMetrics([100, 500, 900], [100, 900]);

    expect(result.counts.truePositives).toBe(2);
    expect(result.counts.falseNegatives).toBe(1);
    expect(result.metrics.recall).toBeCloseTo(2 / 3);
  });

  it('counts extra detections as false positives', () => {
    const result = computeTaggedOnsetMetrics([100], [100, 300]);

    expect(result.counts.truePositives).toBe(1);
    expect(result.counts.falsePositives).toBe(1);
    expect(result.metrics.precision).toBeCloseTo(0.5);
  });

  it('counts duplicate detections near an already matched tag', () => {
    const result = computeTaggedOnsetMetrics([100], [100, 120]);

    expect(result.counts.truePositives).toBe(1);
    expect(result.counts.duplicates).toBe(1);
    expect(result.counts.falsePositives).toBe(1);
  });

  it('returns stable zero metrics for empty inputs', () => {
    const result = computeTaggedOnsetMetrics([], []);

    expect(result.counts.truePositives).toBe(0);
    expect(result.counts.falsePositives).toBe(0);
    expect(result.counts.falseNegatives).toBe(0);
    expect(result.metrics.precision).toBe(0);
    expect(result.metrics.recall).toBe(0);
    expect(result.metrics.f1).toBe(0);
  });
});

describe('resolveOnsetModelTrainingStatus', () => {
  it('matches the current baseName against training data filenames', () => {
    const result = resolveOnsetModelTrainingStatus('notenlesen_4-4_80bpm_E_abc12', [
      'training_data_other.json',
      'training_data_notenlesen_4-4_80bpm_E_abc12.json',
    ]);

    expect(result.status).toBe('trained');
    expect(result.matchedFile).toBe('training_data_notenlesen_4-4_80bpm_E_abc12.json');
  });

  it('reports not-trained when training files are known but no baseName matches', () => {
    const result = resolveOnsetModelTrainingStatus('take-a', ['training_data_take-b.json']);

    expect(result.status).toBe('not-trained');
    expect(result.matchedFile).toBeNull();
  });

  it('reports unknown when the model has no training file metadata', () => {
    const result = resolveOnsetModelTrainingStatus('take-a', []);

    expect(result.status).toBe('unknown');
    expect(result.matchedFile).toBeNull();
  });
});
