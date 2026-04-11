// Unit tests for js/games/sheetMusicMic/fastNoteMatcher.js
//
// Level A of the plan plans/notenzeilen-akustische-pruefung.md:
//   A1 – classifyFrame baseline behaviour against synthetic sine signals
//   A2 – buffer-size regression guard against the current "Noten spielen" bug
//   A3 – updateMatchState streak logic
//   A4 – guitar-flavoured synthetic signals (harmonics, decay, startup impulse)
//
// These tests intentionally RED against the first "broken" version of
// fastNoteMatcher.js and go green once the module is wired through
// detectPitch({ referenceHz }), getMinSamplesFor, and getRecommendedFftSize.

import { describe, it, expect } from 'vitest';
import {
  FAST_ACCEPT_STREAK,
  FAST_REJECT_STREAK,
  FAST_CENTS_TOLERANCE,
  classifyFrame,
  createMatchState,
  updateMatchState,
  getMinSamplesFor,
  getRecommendedFftSize,
  parsePitch,
} from '../../js/games/sheetMusicMic/fastNoteMatcher.js';
import { noteToFrequency } from '../../js/tools/guitarTuner/tunerLogic.js';

// ── Synthetic signal helpers ──────────────────────────────────────────────────

const SAMPLE_RATE = 44100;

/** Pure sine at the given frequency, peak amplitude `amp`. */
function sine(freqHz, numSamples, amp = 0.35) {
  const buf = new Float32Array(numSamples);
  for (let i = 0; i < numSamples; i++) {
    buf[i] = amp * Math.sin((2 * Math.PI * freqHz * i) / SAMPLE_RATE);
  }
  return buf;
}

/**
 * Fundamental plus 2nd and 3rd harmonic, mimicking a plucked string.
 * Amplitudes chosen so the fundamental remains dominant.
 */
function guitarLike(freqHz, numSamples) {
  const buf = new Float32Array(numSamples);
  for (let i = 0; i < numSamples; i++) {
    const t = i / SAMPLE_RATE;
    buf[i] =
      0.45 * Math.sin(2 * Math.PI * freqHz * t) +
      0.22 * Math.sin(2 * Math.PI * 2 * freqHz * t) +
      0.11 * Math.sin(2 * Math.PI * 3 * freqHz * t);
  }
  return buf;
}

/** Exponentially decaying sine; matches the envelope of a plucked note. */
function decayingSine(freqHz, numSamples, tauSec = 0.5) {
  const buf = new Float32Array(numSamples);
  for (let i = 0; i < numSamples; i++) {
    const t = i / SAMPLE_RATE;
    buf[i] = 0.5 * Math.exp(-t / tauSec) * Math.sin(2 * Math.PI * freqHz * t);
  }
  return buf;
}

/** Sine with a single-sample ±1 spike at the start. */
function sineWithStartupSpike(freqHz, numSamples) {
  const buf = sine(freqHz, numSamples, 0.35);
  buf[0] = 1.0;
  return buf;
}

/**
 * Frequency for a given target pitch offset by `cents`.
 * Positive cents = higher in pitch.
 */
function pitchHz(pitchStr, offsetCents = 0) {
  const { name, octave } = parsePitch(pitchStr);
  return noteToFrequency(name, octave) * Math.pow(2, offsetCents / 1200);
}

/** Collects {pitch, fftSize} pairs based on the (future) adaptive recommendation. */
function adaptiveBuffer(pitchStr) {
  return getRecommendedFftSize(pitchStr, SAMPLE_RATE);
}

const TARGET_PITCHES = ['E2', 'A2', 'D3', 'G3', 'B3', 'E4'];

// ── A1 – classifyFrame baseline behaviour ─────────────────────────────────────

