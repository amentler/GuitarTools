import { describe, expect, it } from 'vitest';
import path from 'path';
import { fileURLToPath } from 'url';
import {
  averageHpcps,
  buildChordTemplates,
} from '../../js/games/chordExerciseEssentia/essentiaChordLogic.js';
import {
  matchPureJsHpcpToChord,
  PURE_JS_MATCHER_REFERENCE_COMMIT,
} from '../../js/games/chordExerciseEssentia/pureJsChordMatcher.js';
import { CHORD_HPCP_FIXTURE_CASES } from '../helpers/chordHpcpFixtureCatalog.js';
import { extractHpcpAnalysisFromWav } from '../helpers/chordHpcpExtraction.js';
import { extractBassSupportMapFromWav } from '../helpers/chordBassExtraction.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CHORD_FIXTURES_DIR = path.join(__dirname, '../fixtures/chords');

const TEMPLATES = buildChordTemplates();
const ALL_CHORD_NAMES = Object.keys(TEMPLATES);
const OPEN_STRUM_CASES = CHORD_HPCP_FIXTURE_CASES.filter(fixture => fixture.wavFile.startsWith('open-strums/'));
const TARGETED_CASES = CHORD_HPCP_FIXTURE_CASES.filter(fixture => !fixture.wavFile.startsWith('open-strums/'));

const analysisCache = new Map();
const bassSupportCache = new Map();

function getDirectAnalysis(relativeWavFile) {
  if (!analysisCache.has(relativeWavFile)) {
    analysisCache.set(relativeWavFile, extractHpcpAnalysisFromWav(path.join(CHORD_FIXTURES_DIR, relativeWavFile)));
  }

  return analysisCache.get(relativeWavFile);
}

function getBassSupport(relativeWavFile) {
  if (!bassSupportCache.has(relativeWavFile)) {
    bassSupportCache.set(relativeWavFile, extractBassSupportMapFromWav(relativeWavFile, ALL_CHORD_NAMES));
  }

  return bassSupportCache.get(relativeWavFile);
}

function getDirectMatchResult(relativeWavFile, probeChordName) {
  const analysis = getDirectAnalysis(relativeWavFile);
  const avgHpcp = averageHpcps(analysis.hpcpFrames);
  const bassSupportByChord = getBassSupport(relativeWavFile);

  return matchPureJsHpcpToChord(avgHpcp, probeChordName, TEMPLATES, undefined, { bassSupportByChord });
}

describe('matchPureJsHpcpToChord – Direct WAV fixtures', () => {
  it(`bindet den historischen Pure-JS-Matcher-Stand ${PURE_JS_MATCHER_REFERENCE_COMMIT} als eigenen Pfad ein`, () => {
    expect(PURE_JS_MATCHER_REFERENCE_COMMIT).toBe('c1125a8');
  });

  for (const fixture of TARGETED_CASES) {
    it(`liefert für ${fixture.wavFile} im historischen Pure-JS-Pfad ein auswertbares Ergebnis`, () => {
      const result = getDirectMatchResult(fixture.wavFile, fixture.chordName);

      expect(typeof result.isCorrect, `${fixture.wavFile}: confidence=${result.confidence.toFixed(3)}, bestMatch=${result.bestMatch}`).toBe(
        'boolean',
      );
      expect(typeof result.confidence).toBe('number');
      expect(Number.isFinite(result.confidence)).toBe(true);

      if (fixture.expected.bestMatchContains) {
        expect(result.bestMatch).toContain(fixture.expected.bestMatchContains);
      }
    });
  }

  for (const fixture of OPEN_STRUM_CASES) {
    it.each(ALL_CHORD_NAMES)(`bewertet ${fixture.wavFile} direkt aus der WAV nicht als %s`, (probeChordName) => {
      const result = getDirectMatchResult(fixture.wavFile, probeChordName);

      expect(
        result.isCorrect,
        `${fixture.wavFile} -> ${probeChordName}: confidence=${result.confidence.toFixed(3)}, bestMatch=${result.bestMatch}`,
      ).toBe(false);
    });
  }
});
