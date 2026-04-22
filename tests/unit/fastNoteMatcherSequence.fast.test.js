import { describe, it, expect } from 'vitest';
import { assertSequenceFixture } from '../helpers/sequenceFixtureAssertions.js';

describe('fastNoteMatcher – sequence fixture fast', () => {
  it('[open-strings/fast] recognises partial sequence', () => {
    const { deduped, expectedNotes, isFastTempo } = assertSequenceFixture('open-strings', 'fast');

    expect(isFastTempo).toBe(true);

    const minNotes = Math.max(1, Math.ceil(expectedNotes.length * 0.25));
    expect(deduped.length).toBeGreaterThanOrEqual(minNotes);
    for (let i = 0; i < deduped.length; i++) {
      expect(deduped[i]).toBe(expectedNotes[i]);
    }
  }, 30_000);
});
