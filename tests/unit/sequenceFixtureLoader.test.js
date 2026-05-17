import { describe, expect, it } from 'vitest';
import { join } from 'path';
import {
  resolveSequenceFixtureSource,
} from '../helpers/sequenceFixtureLoader.js';

const SEQUENCES_DIR = join(process.cwd(), 'tests/fixtures/sequences');

describe('sequenceFixtureLoader', () => {
  it('resolves a fixture by stem across wav/zip/tagged variants', () => {
    const byStem = resolveSequenceFixtureSource(SEQUENCES_DIR, 'sheet-music-reading/medium');
    const byTaggedZip = resolveSequenceFixtureSource(SEQUENCES_DIR, 'sheet-music-reading/medium-tagged.zip');
    const byLegacyWavName = resolveSequenceFixtureSource(SEQUENCES_DIR, 'sheet-music-reading/medium.wav');
    const byBareName = resolveSequenceFixtureSource(SEQUENCES_DIR, 'medium');

    expect(byStem?.file).toBe('sheet-music-reading/medium-tagged.zip');
    expect(byTaggedZip?.file).toBe('sheet-music-reading/medium-tagged.zip');
    expect(byLegacyWavName?.file).toBe('sheet-music-reading/medium-tagged.zip');
    expect(byBareName?.file).toBe('sheet-music-reading/medium-tagged.zip');
  });
});
