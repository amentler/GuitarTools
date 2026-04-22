import { describe, it, expect } from 'vitest';
import path from 'path';
import { fileURLToPath } from 'url';
import { readFileSync } from 'fs';
import {
  averageHpcps,
  buildChordTemplates,
  matchHpcpToChord,
} from '../../js/games/chordExerciseEssentia/essentiaChordLogic.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FROZEN_FIXTURES = JSON.parse(
  readFileSync(path.join(__dirname, '../fixtures/chord-hpcp/frozen-hpcp-fixtures.json'), 'utf-8'),
);

const TEMPLATES = buildChordTemplates();

describe('matchHpcpToChord – Frozen HPCP fixtures', () => {
  for (const fixture of FROZEN_FIXTURES) {
    it(`bewertet ${fixture.chordName} aus ${fixture.wavFile} mit eingefrorener HPCP korrekt`, () => {
      const frozenFrames = fixture.hpcpFrames.map(frame => Float32Array.from(frame));
      const avgHpcp = averageHpcps(frozenFrames);
      const result = matchHpcpToChord(avgHpcp, fixture.chordName, TEMPLATES);

      expect(result.isCorrect, `${fixture.wavFile}: confidence=${result.confidence.toFixed(3)}, bestMatch=${result.bestMatch}`).toBe(
        fixture.expected.isCorrect,
      );

      if (fixture.expected.bestMatchContains) {
        expect(result.bestMatch).toContain(fixture.expected.bestMatchContains);
      }
    });
  }
});
