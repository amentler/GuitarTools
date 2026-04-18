/**
 * tests/unit/chordDetectionAudio.test.js
 *
 * Integration tests for chord recognition from WAV fixtures.
 * Uses computeDbSpectrum + detectPeaksFromSpectrum + matchChordToTarget pipeline.
 *
 * Fixture layout:
 *   tests/fixtures/chords/G-Dur/g_chord.wav   – real guitar G-Dur recording
 *   tests/fixtures/chords/C-Dur/synth.wav      – synthetic C-Dur chord
 *   tests/fixtures/chords/E-Dur/synth.wav      – synthetic E-Dur chord
 */

import { describe, it, expect } from 'vitest';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { readWavFile } from '../helpers/wavDecoder.js';
import { detectChordFromSamples, sliceCenterWindow } from '../helpers/chordFixtureRunner.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const FIXTURES = join(__dirname, '../fixtures/chords');

// ── Iteration 1: G-Dur positive recognition from real recording ───────────────

describe('G-Dur – real recording (g_chord.wav)', () => {
  it('recognises the G major chord', () => {
    const { samples, sampleRate } = readWavFile(join(FIXTURES, 'G-Dur/g_chord.wav'));
    const window = sliceCenterWindow(samples, 16384);
    const result = detectChordFromSamples(window, sampleRate, 'G-Dur');

    expect(result.isCorrect).toBe(true);
    expect(result.confidence).toBeGreaterThanOrEqual(1.0);
  });

  // ── Iteration 2: negative – G chord must not match other chords ─────────────

  it('is not mistaken for C-Dur (missing C note)', () => {
    const { samples, sampleRate } = readWavFile(join(FIXTURES, 'G-Dur/g_chord.wav'));
    const window = sliceCenterWindow(samples, 16384);
    const result = detectChordFromSamples(window, sampleRate, 'C-Dur');
    // C-Dur needs C, E, G  — a G chord has G, B, D so C and E should be absent
    expect(result.isCorrect).toBe(false);
  });

  it('is not mistaken for D-Dur (missing A note)', () => {
    const { samples, sampleRate } = readWavFile(join(FIXTURES, 'G-Dur/g_chord.wav'));
    const window = sliceCenterWindow(samples, 16384);
    const result = detectChordFromSamples(window, sampleRate, 'D-Dur');
    // D-Dur needs D, F#, A  — G chord has no A or F#
    expect(result.isCorrect).toBe(false);
  });
});

// ── Iteration 3: synthetic C-Dur chord ───────────────────────────────────────

describe('C-Dur – synthetic chord (synth.wav)', () => {
  it('recognises the C major chord', () => {
    const { samples, sampleRate } = readWavFile(join(FIXTURES, 'C-Dur/synth.wav'));
    const window = sliceCenterWindow(samples, 16384);
    const result = detectChordFromSamples(window, sampleRate, 'C-Dur');

    expect(result.isCorrect).toBe(true);
    expect(result.confidence).toBeGreaterThanOrEqual(1.0);
  });

  it('is not mistaken for G-Dur', () => {
    const { samples, sampleRate } = readWavFile(join(FIXTURES, 'C-Dur/synth.wav'));
    const window = sliceCenterWindow(samples, 16384);
    const result = detectChordFromSamples(window, sampleRate, 'G-Dur');
    // G-Dur needs G, B, D  — C chord has no B or D
    expect(result.isCorrect).toBe(false);
  });

  it('is not mistaken for E-Moll', () => {
    const { samples, sampleRate } = readWavFile(join(FIXTURES, 'C-Dur/synth.wav'));
    const window = sliceCenterWindow(samples, 16384);
    const result = detectChordFromSamples(window, sampleRate, 'E-Moll');
    // E-Moll needs E, G, B  — C chord has no B
    expect(result.isCorrect).toBe(false);
  });
});

// ── Iteration 3: synthetic E-Moll chord ──────────────────────────────────────

describe('E-Moll – synthetic chord (synth.wav)', () => {
  it('recognises the E minor chord', () => {
    const { samples, sampleRate } = readWavFile(join(FIXTURES, 'E-Moll/synth.wav'));
    const window = sliceCenterWindow(samples, 16384);
    const result = detectChordFromSamples(window, sampleRate, 'E-Moll');

    expect(result.isCorrect).toBe(true);
    expect(result.confidence).toBeGreaterThanOrEqual(1.0);
  });

  it('is not mistaken for C-Dur', () => {
    const { samples, sampleRate } = readWavFile(join(FIXTURES, 'E-Moll/synth.wav'));
    const window = sliceCenterWindow(samples, 16384);
    const result = detectChordFromSamples(window, sampleRate, 'C-Dur');
    // C-Dur needs C, E, G  — E-Moll has no C
    expect(result.isCorrect).toBe(false);
  });

  it('is not mistaken for G-Dur', () => {
    const { samples, sampleRate } = readWavFile(join(FIXTURES, 'E-Moll/synth.wav'));
    const window = sliceCenterWindow(samples, 16384);
    const result = detectChordFromSamples(window, sampleRate, 'G-Dur');
    // G-Dur needs G, B, D  — E-Moll has no D
    expect(result.isCorrect).toBe(false);
  });
});
