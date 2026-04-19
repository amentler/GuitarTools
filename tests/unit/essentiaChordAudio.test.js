/**
 * tests/unit/essentiaChordAudio.test.js
 *
 * Integration tests for the essentia HPCP chord recognition pipeline using
 * WAV fixture files. The full application pipeline is exercised:
 *
 *   computeDbSpectrum → detectEssentiaPeaks → computeHpcpPureJS
 *   → averageHpcps → matchHpcpToChord
 *
 * The essentia WASM library is NOT loaded — computeHpcpPureJS provides an
 * equivalent pure-JS implementation, and detectEssentiaPeaks is the same
 * pure function used in production. This tests the app's pipeline code, not
 * the third-party library.
 *
 * Fixture layout (shared with chordDetectionAudio.test.js):
 *   tests/fixtures/chords/{ChordName}/*.wav  – auto-discovered positive tests
 */

import { describe, it, expect } from 'vitest';
import { join, dirname } from 'path';
import { readdirSync, existsSync } from 'fs';
import { fileURLToPath } from 'url';
import { readWavFile } from '../helpers/wavDecoder.js';
import { detectEssentiaChordFromSamples } from '../helpers/essentiaChordFixtureRunner.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const FIXTURES = join(__dirname, '../fixtures/chords');

// ── Auto-discovery: positive recognition for every chord subfolder ────────────
// Each subfolder name IS the chord name. Every *.wav inside → one test.

const chordDirs = readdirSync(FIXTURES, { withFileTypes: true })
  .filter(e => e.isDirectory())
  .map(e => e.name);

for (const chordName of chordDirs) {
  const dir = join(FIXTURES, chordName);
  const wavFiles = existsSync(dir)
    ? readdirSync(dir).filter(f => f.endsWith('.wav'))
    : [];

  if (wavFiles.length === 0) continue;

  describe(`Essentia Auto: ${chordName} – ${wavFiles.length} Aufnahme(n)`, () => {
    for (const wavFile of wavFiles) {
      it(`erkennt ${chordName} aus ${wavFile} (HPCP)`, () => {
        const { samples, sampleRate } = readWavFile(join(dir, wavFile));
        const result = detectEssentiaChordFromSamples(samples, sampleRate, chordName);
        expect(
          result.isCorrect,
          `${wavFile}: confidence=${result.confidence.toFixed(3)}, bestMatch=${result.bestMatch}`,
        ).toBe(true);
      });
    }
  });
}

// ── G-Dur positive and negative ───────────────────────────────────────────────

describe('Essentia: G-Dur (g_chord.wav)', () => {
  it('recognises G-Dur via HPCP', () => {
    const { samples, sampleRate } = readWavFile(join(FIXTURES, 'G-Dur/g_chord.wav'));
    const result = detectEssentiaChordFromSamples(samples, sampleRate, 'G-Dur');
    expect(result.isCorrect).toBe(true);
    expect(result.confidence).toBeGreaterThan(0.65);
  });

  it('does not match C-Dur (missing C)', () => {
    const { samples, sampleRate } = readWavFile(join(FIXTURES, 'G-Dur/g_chord.wav'));
    const result = detectEssentiaChordFromSamples(samples, sampleRate, 'C-Dur');
    expect(result.isCorrect).toBe(false);
  });

  it('does not match D-Dur (missing A)', () => {
    const { samples, sampleRate } = readWavFile(join(FIXTURES, 'G-Dur/g_chord.wav'));
    const result = detectEssentiaChordFromSamples(samples, sampleRate, 'D-Dur');
    expect(result.isCorrect).toBe(false);
  });
});

// ── C-Dur positive and negative ───────────────────────────────────────────────

describe('Essentia: C-Dur (synth.wav)', () => {
  it('recognises C-Dur via HPCP', () => {
    const { samples, sampleRate } = readWavFile(join(FIXTURES, 'C-Dur/synth.wav'));
    const result = detectEssentiaChordFromSamples(samples, sampleRate, 'C-Dur');
    expect(result.isCorrect).toBe(true);
    expect(result.confidence).toBeGreaterThan(0.65);
  });

  it('does not match G-Dur (missing B, D)', () => {
    const { samples, sampleRate } = readWavFile(join(FIXTURES, 'C-Dur/synth.wav'));
    const result = detectEssentiaChordFromSamples(samples, sampleRate, 'G-Dur');
    expect(result.isCorrect).toBe(false);
  });

  it('does not match E-Moll (missing B)', () => {
    const { samples, sampleRate } = readWavFile(join(FIXTURES, 'C-Dur/synth.wav'));
    const result = detectEssentiaChordFromSamples(samples, sampleRate, 'E-Moll');
    expect(result.isCorrect).toBe(false);
  });
});

describe('Essentia: C-Dur (c_chord.wav)', () => {
  it('recognises C-Dur via HPCP', () => {
    const { samples, sampleRate } = readWavFile(join(FIXTURES, 'C-Dur/c_chord.wav'));
    const result = detectEssentiaChordFromSamples(samples, sampleRate, 'C-Dur');
    expect(result.isCorrect).toBe(true);
  });
});

// ── E-Moll positive and negative ─────────────────────────────────────────────

describe('Essentia: E-Moll (eminor_chord.wav)', () => {
  it('recognises E-Moll via HPCP', () => {
    const { samples, sampleRate } = readWavFile(join(FIXTURES, 'E-Moll/eminor_chord.wav'));
    const result = detectEssentiaChordFromSamples(samples, sampleRate, 'E-Moll');
    expect(result.isCorrect).toBe(true);
    expect(result.confidence).toBeGreaterThan(0.65);
  });

  it('does not match C-Dur (missing C)', () => {
    const { samples, sampleRate } = readWavFile(join(FIXTURES, 'E-Moll/eminor_chord.wav'));
    const result = detectEssentiaChordFromSamples(samples, sampleRate, 'C-Dur');
    expect(result.isCorrect).toBe(false);
  });

  it('does not match G-Dur (missing D)', () => {
    const { samples, sampleRate } = readWavFile(join(FIXTURES, 'E-Moll/eminor_chord.wav'));
    const result = detectEssentiaChordFromSamples(samples, sampleRate, 'G-Dur');
    expect(result.isCorrect).toBe(false);
  });
});

describe('Essentia: E-Moll (synth.wav)', () => {
  it('recognises E-Moll via HPCP', () => {
    const { samples, sampleRate } = readWavFile(join(FIXTURES, 'E-Moll/synth.wav'));
    const result = detectEssentiaChordFromSamples(samples, sampleRate, 'E-Moll');
    expect(result.isCorrect).toBe(true);
  });
});
