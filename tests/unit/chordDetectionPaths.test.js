import { describe, expect, it } from 'vitest';
import {
  CHORD_DETECTION_PATHS,
  getDefaultChordDetectionPath,
  isEssentiaDetectionPath,
  resolveChordDetectionPath,
} from '../../js/games/chordExerciseEssentia/chordDetectionPaths.js';

describe('chordDetectionPaths', () => {
  it('setzt Essentia als Entwicklungsdefault', () => {
    expect(getDefaultChordDetectionPath()).toBe(CHORD_DETECTION_PATHS.ESSENTIA);
    expect(resolveChordDetectionPath()).toBe(CHORD_DETECTION_PATHS.ESSENTIA);
  });

  it('mappt den Legacy-Boolean deterministisch auf getrennte Pfade', () => {
    expect(resolveChordDetectionPath({ preferEssentia: true })).toBe(CHORD_DETECTION_PATHS.ESSENTIA);
    expect(resolveChordDetectionPath({ preferEssentia: false })).toBe(CHORD_DETECTION_PATHS.PURE_JS);
  });

  it('bevorzugt eine explizite Pfadwahl vor dem Legacy-Boolean', () => {
    expect(resolveChordDetectionPath({
      path: CHORD_DETECTION_PATHS.PURE_JS,
      preferEssentia: true,
    })).toBe(CHORD_DETECTION_PATHS.PURE_JS);
  });

  it('erkennt nur den Essentia-Pfad als produktiven Essentia-Zweig', () => {
    expect(isEssentiaDetectionPath(CHORD_DETECTION_PATHS.ESSENTIA)).toBe(true);
    expect(isEssentiaDetectionPath(CHORD_DETECTION_PATHS.PURE_JS)).toBe(false);
  });
});
