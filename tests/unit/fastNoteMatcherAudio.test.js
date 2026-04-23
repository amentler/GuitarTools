// Fixture-based tests for fastNoteMatcher, using real guitar + synthetic WAV
// recordings that are already present in tests/fixtures/.
//
// Approach: per file, slice an adaptively-sized window from the middle of the
// recording (skipping initial attack / final decay) and run classifyFrame once
// against the expected note from the parent folder. The expected result is
// status === 'correct' and detectedPitch === expectedPitch.

import { describe, it, expect } from 'vitest';
import { join, basename, dirname } from 'path';
import { fileURLToPath } from 'url';
import { readWavFile } from '../helpers/wavDecoder.js';
import { getAudioFixtures } from '../helpers/audioFixtureRunner.js';
import {
  classifyFrame,
  getRecommendedFftSize,
} from '../../js/shared/audio/fastNoteMatcher.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname  = dirname(__filename);

const FIXTURES_DIR          = join(__dirname, '../fixtures/audio');
const IMPRECISE_FIXTURES    = join(__dirname, '../fixtures/audio-imprecise');
const SYNTH_FIXTURES_DIR    = join(__dirname, '../fixtures/synth');

/**
 * Slices an adaptive window from the middle of the recording so the buffer
 * contains steady-state signal, not the initial pick attack. Falls back to a
 * window anchored at the end if the recording is shorter than the requested
 * size.
 */
function sliceCenterWindow(samples, windowSize) {
  if (samples.length <= windowSize) {
    // Right-pad with zeros so classifyFrame still gets a buffer of the
    // requested size. This only triggers on unexpectedly short fixtures.
    const padded = new Float32Array(windowSize);
    padded.set(samples, 0);
    return padded;
  }
  const start = Math.floor((samples.length - windowSize) / 2);
  return samples.slice(start, start + windowSize);
}

function runCase(fixture, { requirePrecision }) {
  const expectedPitch = `${fixture.expectedNote}${fixture.expectedOctave}`;
  const { samples, sampleRate } = readWavFile(fixture.filePath);
  const windowSize = getRecommendedFftSize(expectedPitch, sampleRate);
  const window = sliceCenterWindow(samples, windowSize);

  const res = classifyFrame(window, sampleRate, expectedPitch);

  if (requirePrecision) {
    expect(res.status).toBe('correct');
    expect(res.detectedPitch).toBe(expectedPitch);
  } else {
    // Imprecise fixtures: we only require that the NOTE is correct; the
    // status may be wrong because the recording exceeds ±35 cent.
    expect(res.detectedPitch).toBe(expectedPitch);
  }
}

// ── Well-tuned guitar recordings (real) ───────────────────────────────────────

describe('fastNoteMatcher – real guitar fixtures (audio/{Note}/)', () => {
  const fixtures = getAudioFixtures(FIXTURES_DIR);
  if (fixtures.length === 0) {
    it.skip('no recordings present – skip', () => {});
  } else {
    for (const fixture of fixtures) {
      it(`[${fixture.folderName}] ${basename(fixture.filePath)} → correct`, () => {
        runCase(fixture, { requirePrecision: true });
      // Real-guitar fixtures on E2 can take up to ~1 s per YIN pass on the
      // slowest CI runner; keep a generous timeout.
      }, 10_000);
    }
  }
});

// ── Slightly detuned guitar recordings (real) ─────────────────────────────────

describe('fastNoteMatcher – detuned guitar fixtures (audio-imprecise/{Note}/)', () => {
  const fixtures = getAudioFixtures(IMPRECISE_FIXTURES);
  if (fixtures.length === 0) {
    it.skip('no detuned recordings present – skip', () => {});
  } else {
    for (const fixture of fixtures) {
      it(`[${fixture.folderName}] ${basename(fixture.filePath)} → note matches`, () => {
        runCase(fixture, { requirePrecision: false });
      }, 10_000);
    }
  }
});

// ── Synthetic sine wave fixtures (E2–C5) ──────────────────────────────────────

describe('fastNoteMatcher – synthetic sine fixtures (synth/{Note}/)', () => {
  const fixtures = getAudioFixtures(SYNTH_FIXTURES_DIR);
  if (fixtures.length === 0) {
    it.skip('no synth fixtures present – skip', () => {});
  } else {
    for (const fixture of fixtures) {
      it(`[${fixture.folderName}] synth.wav → correct`, () => {
        runCase(fixture, { requirePrecision: true });
      }, 10_000);
    }
  }
});
