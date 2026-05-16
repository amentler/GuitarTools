import { describe, it, expect } from 'vitest';
import { join } from 'path';
import { countGuitarOnsets } from '../helpers/sheetMusicSequenceFingerprint.js';
import {
  discoverSequenceFixtureSources,
  loadSequenceFixtureAudio,
} from '../helpers/sequenceFixtureLoader.js';
import { resolveGuitarOnsetStrategy } from '../../js/shared/audio/guitarOnsetStrategies.js';

const SEQUENCES_DIR = join(process.cwd(), 'tests/fixtures/sequences');

// Tags liegen knapp am Onset-Anfang. Für das Spiel gilt:
//   zu früh feuern → falscher Ton wird erkannt  (streng: nur 1 Fenster früh erlaubt)
//   leicht zu spät → kein Problem               (locker: 3 Fenster nach dem Tag erlaubt)
const WINDOW_MS = 30;
const EARLY_WINDOWS = 1; // bis 30 ms vor dem Tag erlaubt
const LATE_WINDOWS = 3;  // bis 90 ms nach dem Tag erlaubt

function hitsWithinWindow(taggedMs, detectedMs) {
  return taggedMs.filter(tag =>
    detectedMs.some(det => det >= tag - EARLY_WINDOWS * WINDOW_MS && det <= tag + LATE_WINDOWS * WINDOW_MS),
  );
}

describe('countGuitarOnsets – getaggte Onset-Genauigkeit', () => {
  it('broadband-or erkennt alle 16 getaggten Onsets in medium.wav im [-30ms, +90ms]-Fenster', () => {
    const fixture = discoverSequenceFixtureSources(SEQUENCES_DIR)
      .find(entry => entry.file === 'sheet-music-reading/medium.wav');
    const { samples, sampleRate } = loadSequenceFixtureAudio(fixture);
    const { onsetsMs: taggedMs } = fixture.manifest;

    const strategy = resolveGuitarOnsetStrategy('guitar-onset-broadband-or');
    const { timestampsMs: detectedMs } = countGuitarOnsets(samples, sampleRate, { onsetStrategy: strategy });

    const hits = hitsWithinWindow(taggedMs, detectedMs);

    expect(
      hits.length,
      `Nur ${hits.length}/${taggedMs.length} Onsets im [-${EARLY_WINDOWS * WINDOW_MS}ms, +${LATE_WINDOWS * WINDOW_MS}ms]-Fenster.\n` +
      `Erkannt: ${detectedMs.join(', ')}\n` +
      `Tags:    ${taggedMs.join(', ')}`,
    ).toBe(taggedMs.length);
  });
}, 60_000);
