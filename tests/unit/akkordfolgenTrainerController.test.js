// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const renderChordDiagram = vi.fn();
const metronomeInit = vi.fn();
const metronomeStart = vi.fn();
const metronomeStop = vi.fn();
const metronomeSetBpm = vi.fn();
const metronomeSetBeatsPerMeasure = vi.fn();

vi.mock('../../js/shared/rendering/chords/chordDiagramRenderer.js', () => ({
  renderChordDiagram,
}));

vi.mock('../../js/shared/audio/metronomeLogic.js', () => ({
  MetronomeLogic: class MetronomeLogic {
    constructor() {
      this.onBeat = null;
    }
    init() { metronomeInit(); }
    start() { metronomeStart(); }
    stop() { metronomeStop(); }
    setBpm(value) { metronomeSetBpm(value); }
    setBeatsPerMeasure(value) { metronomeSetBeatsPerMeasure(value); }
  },
}));

function buildDom() {
  document.body.innerHTML = `
    <section id="view-akkordfolgen-trainer" class="view active">
      <div id="aft-setup"></div>
      <div id="aft-active" style="display:none"></div>
      <div id="aft-summary" style="display:none"></div>

      <select id="aft-key-select"></select>
      <div id="aft-progression-list"></div>
      <button id="aft-random-btn">Random</button>
      <input id="aft-bpm-slider" value="80" />
      <span id="aft-bpm-label">80</span>
      <button id="aft-bpm-minus5"></button>
      <button id="aft-bpm-minus1"></button>
      <button id="aft-bpm-plus1"></button>
      <button id="aft-bpm-plus5"></button>
      <select id="aft-beats-select"><option value="4">4</option></select>
      <button id="aft-start-btn">Start</button>

      <div id="aft-progression-display"></div>
      <div id="aft-current-chord-name"></div>
      <div id="aft-current-numeral"></div>
      <div id="aft-chord-diagram"></div>
      <div id="aft-beat-dots"></div>
      <div id="aft-feedback"></div>
      <button id="aft-stop-btn">Stop</button>

      <div id="aft-summary-time"></div>
      <div id="aft-summary-played"></div>
      <div id="aft-summary-missed"></div>
      <div id="aft-summary-rounds"></div>
      <button id="aft-again-btn"></button>
      <button id="aft-new-btn"></button>

      <p id="aft-permission" style="display:none"></p>
    </section>
  `;
}

function createMockAudioContext() {
  const analyser = {
    fftSize: 4096,
    frequencyBinCount: 2048,
    getFloatTimeDomainData: vi.fn(buffer => buffer.fill(0)),
    getFloatFrequencyData: vi.fn(buffer => buffer.fill(-120)),
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

describe('AkkordfolgenTrainer controller behavior', () => {
  let createAkkordfolgenTrainer;
  let mockTrack;
  let mockAudio;

  beforeEach(async () => {
    vi.useFakeTimers();
    vi.resetModules();
    buildDom();
    renderChordDiagram.mockClear();
    metronomeInit.mockClear();
    metronomeStart.mockClear();
    metronomeStop.mockClear();
    metronomeSetBpm.mockClear();
    metronomeSetBeatsPerMeasure.mockClear();

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

    ({ createAkkordfolgenTrainer } = await import('../../js/games/akkordfolgenTrainer/akkordfolgenTrainer.js'));
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('mount populates setup UI and shows setup phase', () => {
    const feature = createAkkordfolgenTrainer();
    feature.mount();

    expect(document.getElementById('aft-key-select').children.length).toBeGreaterThan(0);
    expect(document.getElementById('aft-progression-list').children.length).toBeGreaterThan(0);
    expect(document.getElementById('aft-setup').style.display).toBe('flex');
  });

  it('start button enters active phase and starts audio + metronome', async () => {
    const feature = createAkkordfolgenTrainer();
    feature.mount();

    document.getElementById('aft-start-btn').click();
    await vi.waitFor(() => {
      expect(metronomeSetBpm).toHaveBeenCalledWith(80);
    });

    expect(navigator.mediaDevices.getUserMedia).toHaveBeenCalled();
    expect(metronomeInit).toHaveBeenCalled();
    expect(metronomeSetBeatsPerMeasure).toHaveBeenCalledWith(4);
    expect(metronomeStart).toHaveBeenCalled();
    expect(document.getElementById('aft-active').style.display).toBe('flex');
    expect(document.getElementById('aft-current-chord-name').textContent.length).toBeGreaterThan(0);
  });

  it('unmount tears down metronome and media resources when running', async () => {
    const feature = createAkkordfolgenTrainer();
    feature.mount();
    document.getElementById('aft-start-btn').click();
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();

    feature.unmount();

    expect(metronomeStop).toHaveBeenCalled();
    expect(mockTrack.stop).toHaveBeenCalledTimes(1);
    expect(mockAudio.close).toHaveBeenCalledTimes(1);
  });
});
