/**
 * tests/unit/chordDetection.test.js
 * Unit tests for the pure detectPeaksFromSpectrum function.
 * No DOM or audio dependencies – uses synthetic Float32Array data.
 */

import { describe, it, expect } from 'vitest';
import { detectPeaksFromSpectrum } from '../../js/games/chordExercise/chordDetection.js';

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Creates a Float32Array of length `bins` filled with `fill` (default -100 dB),
 * then sets specific bin values from the `peaks` map { binIndex: dBValue }.
 */
function makeFreqData(bins, peaks = {}, fill = -100) {
  const data = new Float32Array(bins).fill(fill);
  for (const [bin, val] of Object.entries(peaks)) {
    data[Number(bin)] = val;
  }
  return data;
}

/**
 * Returns the frequency (Hz) for a given FFT bin index.
 * freq = binIndex * sampleRate / (numBins * 2)
 */
function binToFreq(binIndex, sampleRate, numBins) {
  return (binIndex * sampleRate) / (numBins * 2);
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('detectPeaksFromSpectrum', () => {
  const SR = 44100;   // sample rate
  const BINS = 1024;  // number of FFT bins (half of fftSize)

  it('returns empty array when all values are below the threshold', () => {
    // All bins at -100 dB, well below any threshold
    const data = makeFreqData(BINS, {}, -100);
    const peaks = detectPeaksFromSpectrum(data, SR, 70, 1200, -60);
    expect(peaks).toEqual([]);
  });

  it('returns a single peak at the correct frequency for one local maximum', () => {
    // Place a single peak at bin 50
    const peakBin = 50;
    const data = makeFreqData(BINS, { [peakBin]: -30 }, -100);
    const peaks = detectPeaksFromSpectrum(data, SR, 0, 10000, -60);
    expect(peaks).toHaveLength(1);
    const expectedFreq = binToFreq(peakBin, SR, BINS);
    expect(peaks[0]).toBeCloseTo(expectedFreq, 1);
  });

  it('computes the correct frequency value for a known bin', () => {
    // bin 10, SR=44100, BINS=1024 → 10 * 44100 / (1024 * 2) ≈ 215.33 Hz
    const peakBin = 10;
    const expectedFreq = binToFreq(peakBin, SR, BINS);
    const data = makeFreqData(BINS, { [peakBin]: -30 }, -100);
    const peaks = detectPeaksFromSpectrum(data, SR, 0, 10000, -60);
    expect(peaks).toHaveLength(1);
    expect(peaks[0]).toBeCloseTo(expectedFreq, 3);
  });

  it('ignores non-local-maxima (plateau – no strict neighbors)', () => {
    // Bins 100, 101, 102 all at same level: 101 is not > both neighbors strictly
    const data = makeFreqData(BINS, { 100: -30, 101: -30, 102: -30 }, -100);
    const peaks = detectPeaksFromSpectrum(data, SR, 0, 10000, -60);
    // None of the plateau bins qualify as a strict local max
    expect(peaks).toHaveLength(0);
  });

  it('ignores bins on a slope (ascending run, no local max)', () => {
    // Ascending: 200 < 201 < 202 — only bin 202 could be a max, but 203 is equal so it's a tie
    const data = makeFreqData(BINS, { 200: -80, 201: -70, 202: -50, 203: -50 }, -100);
    const peaks = detectPeaksFromSpectrum(data, SR, 0, 10000, -60);
    expect(peaks).toHaveLength(0);
  });

  it('filters out bins below minFreqHz', () => {
    // Peak at bin 1: very low frequency
    const lowBin = 1;
    const lowFreq = binToFreq(lowBin, SR, BINS); // ≈ 21.5 Hz
    const data = makeFreqData(BINS, { [lowBin]: -20 }, -100);
    // minFreqHz = 70 Hz → bin 1 should be excluded
    const peaks = detectPeaksFromSpectrum(data, SR, 70, 10000, -60);
    expect(peaks.every(f => f >= 70)).toBe(true);
    // bin 1 freq is below 70 Hz so it should not appear
    expect(peaks).not.toContain(lowFreq);
  });

  it('filters out bins above maxFreqHz', () => {
    // Peak at a high bin (bin 900, freq ≈ 19390 Hz)
    const highBin = 900;
    const data = makeFreqData(BINS, { [highBin]: -20 }, -100);
    // maxFreqHz = 1200 → bin 900 is way above, should be excluded
    const peaks = detectPeaksFromSpectrum(data, SR, 70, 1200, -60);
    const highFreq = binToFreq(highBin, SR, BINS);
    expect(peaks.every(f => f <= 1200)).toBe(true);
    expect(peaks).not.toContain(highFreq);
  });

  it('returns multiple peaks for a chord-like spectrum (E-minor fundamentals)', () => {
    // Approximate E-minor open chord fundamentals (Hz):
    // E2 ≈ 82 Hz, B2 ≈ 123 Hz, E3 ≈ 165 Hz, G3 ≈ 196 Hz, B3 ≈ 247 Hz, E4 ≈ 330 Hz
    // Map each to the nearest bin: bin = Math.round(freq * BINS * 2 / SR)
    const eminorFreqs = [82, 123, 165, 196, 247, 330];
    const peakBins = eminorFreqs.map(f => Math.round((f * BINS * 2) / SR));

    const peakMap = {};
    peakBins.forEach(b => { peakMap[b] = -25; });

    const data = makeFreqData(BINS, peakMap, -100);
    const peaks = detectPeaksFromSpectrum(data, SR, 70, 1200, -60);

    // Expect to find at least 4 of the 6 peaks (some bins may be adjacent and merge)
    expect(peaks.length).toBeGreaterThanOrEqual(4);

    // All returned peaks should be in the valid range
    peaks.forEach(f => {
      expect(f).toBeGreaterThanOrEqual(70);
      expect(f).toBeLessThanOrEqual(1200);
    });
  });

  it('handles edge bins (bin 0 and last bin) without throwing', () => {
    // Bin 0 and last bin cannot be local maxima (no neighbors to compare)
    const data = makeFreqData(BINS, { 0: -10, [BINS - 1]: -10 }, -100);
    expect(() => detectPeaksFromSpectrum(data, SR, 0, 25000, -60)).not.toThrow();
    const peaks = detectPeaksFromSpectrum(data, SR, 0, 25000, -60);
    // Bin 0 and last bin should not appear
    const bin0Freq = binToFreq(0, SR, BINS);
    const lastFreq = binToFreq(BINS - 1, SR, BINS);
    expect(peaks).not.toContain(bin0Freq);
    expect(peaks).not.toContain(lastFreq);
  });

  it('returns peaks sorted by frequency ascending', () => {
    // Create two peaks at bin 200 and bin 100 (i.e., higher freq first in array if unsorted)
    const data = makeFreqData(BINS, { 100: -20, 200: -20 }, -100);
    const peaks = detectPeaksFromSpectrum(data, SR, 0, 10000, -60);
    expect(peaks.length).toBeGreaterThanOrEqual(2);
    for (let i = 1; i < peaks.length; i++) {
      expect(peaks[i]).toBeGreaterThanOrEqual(peaks[i - 1]);
    }
  });

  it('handles empty freqData without crashing', () => {
    const data = new Float32Array(0);
    expect(() => detectPeaksFromSpectrum(data, SR, 70, 1200, -60)).not.toThrow();
    const peaks = detectPeaksFromSpectrum(data, SR, 70, 1200, -60);
    expect(peaks).toEqual([]);
  });

  it('handles freqData with fewer than 3 bins (cannot check neighbors)', () => {
    // With only 2 bins we cannot do neighbor comparison → should return empty
    const data = new Float32Array([0, -20]);
    expect(() => detectPeaksFromSpectrum(data, SR, 0, 10000, -60)).not.toThrow();
    const peaks = detectPeaksFromSpectrum(data, SR, 0, 10000, -60);
    expect(peaks).toEqual([]);
  });
});
