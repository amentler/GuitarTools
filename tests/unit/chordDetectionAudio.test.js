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

// ── Iteration 6: open strum without a chord (0_strum.wav) ────────────────────
// Strumming all six open strings produces E2, A2, D3, G3 – no complete chord.

describe('0_strum – open strings, no chord fingered', () => {
  it('is not recognised as C-Dur', () => {
    const { samples, sampleRate } = readWavFile(join(FIXTURES, '0_strum.wav'));
    const window = sliceCenterWindow(samples, 16384);
    const result = detectChordFromSamples(window, sampleRate, 'C-Dur');
    // C-Dur needs C, E, G – open strings give E, A, D, G (no C)
    expect(result.isCorrect).toBe(false);
  });

  it('is not recognised as G-Dur', () => {
    const { samples, sampleRate } = readWavFile(join(FIXTURES, '0_strum.wav'));
    const window = sliceCenterWindow(samples, 16384);
    const result = detectChordFromSamples(window, sampleRate, 'G-Dur');
    // G-Dur needs G, B, D – open strings have no B
    expect(result.isCorrect).toBe(false);
  });

  it('is not recognised as E-Moll', () => {
    const { samples, sampleRate } = readWavFile(join(FIXTURES, '0_strum.wav'));
    const window = sliceCenterWindow(samples, 16384);
    const result = detectChordFromSamples(window, sampleRate, 'E-Moll');
    // E-Moll needs E, G, B – open strings have no B
    expect(result.isCorrect).toBe(false);
  });

  it('is not recognised as D-Dur', () => {
    const { samples, sampleRate } = readWavFile(join(FIXTURES, '0_strum.wav'));
    const window = sliceCenterWindow(samples, 16384);
    const result = detectChordFromSamples(window, sampleRate, 'D-Dur');
    // D-Dur needs D, F#, A – open strings have no F#
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

// ── Iteration 7: D chord played with open E and A strings (d_chord_wrong.wav) ─
// A D chord requires only strings 4–1; strumming string 6 (E2) and 5 (A2)
// adds an open E which is not in D-Dur – the chord must not be accepted.

describe('d_chord_wrong – D chord with open E and A strings', () => {
  it('is NOT recognised as D-Dur (open E string disqualifies it)', () => {
    const { samples, sampleRate } = readWavFile(join(FIXTURES, 'd_chord_wrong.wav'));
    const window = sliceCenterWindow(samples, 16384);
    const result = detectChordFromSamples(window, sampleRate, 'D-Dur');
    // D-Dur needs D, F#, A – the open E string adds a disqualifying extra note
    expect(result.isCorrect).toBe(false);
    expect(result.extraNotes).toContain('E');
  });

  it('is NOT recognised as E-Moll either', () => {
    const { samples, sampleRate } = readWavFile(join(FIXTURES, 'd_chord_wrong.wav'));
    const window = sliceCenterWindow(samples, 16384);
    const result = detectChordFromSamples(window, sampleRate, 'E-Moll');
    // E-Moll needs E, G, B – the chord lacks B
    expect(result.isCorrect).toBe(false);
  });
});

// ── Iteration 4: real C-Dur recording (c_chord.wav) ─────────────────────────

describe('C-Dur – real recording (c_chord.wav)', () => {
  it('recognises the C major chord', () => {
    const { samples, sampleRate } = readWavFile(join(FIXTURES, 'C-Dur/c_chord.wav'));
    const window = sliceCenterWindow(samples, 16384);
    const result = detectChordFromSamples(window, sampleRate, 'C-Dur');

    expect(result.isCorrect).toBe(true);
    expect(result.confidence).toBeGreaterThanOrEqual(1.0);
  });

  it('is not mistaken for G-Dur', () => {
    const { samples, sampleRate } = readWavFile(join(FIXTURES, 'C-Dur/c_chord.wav'));
    const window = sliceCenterWindow(samples, 16384);
    const result = detectChordFromSamples(window, sampleRate, 'G-Dur');
    // G-Dur needs G, B, D – C chord has no B or D
    expect(result.isCorrect).toBe(false);
  });

  it('is not mistaken for E-Moll', () => {
    const { samples, sampleRate } = readWavFile(join(FIXTURES, 'C-Dur/c_chord.wav'));
    const window = sliceCenterWindow(samples, 16384);
    const result = detectChordFromSamples(window, sampleRate, 'E-Moll');
    // E-Moll needs E, G, B – C chord has no B
    expect(result.isCorrect).toBe(false);
  });
});

// ── Iteration 5: real E-Moll recording (eminor_chord.wav) ────────────────────

describe('E-Moll – real recording (eminor_chord.wav)', () => {
  it('recognises the E minor chord', () => {
    const { samples, sampleRate } = readWavFile(join(FIXTURES, 'E-Moll/eminor_chord.wav'));
    const window = sliceCenterWindow(samples, 16384);
    const result = detectChordFromSamples(window, sampleRate, 'E-Moll');

    expect(result.isCorrect).toBe(true);
    expect(result.confidence).toBeGreaterThanOrEqual(1.0);
  });

  it('is not mistaken for C-Dur', () => {
    const { samples, sampleRate } = readWavFile(join(FIXTURES, 'E-Moll/eminor_chord.wav'));
    const window = sliceCenterWindow(samples, 16384);
    const result = detectChordFromSamples(window, sampleRate, 'C-Dur');
    // C-Dur needs C, E, G – E-Moll has no C
    expect(result.isCorrect).toBe(false);
  });

  it('is not mistaken for G-Dur', () => {
    const { samples, sampleRate } = readWavFile(join(FIXTURES, 'E-Moll/eminor_chord.wav'));
    const window = sliceCenterWindow(samples, 16384);
    const result = detectChordFromSamples(window, sampleRate, 'G-Dur');
    // G-Dur needs G, B, D – E-Moll has no D
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
