import { describe, it, expect } from 'vitest';
import path from 'path';
import { fileURLToPath } from 'url';
import { readFileSync } from 'fs';
import {
  averageHpcps,
  buildChordTemplates,
  matchHpcpToChord,
} from '../../js/games/chordExerciseEssentia/essentiaChordLogic.js';
import { extractBassSupportMapFromWav } from '../helpers/chordBassExtraction.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FROZEN_FIXTURES = JSON.parse(
  readFileSync(path.join(__dirname, '../fixtures/chord-hpcp/frozen-hpcp-fixtures.json'), 'utf-8'),
);

const TEMPLATES = buildChordTemplates();
const EMPTY_STRUM_FIXTURE = FROZEN_FIXTURES.find(fixture => fixture.wavFile === '0_strum.wav');
const EMPTY_STRUM_HPCP = averageHpcps(EMPTY_STRUM_FIXTURE.hpcpFrames.map(frame => Float32Array.from(frame)));
const ALL_CHORD_NAMES = Object.keys(TEMPLATES);
const EMPTY_STRUM_BASS_SUPPORT = extractBassSupportMapFromWav('0_strum.wav', ALL_CHORD_NAMES);

describe('matchHpcpToChord – Frozen HPCP fixtures', () => {
  for (const fixture of FROZEN_FIXTURES) {
    it(`bewertet ${fixture.chordName} aus ${fixture.wavFile} mit eingefrorener HPCP korrekt`, () => {
      const frozenFrames = fixture.hpcpFrames.map(frame => Float32Array.from(frame));
      const avgHpcp = averageHpcps(frozenFrames);
      const bassSupportByChord = extractBassSupportMapFromWav(fixture.wavFile, ALL_CHORD_NAMES);
      const result = matchHpcpToChord(avgHpcp, fixture.chordName, TEMPLATES, undefined, { bassSupportByChord });

      expect(result.isCorrect, `${fixture.wavFile}: confidence=${result.confidence.toFixed(3)}, bestMatch=${result.bestMatch}`).toBe(
        fixture.expected.isCorrect,
      );

      if (fixture.expected.bestMatchContains) {
        expect(result.bestMatch).toContain(fixture.expected.bestMatchContains);
      }
    });
  }

  it.each(ALL_CHORD_NAMES)('bewertet leeres Strumming nicht als %s', (chordName) => {
      const result = matchHpcpToChord(EMPTY_STRUM_HPCP, chordName, TEMPLATES, undefined, {
        bassSupportByChord: EMPTY_STRUM_BASS_SUPPORT,
      });

      expect(
        result.isCorrect,
        `0_strum.wav -> ${chordName}: confidence=${result.confidence.toFixed(3)}, bestMatch=${result.bestMatch}`,
      ).toBe(false);
    });

  it('akzeptiert A-Moll (2-Finger) als explizite Sonderregel trotz sus2-artiger Evidenz', () => {
    const fixture = FROZEN_FIXTURES.find(entry => entry.wavFile === 'A-Moll (2-Finger)/01.wav');
    const avgHpcp = averageHpcps(fixture.hpcpFrames.map(frame => Float32Array.from(frame)));
    const bassSupportByChord = extractBassSupportMapFromWav(fixture.wavFile, ALL_CHORD_NAMES);

    const simplifiedResult = matchHpcpToChord(avgHpcp, 'A-Moll (2-Finger)', TEMPLATES, undefined, { bassSupportByChord });
    const standardResult = matchHpcpToChord(avgHpcp, 'A-Moll', TEMPLATES, undefined, { bassSupportByChord });

    expect(simplifiedResult.isCorrect).toBe(true);
    expect(['A-Moll (2-Finger)', 'Asus2']).toContain(simplifiedResult.bestMatch);
    expect(standardResult.isCorrect).toBe(false);
  });
});