describe('fastNoteMatcher – A1 classifyFrame baseline per target pitch', () => {
  for (const pitch of TARGET_PITCHES) {
    describe(`target ${pitch}`, () => {
      const fftSize = adaptiveBuffer(pitch);

      it('A1a perfect sine on the target frequency → correct', () => {
        const samples = sine(pitchHz(pitch), fftSize);
        const res = classifyFrame(samples, SAMPLE_RATE, pitch);
        expect(res.status).toBe('correct');
        expect(res.detectedPitch).toBe(pitch);
      });

      it('A1b sine at target + 20 cent → correct (within tolerance)', () => {
        const samples = sine(pitchHz(pitch, 20), fftSize);
        const res = classifyFrame(samples, SAMPLE_RATE, pitch);
        expect(res.status).toBe('correct');
        expect(res.detectedPitch).toBe(pitch);
      });

      it('A1c sine at target + 30 cent → correct (boundary, well within ±35)', () => {
        const samples = sine(pitchHz(pitch, 30), fftSize);
        const res = classifyFrame(samples, SAMPLE_RATE, pitch);
        expect(res.status).toBe('correct');
        expect(res.detectedPitch).toBe(pitch);
      });

      it('A1d sine at target + 50 cent → not correct (outside tolerance)', () => {
        const samples = sine(pitchHz(pitch, 50), fftSize);
        const res = classifyFrame(samples, SAMPLE_RATE, pitch);
        expect(res.status).not.toBe('correct');
      });

      it('A1e sine a half-step above → wrong', () => {
        const samples = sine(pitchHz(pitch, 100), fftSize);
        const res = classifyFrame(samples, SAMPLE_RATE, pitch);
        expect(res.status).toBe('wrong');
      });

      it('A1f sine a half-step below → wrong', () => {
        const samples = sine(pitchHz(pitch, -100), fftSize);
        const res = classifyFrame(samples, SAMPLE_RATE, pitch);
        expect(res.status).toBe('wrong');
      });

      it('A1g sine one octave above → wrong', () => {
        const samples = sine(pitchHz(pitch, 1200), fftSize);
        const res = classifyFrame(samples, SAMPLE_RATE, pitch);
        expect(res.status).toBe('wrong');
      });

      it('A1i silence (buffer of zeros) → unsure', () => {
        const samples = new Float32Array(fftSize);
        const res = classifyFrame(samples, SAMPLE_RATE, pitch);
        expect(res.status).toBe('unsure');
        expect(res.detectedPitch).toBeNull();
      });
    });
  }
});

// ── A2 – buffer-size regression guard ─────────────────────────────────────────

describe('fastNoteMatcher – A2 buffer-size regression', () => {
  it('A2a getRecommendedFftSize is ≥ getMinSamplesFor for every target pitch', () => {
    for (const pitch of TARGET_PITCHES) {
      const minSamples = getMinSamplesFor(pitch, SAMPLE_RATE);
      const fftSize = getRecommendedFftSize(pitch, SAMPLE_RATE);
      expect(fftSize).toBeGreaterThanOrEqual(minSamples);
      // Safety margin: at least 1.25× the absolute minimum so we have more
      // than a single YIN period of slack.
      expect(fftSize).toBeGreaterThanOrEqual(Math.ceil(minSamples * 1.25));
    }
  });

  it('A2b E2 recommendation is not the legacy 2048-sample value', () => {
    // The current "Noten spielen" bug is caused by a hardcoded fftSize = 2048.
    // The adaptive recommendation must move E2 well above that so YIN can run.
    expect(getRecommendedFftSize('E2', SAMPLE_RATE)).toBeGreaterThan(2048);
  });

  it('A2c E2 classifyFrame on a 2048-sample buffer → unsure (physically too small)', () => {
    // Documents exactly the bug the exercise has today: YIN needs
    // ≈ (44100 / 70) * 4 ≈ 2520 samples for the low-strings search band, so
    // a 2048-sample buffer cannot produce a reliable E2 pitch.
    const samples = sine(pitchHz('E2'), 2048);
    const res = classifyFrame(samples, SAMPLE_RATE, 'E2');
    expect(res.status).toBe('unsure');
    expect(res.detectedPitch).toBeNull();
  });

  it('A2d high-string targets can use a small fftSize (≤ 4096)', () => {
    // High strings (B3, E4) get a short search band and therefore need far
    // less buffer – the recommendation should reflect that so playing high
    // notes stays low-latency.
    expect(getRecommendedFftSize('E4', SAMPLE_RATE)).toBeLessThanOrEqual(4096);
    expect(getRecommendedFftSize('B3', SAMPLE_RATE)).toBeLessThanOrEqual(4096);
  });
});

// ── A3 – updateMatchState streak logic ────────────────────────────────────────

