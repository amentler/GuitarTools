// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const renderScoreWithStatus = vi.fn();

vi.mock('../../js/games/sheetMusicMic/sheetMusicMicSVG.js', () => ({
  renderScoreWithStatus,
}));

vi.mock('../../js/utils/settings.js', () => ({
  wireStringToggles: vi.fn(),
  syncStringToggles: vi.fn(),
  wireFretSlider: vi.fn(),
  syncFretSlider: vi.fn(),
}));

vi.mock('../../js/shared/music/sheetMusicLogic.js', async () => {
  const actual = await vi.importActual('../../js/shared/music/sheetMusicLogic.js');
  return {
    ...actual,
    generateBars: vi.fn(() => [[{ name: 'E', octave: 4, string: 1, fret: 0 }]]),
    getFilteredNotes: vi.fn(() => actual.NOTES),
  };
});

vi.mock('../../js/shared/audio/fastNoteMatcher.js', async () => {
  const actual = await vi.importActual('../../js/shared/audio/fastNoteMatcher.js');
  return {
    ...actual,
    classifyFrame: vi.fn(() => ({ status: 'unsure' })),
  };
});

function buildDom() {
  document.body.innerHTML = `
    <section id="view-sheet-mic" class="view active">
      <div id="score-value">0 / 0</div>
      <div id="sheet-mic-score-container"></div>
      <div id="sheet-mic-current-note">–</div>
      <div id="sheet-mic-feedback" class="feedback-text"></div>
      <button id="sheet-mic-start-btn"></button>
      <button id="sheet-mic-stop-btn" class="u-hidden"></button>
      <button id="sheet-mic-new-bars"></button>
      <p id="sheet-mic-permission" class="u-hidden"></p>
      <select id="sheet-mic-mode"><option value="easy">Einfach</option><option value="hard">Schwer</option></select>
      <input type="range" id="sheet-mic-fret-slider" min="0" max="3" value="3" />
      <span id="sheet-mic-fret-label">0 – 3</span>
      <div id="sheet-mic-string-toggles"><button class="btn-string"></button></div>
    </section>
  `;
}

function createMockAudioContext() {
  const analyser = {
    fftSize: 4096,
    connect: vi.fn(),
    getFloatTimeDomainData: vi.fn(buffer => buffer.fill(0)),
  };

  return {
    sampleRate: 44100,
    state: 'running',
    createAnalyser: vi.fn(() => analyser),
    createMediaStreamSource: vi.fn(() => ({ connect: vi.fn() })),
    resume: vi.fn().mockResolvedValue(undefined),
    close: vi.fn().mockResolvedValue(undefined),
    analyser,
  };
}

describe('SheetMusicMic controller behavior', () => {
  let createSheetMusicMicFeature;
  let mockTrack;
  let mockAudio;

  beforeEach(async () => {
    vi.useFakeTimers();
    vi.resetModules();
    buildDom();
    renderScoreWithStatus.mockClear();
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

    ({ createSheetMusicMicFeature } = await import('../../js/games/sheetMusicMic/sheetMusicMicExercise.js'));
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('mount initializes score and target note', () => {
    const feature = createSheetMusicMicFeature();
    feature.mount();

    expect(renderScoreWithStatus).toHaveBeenCalled();
    expect(document.getElementById('score-value').textContent).toBe('0 / 1');
    expect(document.getElementById('sheet-mic-current-note').textContent).toBe('E4');
  });

  it('start and stop buttons toggle listening UI', async () => {
    const feature = createSheetMusicMicFeature();
    feature.mount();

    document.getElementById('sheet-mic-start-btn').click();
    await Promise.resolve();

    expect(navigator.mediaDevices.getUserMedia).toHaveBeenCalled();
    expect(document.getElementById('sheet-mic-start-btn').classList.contains('u-hidden')).toBe(true);
    expect(document.getElementById('sheet-mic-stop-btn').classList.contains('u-hidden')).toBe(false);

    document.getElementById('sheet-mic-stop-btn').click();
    expect(document.getElementById('sheet-mic-start-btn').classList.contains('u-hidden')).toBe(false);
    expect(document.getElementById('sheet-mic-stop-btn').classList.contains('u-hidden')).toBe(true);
  });

  it('unmount tears down media tracks and audio context', async () => {
    const feature = createSheetMusicMicFeature();
    feature.mount();
    document.getElementById('sheet-mic-start-btn').click();
    await Promise.resolve();

    feature.unmount();

    expect(mockTrack.stop).toHaveBeenCalledTimes(1);
    expect(mockAudio.close).toHaveBeenCalledTimes(1);
  });
});
