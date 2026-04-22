import { describe, it, expect } from 'vitest';
import { assertSequenceFixture } from '../helpers/sequenceFixtureAssertions.js';

describe('fastNoteMatcher – sequence fixture medium', () => {
  it('[open-strings/medium] recognises full sequence', () => {
    const { deduped, expectedNotes, result, isFastTempo } = assertSequenceFixture('open-strings', 'medium');

    expect(isFastTempo).toBe(false);
    expect(deduped).toEqual(expectedNotes);
    expect(result.finalTargetIndex).toBe(expectedNotes.length);
  }, 30_000);
});
