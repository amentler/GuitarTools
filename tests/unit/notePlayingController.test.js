// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const renderNoteOnStaff = vi.fn();
const renderNotePositionsTab = vi.fn();
const classifyFrame = vi.fn(() => ({ status: 'unsure', detectedPitch: 'E4' }));

vi.mock('../../js/games/notePlayingExercise/notePlayingSVG.js', () => ({
  renderNoteOnStaff,
  renderNotePositionsTab,
}));

vi.mock('../../js/utils/settings.js', () => ({
  wireStringToggles: vi.fn(),
  syncStringToggles: vi.fn(),
  wireFretSlider: vi.fn(),
  syncFretSlider: vi.fn(),
}));

vi.mock('../../js/shared/audio/fastNoteMatcher.js', async () => {
  const actual = await vi.importActual('../../js/shared/audio/fastNoteMatcher.js');
  return {
    ...actual,
    classifyFrame,
  };
});

vi.mock('../../js/games/notePlayingExercise/notePlayingLogic.js', () => ({
  getRandomPitch: vi.fn(() => 'E4'),
  getPositionsForPitch: vi.fn(() => [{ string: 0, fret: 0 }]),
}));

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

function createMockAudioContext() {
  const analyser = {
    fftSize: 2048,
    getFloatTimeDomainData: vi.fn(buffer => buffer.fill(0)),
  };

  return {
    state: 'running',
    sampleRate: 44100,
    createAnalyser: vi.fn(() => analyser),
    createMediaStreamSource: vi.fn(() => ({ connect: vi.fn() })),
    resume: vi.fn().mockResolvedValue(undefined),
    close: vi.fn().mockResolvedValue(undefined),
    analyser,
  };
}

describe('NotePlaying controller behavior', () => {
  let createNotePlayingExerciseFeature;
  let mockTrack;
  let mockAudio;

  beforeEach(async () => {
    vi.useFakeTimers();
    vi.resetModules();
    buildDom();
    renderNoteOnStaff.mockClear();
    renderNotePositionsTab.mockClear();
    classifyFrame.mockReset();
    classifyFrame.mockReturnValue({ status: 'unsure', detectedPitch: 'E4' });
    mockTrack = { stop: vi.fn() };
    mockAudio = createMockAudioContext();

    function MockAudioContext() {
      return mockAudio;
    }

    vi.stubGlobal('AudioContext', MockAudioContext);
    vi.stubGlobal('navigator', {
      mediaDevices: {
        getUserMedia: vi.fn().mockResolvedValue({ getTracks: () => [mockTrack] }),
      },
    });

    ({ createNotePlayingExerciseFeature } = await import('../../js/games/notePlayingExercise/notePlayingExercise.js'));
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('mount initializes target display and requests microphone access', async () => {
    const feature = createNotePlayingExerciseFeature();

    await feature.mount(document.getElementById('view-note-play'));

    expect(navigator.mediaDevices.getUserMedia).toHaveBeenCalled();
    expect(document.getElementById('note-play-target').textContent).not.toBe('–');
    expect(renderNoteOnStaff).toHaveBeenCalled();
  });

  it('hint and skip buttons update the visible state', async () => {
    const logic = await import('../../js/games/notePlayingExercise/notePlayingLogic.js');
    logic.getRandomPitch
      .mockReturnValueOnce('E4')
      .mockReturnValueOnce('F4');

    const feature = createNotePlayingExerciseFeature();
    await feature.mount(document.getElementById('view-note-play'));

    const firstTarget = document.getElementById('note-play-target').textContent;
    document.getElementById('note-play-hint1').click();
    expect(document.getElementById('note-play-target').textContent.length).toBeGreaterThan(0);

    document.getElementById('note-play-hint2').click();
    expect(renderNotePositionsTab).toHaveBeenCalled();

    document.getElementById('note-play-skip').click();
    expect(document.getElementById('note-play-target').textContent).not.toBe(firstTarget);
  });

  it('requires a new attack before repeated identical targets can score again', async () => {
    classifyFrame.mockReturnValue({
      status: 'correct',
      detectedPitch: 'E4',
      hz: 329.63,
      cents: 0,
    });
    mockAudio.analyser.getFloatTimeDomainData.mockImplementation(buffer => buffer.fill(0.08));

    const feature = createNotePlayingExerciseFeature();
    await feature.mount(document.getElementById('view-note-play'));

    vi.advanceTimersByTime(150);
    expect(document.getElementById('score-value').textContent).toBe('1');

    vi.advanceTimersByTime(2500);
    expect(document.getElementById('score-value').textContent).toBe('1');
    expect(document.getElementById('note-play-target').textContent).toBe('E4');
  });

  it('unmount tears down media tracks and audio context', async () => {
    const feature = createNotePlayingExerciseFeature();
    await feature.mount(document.getElementById('view-note-play'));

    feature.unmount();

    expect(mockTrack.stop).toHaveBeenCalledTimes(1);
    expect(mockAudio.close).toHaveBeenCalledTimes(1);
  });
});