describe('fastNoteMatcher – A3 updateMatchState', () => {
  const correct = { status: 'correct', detectedPitch: 'E2', hz: 82, cents: 0 };
  const wrong   = { status: 'wrong',   detectedPitch: 'F2', hz: 87, cents: 100 };
  const unsure  = { status: 'unsure',  detectedPitch: null, hz: null, cents: null };

  it(`A3a ${FAST_ACCEPT_STREAK} consecutive correct frames → accept event`, () => {
    let state = createMatchState();
    let lastEvent = null;
    for (let i = 0; i < FAST_ACCEPT_STREAK; i++) {
      const { nextState, event } = updateMatchState(state, correct);
      state = nextState;
      lastEvent = event;
    }
    expect(lastEvent).toBe('accept');
    expect(state.accepted).toBe(true);
  });

  it('A3b correct → unsure → correct does NOT accept (unsure breaks the streak)', () => {
    let state = createMatchState();
    ({ nextState: state } = updateMatchState(state, correct));
    let res = updateMatchState(state, unsure);
    state = res.nextState;
    res = updateMatchState(state, correct);
    state = res.nextState;
    expect(state.accepted).toBe(false);
    expect(res.event).toBeNull();
  });

  it(`A3c ${FAST_REJECT_STREAK} consecutive wrong frames → reject event`, () => {
    let state = createMatchState();
    let lastEvent = null;
    for (let i = 0; i < FAST_REJECT_STREAK; i++) {
      const { nextState, event } = updateMatchState(state, wrong);
      state = nextState;
      lastEvent = event;
    }
    expect(lastEvent).toBe('reject');
    expect(state.rejected).toBe(true);
  });

  it('A3d one wrong frame between two correct ones → neither accept nor reject', () => {
    let state = createMatchState();
    ({ nextState: state } = updateMatchState(state, correct));
    ({ nextState: state } = updateMatchState(state, wrong));
    const res = updateMatchState(state, correct);
    expect(res.event).toBeNull();
    expect(res.nextState.accepted).toBe(false);
    expect(res.nextState.rejected).toBe(false);
  });

  it('A3e after accept the state is idempotent until explicitly reset', () => {
    let state = createMatchState();
    for (let i = 0; i < FAST_ACCEPT_STREAK; i++) {
      ({ nextState: state } = updateMatchState(state, correct));
    }
    expect(state.accepted).toBe(true);
    const after = updateMatchState(state, wrong);
    expect(after.event).toBeNull();
    expect(after.nextState.accepted).toBe(true);
    expect(after.nextState.rejected).toBe(false);
  });

  it('exposes the documented public constants', () => {
    expect(FAST_ACCEPT_STREAK).toBe(2);
    expect(FAST_REJECT_STREAK).toBe(3);
    expect(FAST_CENTS_TOLERANCE).toBe(35);
  });
});

// ── A4 – Guitar-flavoured synthetic signals ───────────────────────────────────

describe('fastNoteMatcher – A4 guitar-like synthetic signals', () => {
  for (const pitch of TARGET_PITCHES) {
    it(`A4a fundamental + 2nd + 3rd harmonic at ${pitch} → correct`, () => {
      const fftSize = adaptiveBuffer(pitch);
      const samples = guitarLike(pitchHz(pitch), fftSize);
      const res = classifyFrame(samples, SAMPLE_RATE, pitch);
      expect(res.status).toBe('correct');
      expect(res.detectedPitch).toBe(pitch);
    });
  }

  it('A4b exponentially decaying E4 sine → correct on an early window', () => {
    const pitch = 'E4';
    const fftSize = adaptiveBuffer(pitch);
    // Take the early portion of a 1 s decay so the signal is still strong.
    const full = decayingSine(pitchHz(pitch), SAMPLE_RATE, 0.5);
    const earlyWindow = full.slice(0, fftSize);
    const res = classifyFrame(earlyWindow, SAMPLE_RATE, pitch);
    expect(res.status).toBe('correct');
    expect(res.detectedPitch).toBe(pitch);
  });

  it('A4c sine with a startup spike still classifies correctly', () => {
    const pitch = 'A2';
    const fftSize = adaptiveBuffer(pitch);
    const samples = sineWithStartupSpike(pitchHz(pitch), fftSize);
    const res = classifyFrame(samples, SAMPLE_RATE, pitch);
    expect(res.status).toBe('correct');
    expect(res.detectedPitch).toBe(pitch);
  });
});
