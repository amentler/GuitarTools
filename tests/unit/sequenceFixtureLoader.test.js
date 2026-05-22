import { describe, expect, it } from 'vitest';
import { join } from 'path';
import {
  resolveSequenceFixtureSource,
} from '../helpers/sequenceFixtureLoader.js';

const SEQUENCES_DIR = join(process.cwd(), 'tests/fixtures/sequences');

describe('sequenceFixtureLoader', () => {
  it('resolves a fixture by stem across zip/tagged variants', () => {
    const byStem = resolveSequenceFixtureSource(SEQUENCES_DIR, 'sheet-music-reading/unknown_80bpm_ek6yp');
    const byTaggedZip = resolveSequenceFixtureSource(SEQUENCES_DIR, 'sheet-music-reading/unknown_80bpm_ek6yp-tagged.zip');
    const byBareName = resolveSequenceFixtureSource(SEQUENCES_DIR, 'unknown_80bpm_ek6yp');

    expect(byStem?.file).toBe('sheet-music-reading/unknown_80bpm_ek6yp-tagged.zip');
    expect(byTaggedZip?.file).toBe('sheet-music-reading/unknown_80bpm_ek6yp-tagged.zip');
    expect(byBareName?.file).toBe('sheet-music-reading/unknown_80bpm_ek6yp-tagged.zip');
  });
});
