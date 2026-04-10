import { describe, it, expect } from 'vitest';
import { tmpdir } from 'os';
import { join, basename } from 'path';
import { writeFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import { decodeWav, readWavFile } from '../helpers/wavDecoder.js';
import { getAudioFixtures, detectNoteFromSamples } from '../helpers/audioFixtureRunner.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const FIXTURES_DIR = join(__dirname, '../fixtures/audio');

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Builds a minimal 16-bit PCM mono WAV buffer.
 * @param {number} sampleRate
 * @param {number[]} int16Samples  Values in range -32768..32767
 */
function buildWav16Mono(sampleRate, int16Samples) {
  const dataBytes = int16Samples.length * 2;
  const buf = Buffer.alloc(44 + dataBytes);
  buf.write('RIFF', 0, 'ascii');
  buf.writeUInt32LE(36 + dataBytes, 4);
  buf.write('WAVE', 8, 'ascii');
  buf.write('fmt ', 12, 'ascii');
  buf.writeUInt32LE(16, 16);
  buf.writeUInt16LE(1, 20);              // PCM
  buf.writeUInt16LE(1, 22);              // mono
  buf.writeUInt32LE(sampleRate, 24);
  buf.writeUInt32LE(sampleRate * 2, 28); // byteRate
  buf.writeUInt16LE(2, 32);             // blockAlign
  buf.writeUInt16LE(16, 34);            // bitsPerSample
  buf.write('data', 36, 'ascii');
  buf.writeUInt32LE(dataBytes, 40);
  for (let i = 0; i < int16Samples.length; i++) {
    buf.writeInt16LE(int16Samples[i], 44 + i * 2);
  }
  return buf;
}

/**
 * Builds a 16-bit PCM stereo WAV buffer.
 * @param {number} sampleRate
 * @param {number[]} leftSamples
 * @param {number[]} rightSamples
 */
function buildWav16Stereo(sampleRate, leftSamples, rightSamples) {
  const numFrames = leftSamples.length;
  const dataBytes = numFrames * 4; // 2 ch * 2 bytes
  const buf = Buffer.alloc(44 + dataBytes);
  buf.write('RIFF', 0, 'ascii');
  buf.writeUInt32LE(36 + dataBytes, 4);
  buf.write('WAVE', 8, 'ascii');
  buf.write('fmt ', 12, 'ascii');
  buf.writeUInt32LE(16, 16);
  buf.writeUInt16LE(1, 20);              // PCM
  buf.writeUInt16LE(2, 22);              // stereo
  buf.writeUInt32LE(sampleRate, 24);
  buf.writeUInt32LE(sampleRate * 4, 28); // byteRate
  buf.writeUInt16LE(4, 32);             // blockAlign
  buf.writeUInt16LE(16, 34);            // bitsPerSample
  buf.write('data', 36, 'ascii');
  buf.writeUInt32LE(dataBytes, 40);
  for (let i = 0; i < numFrames; i++) {
    buf.writeInt16LE(leftSamples[i], 44 + i * 4);
    buf.writeInt16LE(rightSamples[i], 44 + i * 4 + 2);
  }
  return buf;
}

/** Generates a sine-wave Float32Array at the given frequency. */
function synth(freq, sampleRate, numSamples, amp = 0.35) {
  const buf = new Float32Array(numSamples);
  for (let i = 0; i < numSamples; i++) {
    buf[i] = amp * Math.sin(2 * Math.PI * freq * i / sampleRate);
  }
  return buf;
}

// ---------------------------------------------------------------------------
// decodeWav – Unit Tests
// ---------------------------------------------------------------------------

describe('decodeWav – 16-bit PCM mono', () => {
  it('gibt sampleRate und Float32Array zurück', () => {
    const wav = buildWav16Mono(44100, new Array(200).fill(16384));
    const { samples, sampleRate } = decodeWav(wav);
    expect(sampleRate).toBe(44100);
    expect(samples).toBeInstanceOf(Float32Array);
    expect(samples.length).toBe(200);
  });

  it('normalisiert 16-bit-Werte korrekt auf -1..1', () => {
    // 16384 / 32768 = 0.5
    const wav = buildWav16Mono(44100, [16384, -16384, 32767, -32768]);
    const { samples } = decodeWav(wav);
    expect(samples[0]).toBeCloseTo(0.5, 2);
    expect(samples[1]).toBeCloseTo(-0.5, 2);
    expect(samples[2]).toBeCloseTo(1.0, 1);
    expect(samples[3]).toBeCloseTo(-1.0, 1);
  });

  it('wirft bei leerem Buffer', () => {
    expect(() => decodeWav(Buffer.alloc(0))).toThrow();
  });

  it('wirft bei fehlendem RIFF-Header', () => {
    const bad = Buffer.from('XXXX????WAVE', 'ascii');
    expect(() => decodeWav(bad)).toThrow();
  });
});

describe('decodeWav – Stereo', () => {
  it('gibt nur den linken Kanal zurück', () => {
    const left = [10000, 20000];
    const right = [-10000, -20000];
    const wav = buildWav16Stereo(44100, left, right);
    const { samples } = decodeWav(wav);
    expect(samples.length).toBe(2);
    expect(samples[0]).toBeCloseTo(left[0] / 32768, 2);
    expect(samples[1]).toBeCloseTo(left[1] / 32768, 2);
  });
});

// ---------------------------------------------------------------------------
// readWavFile – Unit Test
// ---------------------------------------------------------------------------

describe('readWavFile', () => {
  it('liest eine WAV-Datei vom Dateisystem und decodiert sie', () => {
    const int16s = new Array(500).fill(8192);
    const wav = buildWav16Mono(48000, int16s);
    const tmpPath = join(tmpdir(), `tuner-test-${Date.now()}.wav`);
    writeFileSync(tmpPath, wav);
    const { samples, sampleRate } = readWavFile(tmpPath);
    expect(sampleRate).toBe(48000);
    expect(samples.length).toBe(500);
    expect(samples[0]).toBeCloseTo(0.25, 2);
  });
});

// ---------------------------------------------------------------------------
// detectNoteFromSamples – Unit Tests
// ---------------------------------------------------------------------------

describe('detectNoteFromSamples', () => {
  it('erkennt E2 (82.4 Hz) aus einem synthetischen Sinussignal', () => {
    const samples = synth(82.41, 44100, 44100);
    const result = detectNoteFromSamples(samples, 44100);
    expect(result).not.toBeNull();
    expect(result.note).toBe('E');
    expect(result.octave).toBe(2);
  });

  it('gibt null zurück bei Stille (alle Samples = 0)', () => {
    const samples = new Float32Array(44100);
    const result = detectNoteFromSamples(samples, 44100);
    expect(result).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// getAudioFixtures – Unit Test
// ---------------------------------------------------------------------------

describe('getAudioFixtures', () => {
  it('gibt ein Array zurück (leer wenn keine WAV-Dateien vorhanden)', () => {
    const fixtures = getAudioFixtures(FIXTURES_DIR);
    expect(Array.isArray(fixtures)).toBe(true);
  });

  it('parst Note und Oktave korrekt aus Ordner-Namen', () => {
    const fixtures = getAudioFixtures(FIXTURES_DIR);
    for (const f of fixtures) {
      expect(f.expectedNote).toMatch(/^[A-G]#?$/);
      expect(typeof f.expectedOctave).toBe('number');
      expect(f.folderName).toMatch(/^[A-G]#?\d$/);
    }
  });
});

// ---------------------------------------------------------------------------
// Audio Fixture Integration Tests (dynamisch, nur wenn WAV-Dateien vorhanden)
// ---------------------------------------------------------------------------

describe('Audio Fixture Integration Tests', () => {
  const fixtures = getAudioFixtures(FIXTURES_DIR);

  if (fixtures.length === 0) {
    it.skip(
      'keine WAV-Dateien vorhanden – eigene Gitarren-Aufnahmen in tests/fixtures/audio/{Note}/ ablegen',
      () => {},
    );
  } else {
    for (const fixture of fixtures) {
      it(`[${fixture.folderName}] ${basename(fixture.filePath)} → erkennt Note ${fixture.folderName}`, () => {
        const { samples, sampleRate } = readWavFile(fixture.filePath);
        const result = detectNoteFromSamples(samples, sampleRate);
        expect(result).not.toBeNull();
        expect(result.note).toBe(fixture.expectedNote);
        expect(result.octave).toBe(fixture.expectedOctave);
      });
    }
  }
});
