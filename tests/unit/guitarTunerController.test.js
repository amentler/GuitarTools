// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const initTunerSVG = vi.fn();
const updateTunerDisplay = vi.fn();

vi.mock('../../js/tools/guitarTuner/tunerSVG.js', () => ({
  initTunerSVG,
  updateTunerDisplay,
}));

vi.mock('../../js/tools/guitarTuner/tunerLogic.js', () => ({
  detectPitch: vi.fn(() => null),
  frequencyToNote: vi.fn(() => ({ note: 'A', octave: 4, cents: 0 })),
  isStandardTuningNote: vi.fn(() => true),
  GUIDED_TUNING_STEPS: [
    { stringNumber: 6, note: 'E', octave: 2 },
    { stringNumber: 5, note: 'A', octave: 2 },
    { stringNumber: 4, note: 'D', octave: 3 },
  ],
  noteToFrequency: vi.fn(() => 82.41),
  getCentsToTarget: vi.fn(() => 0),
  PERFECT_TOLERANCE_CENTS: 5,
  pushGuidedHistory: vi.fn(),
  getGuidedFeedback: vi.fn(() => ({ type: 'green', direction: 'none', arrowColor: null, warning: false })),
  updateFeedbackDisplay: vi.fn((_current, next) => next),
  ANALYZE_INTERVAL_MS: 50,
  getAdaptiveFftSize: vi.fn(() => 2048),
  applyNoteSwitchHysteresis: vi.fn((_accepted, candidateKey, streak) => ({
    nextStreak: streak,
    acceptedNoteKey: candidateKey,
  })),
  shouldRejectOutlier: vi.fn(() => ({ reject: false, nextStreak: 0 })),
  analyzeInputLevel: vi.fn(() => ({ rms: 0.02, clippingRatio: 0, isValid: true })),
  estimateNoiseFloorRms: vi.fn(() => 0.001),
  buildAdaptiveThreshold: vi.fn(() => 0.008),
  smoothCents: vi.fn((_prev, next) => next),
  STABLE_CONFIRM_FRAMES: 3,
  pushAndMedianTimed: vi.fn((_history, hz) => hz),
  SILENCE_RESET_THRESHOLD_MS: 300,
  ATTACK_DAMPING_RATIO: 0.1,
}));

function buildTunerDom() {
  document.body.innerHTML = `
    <section id="view-tuner" class="view active">
      <div class="tuner-mode-toggle-container">
        <div class="tuner-mode-toggle">
          <button id="btn-mode-standard" class="btn-mode active">Standard</button>
          <button id="btn-mode-chromatic" class="btn-mode">Chromatisch</button>
        </div>
      </div>
      <p id="tuner-permission" style="display:none"></p>
      <div id="tuner-display"></div>
      <div id="guided-tuner-section">
        <button id="btn-start-guided">Geführtes Stimmen starten</button>
        <div id="guided-active" style="display:none">
          <strong id="guided-step-label"></strong>
          <strong id="guided-step-target"></strong>
          <div id="guided-step-progress"></div>
          <div id="guided-feedback"></div>
          <button id="btn-guided-next">Weiter</button>
          <button id="btn-guided-stop">Beenden</button>
        </div>
        <div id="guided-finished" style="display:none">
          <button id="btn-guided-restart">Nochmal</button>
          <button id="btn-guided-done">Fertig</button>
        </div>
      </div>
    </section>
  `;
}

function createMockAudioContext() {
  const analyser = {
    fftSize: 2048,
    frequencyBinCount: 1024,
    getFloatTimeDomainData: vi.fn(buffer => buffer.fill(0)),
    getFloatFrequencyData: vi.fn(buffer => buffer.fill(-120)),
  };

  const chainNode = {
    connect: vi.fn(function connect() {
      return this;
    }),
  };

  const audioContext = {
    state: 'running',
    sampleRate: 44100,
    resume: vi.fn().mockResolvedValue(undefined),
    close: vi.fn().mockResolvedValue(undefined),
    createAnalyser: vi.fn(() => analyser),
    createBiquadFilter: vi.fn(() => ({
      ...chainNode,
      type: '',
      frequency: { value: 0 },
      Q: { value: 0 },
    })),
    createMediaStreamSource: vi.fn(() => ({ ...chainNode })),
  };

  return { audioContext, analyser };
}

