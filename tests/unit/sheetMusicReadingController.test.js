// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const renderScore = vi.fn(() => ({
  notationDiv: document.createElement('div'),
  staveLayout: { barXs: [0, 100, 200, 300] },
  vw: 400,
}));
const appendRow = vi.fn(() => ({
  notationDiv: document.createElement('div'),
  staveLayout: { barXs: [0, 100, 200, 300] },
  rowDiv: document.createElement('div'),
  vw: 400,
}));

const playbackStart = vi.fn();
const playbackStop = vi.fn();
const playbackSetBpm = vi.fn();
const playbackOnBeat = vi.fn();
const playbackInit = vi.fn();

const playbackBarRender = vi.fn();
const playbackBarHide = vi.fn();
const playbackBarShow = vi.fn();
const playbackBarMoveToBeat = vi.fn();
const playbackBarDestroy = vi.fn();
const requestMicrophoneStream = vi.fn();
const openAudioSession = vi.fn();
const closeAudioSession = vi.fn();

vi.mock('../../js/games/sheetMusicReading/sheetMusicSVG.js', () => ({
  renderScore,
  appendRow,
}));

vi.mock('../../js/games/sheetMusicReading/playbackController.js', () => ({
  PlaybackController: class PlaybackController {
    init() { playbackInit(); }
    onBeat(cb) { playbackOnBeat(cb); }
    start(...args) { playbackStart(...args); }
    stop() { playbackStop(); }
    setBpm(...args) { playbackSetBpm(...args); }
  },
}));

vi.mock('../../js/games/sheetMusicReading/playbackBar.js', () => ({
  PlaybackBar: class PlaybackBar {
    render(...args) { playbackBarRender(...args); }
    hide() { playbackBarHide(); }
    show() { playbackBarShow(); }
    moveToBeat(...args) { playbackBarMoveToBeat(...args); }
    destroy() { playbackBarDestroy(); }
  },
}));

vi.mock('../../js/utils/settings.js', () => ({
  wireStringToggles: vi.fn(),
  syncStringToggles: vi.fn(),
  wireFretSlider: vi.fn(),
  syncFretSlider: vi.fn(),
}));

vi.mock('../../js/shared/audio/microphoneService.js', () => ({
  requestMicrophoneStream,
}));

vi.mock('../../js/shared/audio/audioSessionService.js', () => ({
  createAudioSessionState: (overrides = {}) => ({
    audioCtx: null,
    analyser: null,
    stream: null,
    ...overrides,
  }),
  openAudioSession,
  closeAudioSession,
}));

vi.mock('../../js/games/sheetMusicReading/sheetMusicLogic.js', async () => {
  const actual = await vi.importActual('../../js/games/sheetMusicReading/sheetMusicLogic.js');
  return {
    ...actual,
    generateBars: vi.fn(() => [[{ name: 'E', octave: 2 }]]),
    getFilteredNotes: vi.fn(() => actual.NOTES.slice(0, 5)),
  };
});

function buildDom() {
  document.body.innerHTML = `
    <section id="view-sheet-music" class="view active">
      <div id="score-container"></div>
      <div id="sheet-music-pool-warning" hidden></div>
      <p id="sheet-music-permission" class="u-hidden"></p>
      <div id="sheet-music-status" class="u-hidden">
        <span id="sheet-music-current-note">–</span>
        <span id="sheet-music-feedback"></span>
      </div>
      <button id="btn-sheet-active-mode">Aktiv</button>
      <button id="btn-new-bars">Neu</button>
      <button id="btn-show-tab">Tab</button>
      <button id="btn-endless-mode">Endless</button>
      <button id="btn-sheet-play">▶ Play</button>
      <input id="sheet-music-bpm-slider" value="80" />
      <span id="sheet-music-bpm-label">80</span>
      <select id="sheet-music-time-sig">
        <option value="4/4">4/4</option>
        <option value="3/4">3/4</option>
      </select>
      <input id="sheet-music-fret-range-slider" />
      <span id="sheet-music-fret-range-label"></span>
      <div id="sheet-music-string-toggles">
        <button class="btn-string"></button>
      </div>
    </section>
  `;
}

