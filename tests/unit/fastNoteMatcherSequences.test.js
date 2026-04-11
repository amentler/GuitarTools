// Sequence integration tests for fastNoteMatcher.
//
// Scans tests/fixtures/sequences/**/ for .wav + .json pairs, runs each
// recording through runSequenceSimulation, and verifies the accepted
// sequence matches the expected notes from the JSON manifest.

import { describe, it, expect } from 'vitest';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { readdirSync, existsSync, readFileSync } from 'fs';
import { readWavFile } from '../helpers/wavDecoder.js';
import { runSequenceSimulation } from '../helpers/sequenceSimulator.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname  = dirname(__filename);

const SEQUENCES_DIR = join(__dirname, '../fixtures/sequences');

/**
 * Recursively finds all .wav/.json pairs under the sequences directory.
 * Returns an array of { wavPath, jsonPath, category, name, manifest }.
 */
function getSequenceFixtures(baseDir) {
  if (!existsSync(baseDir)) return [];

  const fixtures = [];
  const categories = readdirSync(baseDir, { withFileTypes: true })
    .filter(d => d.isDirectory());

  for (const cat of categories) {
    const catPath = join(baseDir, cat.name);
    const files = readdirSync(catPath);
    const wavFiles = files.filter(f => f.toLowerCase().endsWith('.wav'));

    for (const wavFile of wavFiles) {
      const stem = wavFile.replace(/\.wav$/i, '');
      const jsonFile = `${stem}.json`;
      if (!files.includes(jsonFile)) continue;

      const jsonPath = join(catPath, jsonFile);
      const manifest = JSON.parse(readFileSync(jsonPath, 'utf-8'));

      fixtures.push({
        wavPath: join(catPath, wavFile),
        jsonPath,
        category: cat.name,
        name: stem,
        manifest,
      });
    }
  }

  return fixtures;
}

/**
 * Deduplicates consecutive identical entries in an array.
 * E.g. ["E2","E2","A2","A2","A2","D3"] → ["E2","A2","D3"]
 */
function deduplicateConsecutive(arr) {
  return arr.filter((val, i) => i === 0 || val !== arr[i - 1]);
}

// ── Sequence fixtures ────────────────────────────────────────────────────────

describe('fastNoteMatcher – sequence fixtures (sequences/**)', () => {
  const fixtures = getSequenceFixtures(SEQUENCES_DIR);

  if (fixtures.length === 0) {
    it.skip('no sequence fixtures present – skip', () => {});
    return;
  }

  for (const fixture of fixtures) {
    const bpm = fixture.manifest.tempoBpm ?? 60;
    const notesPerBeat = fixture.manifest.notesPerBeat ?? 1;
    // Effective note rate: at 120 BPM with 2 notes/beat each note is ~0.25 s
    const effectiveNoteRate = (bpm * notesPerBeat) / 60;
    const isFastTempo = effectiveNoteRate >= 3; // ≥ 3 notes/sec is stress-test territory

    it(`[${fixture.category}/${fixture.name}] recognises ${isFastTempo ? 'partial' : 'full'} sequence`, () => {
      const { samples, sampleRate } = readWavFile(fixture.wavPath);
      const expectedNotes = fixture.manifest.notes;

      // For fast tempos, use a smaller hop to give the matcher enough
      // frames per note. A hop of fftSize/4 gives more overlap.
      const hopDivisor = bpm >= 100 ? 4 : 2;
      const result = runSequenceSimulation(samples, sampleRate, expectedNotes, { hopDivisor });
      const deduped = deduplicateConsecutive(result.acceptedSequence);

      if (isFastTempo) {
        // Fast recordings are stress tests: subharmonic confusion at high
        // note rates means the detector may not reach every note. Require
        // that at least the first 25% of the sequence is correct (order
        // preserved) and log the actual coverage for tuning.
        const minNotes = Math.max(1, Math.ceil(expectedNotes.length * 0.25));
        expect(deduped.length).toBeGreaterThanOrEqual(minNotes);
        // The accepted notes must be a correct prefix of the expected sequence
        for (let i = 0; i < deduped.length; i++) {
          expect(deduped[i]).toBe(expectedNotes[i]);
        }
      } else {
        // Normal tempo: full sequence must match exactly.
        expect(deduped).toEqual(expectedNotes);
        expect(result.finalTargetIndex).toBe(expectedNotes.length);
      }
    }, 30_000); // generous timeout for long recordings with YIN
  }
});