describe('createGuitarTunerTool controller behavior', () => {
  let createGuitarTunerTool;
  let mockTrack;
  let mockStream;
  let audioFactory;

  beforeEach(async () => {
    vi.useFakeTimers();
    vi.resetModules();
    buildTunerDom();
    initTunerSVG.mockReset();
    updateTunerDisplay.mockReset();

    mockTrack = { stop: vi.fn() };
    mockStream = { getTracks: () => [mockTrack] };
    audioFactory = createMockAudioContext();

    vi.stubGlobal('navigator', {
      mediaDevices: {
        getUserMedia: vi.fn().mockResolvedValue(mockStream),
      },
    });
    function MockAudioContext() {
      return audioFactory.audioContext;
    }
    vi.stubGlobal('AudioContext', MockAudioContext);

    ({ createGuitarTunerTool } = await import('../../js/tools/guitarTuner/guitarTuner.js'));
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('mount initializes tuner UI and requests microphone access', async () => {
    const tool = createGuitarTunerTool();

    await tool.mount(document.getElementById('view-tuner'));

    expect(initTunerSVG).toHaveBeenCalledWith(document.getElementById('tuner-display'));
    expect(navigator.mediaDevices.getUserMedia).toHaveBeenCalledWith({ audio: true, video: false });
    expect(document.getElementById('tuner-permission').style.display).toBe('none');
    expect(updateTunerDisplay).toHaveBeenCalledWith({
      cents: 0,
      note: null,
      octave: null,
      isActive: false,
      isInTune: false,
      isStandardNote: false,
    });
  });

  it('mode buttons toggle active class after mount', async () => {
    const tool = createGuitarTunerTool();
    await tool.mount(document.getElementById('view-tuner'));

    const standard = document.getElementById('btn-mode-standard');
    const chromatic = document.getElementById('btn-mode-chromatic');

    chromatic.click();
    expect(chromatic.classList.contains('active')).toBe(true);
    expect(standard.classList.contains('active')).toBe(false);

    standard.click();
    expect(standard.classList.contains('active')).toBe(true);
    expect(chromatic.classList.contains('active')).toBe(false);
  });

  it('guided mode start, advance and stop update the guided UI', async () => {
    const tool = createGuitarTunerTool();
    await tool.mount(document.getElementById('view-tuner'));

    document.getElementById('btn-start-guided').click();
    expect(document.getElementById('btn-start-guided').style.display).toBe('none');
    expect(document.getElementById('guided-active').style.display).toBe('');
    expect(document.getElementById('guided-step-label').textContent).toBe('6. Saite');
    expect(document.getElementById('guided-step-target').textContent).toBe('E2');
    expect(document.querySelectorAll('#guided-step-progress .guided-progress-dot')).toHaveLength(3);

    document.getElementById('btn-guided-next').click();
    expect(document.getElementById('guided-step-label').textContent).toBe('5. Saite');
    expect(document.getElementById('guided-step-target').textContent).toBe('A2');

    document.getElementById('btn-guided-stop').click();
    expect(document.getElementById('btn-start-guided').style.display).toBe('');
    expect(document.getElementById('guided-active').style.display).toBe('none');
    expect(document.getElementById('guided-finished').style.display).toBe('none');
  });

  it('unmount tears down timers, media tracks and audio context', async () => {
    const tool = createGuitarTunerTool();
    await tool.mount(document.getElementById('view-tuner'));
    document.getElementById('btn-start-guided').click();

    tool.unmount();

    expect(mockTrack.stop).toHaveBeenCalledTimes(1);
    expect(audioFactory.audioContext.close).toHaveBeenCalledTimes(1);
    expect(document.getElementById('btn-start-guided').style.display).toBe('');
    expect(document.getElementById('guided-active').style.display).toBe('none');
    expect(updateTunerDisplay).toHaveBeenLastCalledWith({
      cents: 0,
      note: null,
      octave: null,
      isActive: false,
      isInTune: false,
      isStandardNote: false,
    });
  });
});
