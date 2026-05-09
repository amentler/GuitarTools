// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createNotePlayingExerciseFeature } from '../../js/games/notePlayingExercise/notePlayingExercise.js';
import { readWavFile } from '../helpers/wavDecoder.js';

vi.mock('../../js/games/notePlayingExercise/notePlayingSVG.js', () => ({
  renderNoteOnStaff: vi.fn(),
  renderNotePositionsTab: vi.fn(),
}));

vi.mock('../../js/utils/settings.js', () => ({
  wireStringToggles: vi.fn(),
  syncStringToggles: vi.fn(),
  wireFretSlider: vi.fn(),
  syncFretSlider: vi.fn(),
}));

const WRONG_E2 = readWavFile('tests/fixtures/audio/E2/e2.wav');
const RIGHT_G3 = readWavFile('tests/fixtures/audio/G3/g.wav');

function buildDom() {
  document.body.innerHTML = `
    <section id="view-note-play" class="view active">
      <div id="score-value">0</div>
      <div id="note-play-permission"></div>
      <div id="note-play-notation"></div>
      <p id="note-play-target">–</p>
      <div id="note-play-tab"></div>
      <button id="note-play-hint1"></button>
      <button id="note-play-hint2"></button>
      <div id="note-play-detected"></div>
      <p id="note-play-feedback"></p>
      <input type="range" id="note-play-fret-slider" />
      <span id="note-play-fret-label"></span>
      <div id="note-play-string-toggles"><button class="btn-string"></button></div>
      <button id="note-play-skip">Weiter</button>
    </section>
  `;
}

function concatSamples(...chunks) {
  const totalLength = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
  const merged = new Float32Array(totalLength);
  let offset = 0;
  for (const chunk of chunks) {
    merged.set(chunk, offset);
    offset += chunk.length;
  }
  return merged;
}

function createFixtureAudioContext(samples, sampleRate, attackOffsets = [0]) {
  let cursor = 0;
  let lastRms = 0;
  let lastFrameStart = 0;
  const hopSize = Math.max(1, Math.floor(sampleRate * 0.05));
  const attackDuration = Math.floor(sampleRate * 0.18);

  const analyser = {
    _fftSize: 2048,
    get fftSize() {
      return this._fftSize;
    },
    set fftSize(value) {
      this._fftSize = value;
    },
    get frequencyBinCount() {
      return Math.floor(this._fftSize / 2);
    },
    getFloatTimeDomainData(target) {
      lastFrameStart = cursor;
      const end = Math.min(cursor + target.length, samples.length);
      target.fill(0);
      target.set(samples.subarray(cursor, end));
      let sumSquares = 0;
      for (const sample of target) sumSquares += sample * sample;
      lastRms = Math.sqrt(sumSquares / Math.max(1, target.length));
      cursor = Math.min(cursor + hopSize, samples.length);
    },
    getFloatFrequencyData(target) {
      const inAttack = attackOffsets.some(offset => (
        lastFrameStart >= offset && lastFrameStart < offset + attackDuration
      ));
      const db = lastRms > 0.004
        ? (inAttack ? -18 : -36)
        : -120;
      target.fill(-120);
      for (let i = 2; i < target.length; i += 4) {
        target[i] = db;
      }
    },
  };

  return {
    state: 'running',
    sampleRate,
    createAnalyser: vi.fn(() => analyser),
    createMediaStreamSource: vi.fn(() => ({ connect: vi.fn() })),
    resume: vi.fn().mockResolvedValue(undefined),
    close: vi.fn().mockResolvedValue(undefined),
  };
}

function advanceUntil(predicate, { timeoutMs = 4000, stepMs = 50 } = {}) {
  const steps = Math.ceil(timeoutMs / stepMs);
  for (let i = 0; i < steps; i++) {
    if (predicate()) return true;
    vi.advanceTimersByTime(stepMs);
  }
  return predicate();
}

describe('NotePlaying audio regression', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    buildDom();
    window.__GT_NOTE_PLAYING_FORCE_NOTE__ = 'G3';
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
    delete window.__GT_NOTE_PLAYING_FORCE_NOTE__;
  });

  it('akzeptiert G3 nach vorangehendem falschem E2 im selben Audio-Stream', async () => {
    const samples = concatSamples(WRONG_E2.samples, RIGHT_G3.samples);
    const audioContext = createFixtureAudioContext(samples, WRONG_E2.sampleRate, [0, WRONG_E2.samples.length]);
    const stream = { getTracks: () => [{ stop: vi.fn() }] };

    vi.stubGlobal('AudioContext', function MockAudioContext() {
      return audioContext;
    });
    vi.stubGlobal('navigator', {
      mediaDevices: {
        getUserMedia: vi.fn().mockResolvedValue(stream),
      },
    });

    const feature = createNotePlayingExerciseFeature();
    await feature.mount(document.getElementById('view-note-play'));

    expect(document.getElementById('note-play-target').textContent).toBe('G3');

    vi.advanceTimersByTime(1100);
    expect(document.getElementById('score-value').textContent).toBe('0');
    expect(document.getElementById('note-play-feedback').textContent).toBe('');

    const accepted = advanceUntil(
      () => document.getElementById('note-play-feedback').textContent === 'Richtig! ✓',
      { timeoutMs: 3000, stepMs: 50 },
    );
    expect(accepted).toBe(true);
    expect(document.getElementById('score-value').textContent).toBe('1');

    vi.advanceTimersByTime(1600);
    expect(document.getElementById('note-play-target').textContent).not.toBe('G3');
    expect(document.getElementById('note-play-feedback').textContent).toBe('');
  });
});