describe('SheetMusicReading controller behavior', () => {
  let createSheetMusicReadingFeature;

  beforeEach(async () => {
    vi.resetModules();
    buildDom();
    localStorage.clear();
    renderScore.mockClear();
    appendRow.mockClear();
    playbackStart.mockClear();
    playbackStop.mockClear();
    playbackSetBpm.mockClear();
    playbackOnBeat.mockClear();
    playbackInit.mockClear();
    playbackBarRender.mockClear();
    playbackBarHide.mockClear();
    playbackBarShow.mockClear();
    playbackBarMoveToBeat.mockClear();
    playbackBarDestroy.mockClear();
    requestMicrophoneStream.mockReset();
    requestMicrophoneStream.mockResolvedValue({ getTracks: () => [] });
    openAudioSession.mockReset();
    openAudioSession.mockImplementation(async session => {
      session.audioCtx = { sampleRate: 44100 };
      session.analyser = {
        fftSize: 4096,
        getFloatTimeDomainData: buffer => buffer.fill(0),
      };
      return session;
    });
    closeAudioSession.mockReset();
    closeAudioSession.mockResolvedValue(undefined);
    ({ createSheetMusicReadingFeature } = await import('../../js/games/sheetMusicReading/sheetMusicReading.js'));
  });

  afterEach(() => {
    localStorage.clear();
  });

  it('mount renders score and syncs initial controls from persisted state', () => {
    localStorage.setItem('sheetMusic_showTab', 'true');
    localStorage.setItem('sheetMusic_endless', 'true');
    localStorage.setItem('sheetMusic_bpm', '92');
    localStorage.setItem('sheetMusic_timeSig', '3/4');

    const feature = createSheetMusicReadingFeature();
    feature.mount();

    expect(renderScore).toHaveBeenCalled();
    expect(document.getElementById('btn-show-tab').classList.contains('active')).toBe(true);
    expect(document.getElementById('btn-endless-mode').classList.contains('active')).toBe(true);
    expect(document.getElementById('sheet-music-bpm-label').textContent).toBe('92');
    expect(document.getElementById('sheet-music-time-sig').value).toBe('3/4');
  });

  it('play button toggles playback state and stop text', () => {
    const feature = createSheetMusicReadingFeature();
    feature.mount();

    document.getElementById('btn-sheet-play').click();
    expect(playbackStart).toHaveBeenCalledWith(80, 4, 16);
    expect(document.getElementById('btn-sheet-play').textContent).toBe('⏹ Stop');

    document.getElementById('btn-sheet-play').click();
    expect(playbackStop).toHaveBeenCalled();
    expect(document.getElementById('btn-sheet-play').textContent).toBe('▶ Play');
  });

  it('unmount stops active playback', () => {
    const feature = createSheetMusicReadingFeature();
    feature.mount();
    document.getElementById('btn-sheet-play').click();

    feature.unmount();

    expect(playbackStop).toHaveBeenCalled();
  });

  it('restores active mode from localStorage and starts microphone setup', async () => {
    localStorage.setItem('sheetMusic_active', 'true');

    const feature = createSheetMusicReadingFeature();
    feature.mount();
    await Promise.resolve();
    await Promise.resolve();

    expect(document.getElementById('btn-sheet-active-mode').classList.contains('active')).toBe(true);
    expect(document.getElementById('sheet-music-status').classList.contains('u-hidden')).toBe(false);
    expect(document.getElementById('sheet-music-current-note').textContent).toBe('E2');
    expect(requestMicrophoneStream).toHaveBeenCalledTimes(1);
  });

  it('active toggle persists and starts microphone setup on demand', async () => {
    const feature = createSheetMusicReadingFeature();
    feature.mount();

    document.getElementById('btn-sheet-active-mode').click();
    await Promise.resolve();
    await Promise.resolve();

    expect(localStorage.getItem('sheetMusic_active')).toBe('true');
    expect(document.getElementById('btn-sheet-active-mode').classList.contains('active')).toBe(true);
    expect(requestMicrophoneStream).toHaveBeenCalledTimes(1);
  });
});
