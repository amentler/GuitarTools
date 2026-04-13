import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock the registry so getAllExercises() returns the expected exercises
const mockRegistry = new Map();
vi.mock('../../js/exerciseRegistry.js', () => ({
  registerExercise(key, meta) { mockRegistry.set(key, meta); },
  getExercise(key) { return mockRegistry.get(key); },
  getAllExercises() { return [...mockRegistry.entries()]; },
}));

vi.mock('../../js/components/index.js', () => ({}));
vi.mock('../../js/games/fretboardToneRecognition/fretboardExercise.js', () => ({ startExercise: vi.fn(), stopExercise: vi.fn() }));
vi.mock('../../js/tools/guitarTuner/guitarTuner.js', () => ({ startExercise: vi.fn(), stopExercise: vi.fn() }));
vi.mock('../../js/games/sheetMusicReading/sheetMusicReading.js', () => ({ startExercise: vi.fn(), stopExercise: vi.fn() }));
vi.mock('../../js/tools/metronome/metronome.js', () => ({ startExercise: vi.fn(), stopExercise: vi.fn() }));
vi.mock('../../js/games/akkordTrainer/akkordTrainer.js', () => ({ startExercise: vi.fn(), stopExercise: vi.fn() }));
vi.mock('../../js/games/tonFinder/tonFinder.js', () => ({ startExercise: vi.fn(), stopExercise: vi.fn() }));
vi.mock('../../js/games/notePlayingExercise/notePlayingExercise.js', () => ({ startExercise: vi.fn(), stopExercise: vi.fn() }));
vi.mock('../../js/games/sheetMusicMic/sheetMusicMicExercise.js', () => ({ startExercise: vi.fn(), stopExercise: vi.fn() }));

function createDummyElement() {
  const listeners = new Map();
  const classSet = new Set();
  return {
    classList: {
      add(className) { classSet.add(className); },
      remove(className) { classSet.delete(className); },
      toggle(className, force) {
        if (force === true) classSet.add(className);
        else if (force === false) classSet.delete(className);
        else if (classSet.has(className)) classSet.delete(className);
        else classSet.add(className);
      },
      contains(className) {
        return classSet.has(className);
      },
    },
    addEventListener(type, handler) {
      listeners.set(type, handler);
    },
    click() {
      const handler = listeners.get('click');
      if (handler) handler();
    },
    textContent: '',
  };
}

function installMinimalDom() {
  const ids = [
    'view-menu',
    'view-fretboard',
    'view-tuner',
    'view-sheet-music',
    'view-metronome',
    'view-akkord-trainer',
    'view-ton-finder',
    'view-note-play',
    'view-sheet-mic',
    'btn-start-fretboard',
    'btn-back',
    'btn-start-tuner',
    'btn-back-tuner',
    'btn-start-sheet-music',
    'btn-back-sheet-music',
    'btn-start-metronome',
    'btn-back-metronome',
    'btn-start-akkord-trainer',
    'btn-back-akkord-trainer',
    'btn-start-ton-finder',
    'btn-back-ton-finder',
    'btn-start-note-play',
    'btn-back-note-play',
    'btn-start-sheet-mic',
    'btn-back-sheet-mic',
    'app-version',
  ];

  const elements = new Map(ids.map((id) => [id, createDummyElement()]));
  const document = {
    getElementById(id) {
      return elements.get(id);
    },
  };

  const history = {
    pushState: vi.fn(),
    replaceState: vi.fn(),
  };
  const windowListeners = new Map();

  globalThis.document = document;
  globalThis.window = {
    history,
    addEventListener(type, handler) {
      windowListeners.set(type, handler);
    },
  };
  globalThis.history = history;
  globalThis.fetch = vi.fn().mockResolvedValue({
    ok: true,
    text: async () => 'Version 2026-04-10 22:43',
  });

  // Populate the mock registry with all expected exercises
  const exerciseDefs = [
    ['fretboard',   { viewId: 'view-fretboard',   btnStartId: 'btn-start-fretboard',   btnBackId: 'btn-back',            start: vi.fn(), stop: vi.fn() }],
    ['tuner',       { viewId: 'view-tuner',        btnStartId: 'btn-start-tuner',       btnBackId: 'btn-back-tuner',      start: vi.fn(), stop: vi.fn() }],
    ['sheetMusic',  { viewId: 'view-sheet-music',  btnStartId: 'btn-start-sheet-music',  btnBackId: 'btn-back-sheet-music', start: vi.fn(), stop: vi.fn() }],
    ['metronome',   { viewId: 'view-metronome',    btnStartId: 'btn-start-metronome',    btnBackId: 'btn-back-metronome',   start: vi.fn(), stop: vi.fn() }],
    ['akkord',      { viewId: 'view-akkord-trainer', btnStartId: 'btn-start-akkord-trainer', btnBackId: 'btn-back-akkord-trainer', start: vi.fn(), stop: vi.fn() }],
    ['tonFinder',   { viewId: 'view-ton-finder',   btnStartId: 'btn-start-ton-finder',   btnBackId: 'btn-back-ton-finder', start: vi.fn(), stop: vi.fn() }],
    ['notePlaying', { viewId: 'view-note-play',    btnStartId: 'btn-start-note-play',    btnBackId: 'btn-back-note-play',  start: vi.fn(), stop: vi.fn() }],
    ['sheetMic',    { viewId: 'view-sheet-mic',    btnStartId: 'btn-start-sheet-mic',    btnBackId: 'btn-back-sheet-mic',  start: vi.fn(), stop: vi.fn() }],
  ];
  exerciseDefs.forEach(([key, meta]) => mockRegistry.set(key, meta));

  return { elements, history };
}

describe('app navigation browser history', () => {
  beforeEach(() => {
    mockRegistry.clear();
    vi.resetModules();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    delete globalThis.document;
    delete globalThis.window;
    delete globalThis.history;
    delete globalThis.fetch;
  });

  it('creates a browser history entry when opening an exercise from menu', async () => {
    const { elements, history } = installMinimalDom();

    await import('../../js/app.js');
    elements.get('btn-start-tuner').click();

    expect(history.pushState).toHaveBeenCalled();
  });
});
