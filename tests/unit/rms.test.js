import { describe, expect, it } from 'vitest';
import { computeFrameRms } from '../../js/shared/audio/rms.js';

function constantBuffer(value, length = 64) {
  return new Float32Array(length).fill(value);
}

describe('computeFrameRms', () => {
  it('computes RMS for a constant buffer', () => {
    expect(computeFrameRms(constantBuffer(0.25))).toBeCloseTo(0.25, 5);
  });

  it('returns 0 for an empty buffer', () => {
    expect(computeFrameRms(new Float32Array())).toBe(0);
  });
});
