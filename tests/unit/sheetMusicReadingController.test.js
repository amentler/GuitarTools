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
let playbackBeatCallback = null;

const playbackBarRender = vi.fn();
const playbackBarHide = vi.fn();
const playbackBarShow = vi.fn();
const playbackBarMoveToBeat = vi.fn();
const playbackBarDestroy = vi.fn();
const requestMicrophoneStream = vi.fn();
const openAudioSession = vi.fn();
const closeAudioSession = vi.fn();
const recorderStart = vi.fn();
const recorderStop = vi.fn();
const recorderCancel = vi.fn();
const buildZip = vi.fn(() => new Uint8Array([1, 2, 3]));
const downloadBlob = vi.fn();
let mockedRowIndex = 0;
let recorderRecording = false;
let recorderWav = null;

vi.mock('../../js/games/sheetMusicReading/sheetMusicSVG.js', () => ({
  renderScore,
  appendRow,
}));

vi.mock('../../js/games/sheetMusicReading/playbackController.js', () => ({
  PlaybackController: class PlaybackController {
    init() { playbackInit(); }
    onBeat(cb) { playbackBeatCallback = cb; playbackOnBeat(cb); }
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

vi.mock('../../js/games/sheetMusicReading/sheetMusicRecorder.js', () => ({
  createRecorder: vi.fn(() => ({
    get isRecording() {
      return recorderRecording;
    },
    start: recorderStart,
    stop: recorderStop,
    cancel: recorderCancel,
  })),
}));

vi.mock('../../js/games/sheetMusicReading/sheetMusicZip.js', () => ({
  buildZip,
  downloadBlob,
}));

vi.mock('../../js/shared/audioAnalyseStorage.js', () => ({
  saveLastRecording: vi.fn().mockResolvedValue(undefined),
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
      <button id="btn-record">Record</button>
      <button id="btn-record-stop" class="u-hidden">Stop Recording</button>
      <button id="btn-record-cancel" class="u-hidden">Cancel Recording</button>
      <button id="btn-download-recordings" class="u-hidden">Download</button>
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
  const container = document.getElementById('score-container');
  Object.defineProperty(container, 'clientHeight', {
    configurable: true,
    value: 540,
  });
  container.scrollTop = 0;
  container.scrollTo = vi.fn(({ top = 0 }) => {
    container.scrollTop = top;
  });
}

describe('SheetMusicReading controller behavior', () => {
  let createSheetMusicReadingFeature;

  beforeEach(async () => {
    vi.resetModules();
    buildDom();
    localStorage.clear();
    mockedRowIndex = 0;
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
    playbackBeatCallback = null;
    requestMicrophoneStream.mockReset();
    requestMicrophoneStream.mockResolvedValue({ getTracks: () => [] });
    renderScore.mockImplementation(container => {
      const notationDiv = document.createElement('div');
      container.innerHTML = '';
      container.appendChild(notationDiv);
      return {
        notationDiv,
        staveLayout: { barXs: [0, 100, 200, 300] },
        vw: 400,
      };
    });
    appendRow.mockImplementation((container, bars, showTab) => {
      const rowDiv = document.createElement('div');
      rowDiv.className = 'score-row';
      const notationDiv = document.createElement('div');
      notationDiv.className = 'notation-wrapper';
      rowDiv.appendChild(notationDiv);
      if (showTab) {
        const tabDiv = document.createElement('div');
        tabDiv.className = 'tab-wrapper';
        rowDiv.appendChild(tabDiv);
      }

      const rowHeight = showTab ? 180 : 120;
      const rowOffset = mockedRowIndex * rowHeight;
      mockedRowIndex += 1;

      Object.defineProperty(rowDiv, 'offsetHeight', {
        configurable: true,
        value: rowHeight,
      });
      Object.defineProperty(rowDiv, 'offsetTop', {
        configurable: true,
        value: rowOffset,
      });

      container.appendChild(rowDiv);
      return {
        notationDiv,
        staveLayout: { barXs: [0, 100, 200, 300] },
        rowDiv,
        vw: 400,
      };
    });
    openAudioSession.mockReset();
    openAudioSession.mockImplementation(async session => {
      session.audioCtx = { sampleRate: 44100 };
      session.analyser = {
        fftSize: 4096,
        frequencyBinCount: 2048,
        getFloatTimeDomainData: buffer => buffer.fill(0),
        getFloatFrequencyData: buffer => buffer.fill(-120),
      };
      return session;
    });
    closeAudioSession.mockReset();
    closeAudioSession.mockResolvedValue(undefined);
    recorderRecording = false;
    recorderWav = new Uint8Array([82, 73, 70, 70]);
    recorderStart.mockReset();
    recorderStart.mockImplementation(async () => {
      recorderRecording = true;
    });
    recorderStop.mockReset();
    recorderStop.mockImplementation(() => {
      recorderRecording = false;
      return recorderWav;
    });
    recorderCancel.mockReset();
    recorderCancel.mockImplementation(() => {
      recorderRecording = false;
    });
    buildZip.mockClear();
    downloadBlob.mockClear();
    vi.stubGlobal('confirm', vi.fn(() => false));
    ({ createSheetMusicReadingFeature } = await import('../../js/games/sheetMusicReading/sheetMusicReading.js'));
  });

  afterEach(() => {
    localStorage.clear();
    delete globalThis.__GT_SHEET_MUSIC_READING_BARS__;
    vi.unstubAllGlobals();
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
    expect(playbackStart).toHaveBeenCalledWith(80, 4, 4, 4);
    expect(document.getElementById('btn-sheet-play').textContent).toBe('⏹ Stop');

    document.getElementById('btn-sheet-play').click();
    expect(playbackStop).toHaveBeenCalled();
    expect(document.getElementById('btn-sheet-play').textContent).toBe('▶ Play');
  });

  it('endless play starts with one full-bar count-in', () => {
    const feature = createSheetMusicReadingFeature();
    feature.mount();

    document.getElementById('btn-endless-mode').click();
    document.getElementById('btn-sheet-play').click();

    expect(playbackStart).toHaveBeenCalledWith(80, 4, 0, 4);
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

  it('active mode with playback advances current note by metronome beat and marks misses', async () => {
    globalThis.__GT_SHEET_MUSIC_READING_BARS__ = [[
      { name: 'E', octave: 2, vfKey: 'e/3', string: 6, fret: 0 },
      { name: 'A', octave: 2, vfKey: 'a/3', string: 5, fret: 0 },
      { name: 'D', octave: 3, vfKey: 'd/4', string: 4, fret: 0 },
      { name: 'G', octave: 3, vfKey: 'g/4', string: 3, fret: 0 },
    ]];
    localStorage.setItem('sheetMusic_active', 'true');

    const feature = createSheetMusicReadingFeature();
    feature.mount();
    await Promise.resolve();
    await Promise.resolve();

    document.getElementById('btn-sheet-play').click();
    expect(playbackBeatCallback).toBeTypeOf('function');

    playbackBeatCallback({ barIndex: 0, beatIndex: 0, globalBeat: 0 });
    expect(document.getElementById('sheet-music-current-note').textContent).toBe('E2');

    playbackBeatCallback({ barIndex: 0, beatIndex: 1, globalBeat: 1 });
    expect(document.getElementById('sheet-music-current-note').textContent).toBe('A2');
    expect(playbackBarMoveToBeat).toHaveBeenCalledWith(0, 1, 4);
  });

  it('keeps exactly three endless rows and shifts them with tabs enabled', () => {
    vi.useFakeTimers();
    localStorage.setItem('sheetMusic_showTab', 'true');

    const feature = createSheetMusicReadingFeature();
    feature.mount();

    document.getElementById('btn-endless-mode').click();
    document.getElementById('btn-sheet-play').click();

    const container = document.getElementById('score-container');
    expect(container.children).toHaveLength(3);
    expect(appendRow).toHaveBeenCalledTimes(3);
    expect(appendRow).toHaveBeenNthCalledWith(1, container, expect.any(Array), true, '4/4');

    playbackBeatCallback({ barIndex: 4, beatIndex: 0 });
    expect(container.scrollTo).toHaveBeenCalledWith(expect.objectContaining({
      behavior: 'smooth',
      top: expect.any(Number),
    }));

    vi.advanceTimersByTime(420);

    expect(container.children).toHaveLength(3);
    expect(appendRow).toHaveBeenCalledTimes(4);
    expect(playbackBarDestroy).toHaveBeenCalledTimes(1);
    expect(container.querySelectorAll('.tab-wrapper')).toHaveLength(3);

    vi.useRealTimers();
  });

  it('exports recording manifests with compact octave-aware note strings', async () => {
    globalThis.__GT_SHEET_MUSIC_READING_BARS__ = [[
      { name: 'E', octave: 4, vfKey: 'e/5', string: 1, fret: 0 },
      { name: 'B', octave: 3, vfKey: 'b/4', string: 2, fret: 0 },
    ]];
    localStorage.setItem('sheetMusic_bpm', '40');

    const feature = createSheetMusicReadingFeature();
    feature.mount();

    document.getElementById('btn-record').click();
    await Promise.resolve();
    document.getElementById('btn-record-stop').click();
    await Promise.resolve(); // stopRecording is async; let it push to savedRecordings
    document.getElementById('btn-download-recordings').click();

    const files = buildZip.mock.calls.at(-1)[0];
    const manifestFile = files.find(file => file.name.endsWith('.json'));
    const manifest = JSON.parse(new TextDecoder().decode(manifestFile.data));

    expect(manifest.notes).toEqual(['E4', 'B3']);
    expect(manifest.bpm).toBe(40);
    expect(manifest.category).toBe('sheet-music-reading');
    expect(downloadBlob).toHaveBeenCalledWith(
      expect.any(Uint8Array),
      expect.stringMatching(/^noten-lesen-aufnahmen-\d+\.zip$/),
      'application/zip',
    );
  });
});
