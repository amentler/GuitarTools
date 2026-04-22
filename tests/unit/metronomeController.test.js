// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';

const initMock = vi.fn();
const setBpmMock = vi.fn();
const setBeatsMock = vi.fn();
const startMock = vi.fn();
const stopMock = vi.fn();
const renderMock = vi.fn();
const highlightBeatMock = vi.fn();

vi.mock('../../js/tools/metronome/metronomeLogic.js', () => ({
  MetronomeLogic: class MetronomeLogic {
    constructor() {
      this.bpm = 120;
      this.beatsPerMeasure = 4;
      this.isPlaying = false;
      this.onBeat = null;
    }
    init() { initMock(); }
    setBpm(value) {
      this.bpm = value;
      setBpmMock(value);
    }
    setBeatsPerMeasure(value) {
      this.beatsPerMeasure = value;
      setBeatsMock(value);
    }
    start() {
      this.isPlaying = true;
      startMock();
    }
    stop() {
      this.isPlaying = false;
      stopMock();
    }
  },
}));

vi.mock('../../js/tools/metronome/metronomeSVG.js', () => ({
  MetronomeSVG: class MetronomeSVG {
    render(beats) { renderMock(beats); }
    highlightBeat(beatNumber) { highlightBeatMock(beatNumber); }
  },
}));

function buildDom() {
  document.body.innerHTML = `
    <section id="view-metronome">
      <div id="metronome-display"></div>
      <span id="metronome-bpm-value">120</span>
      <input id="metronome-bpm-slider" type="range" min="40" max="240" value="120" />
      <button id="btn-metronome-toggle">Start</button>
      <select id="metronome-beats-select">
        <option value="3">3</option>
        <option value="4">4</option>
      </select>
      <button id="btn-metronome-minus-5">-5</button>
      <button id="btn-metronome-minus-1">-1</button>
      <button id="btn-metronome-plus-1">+1</button>
      <button id="btn-metronome-plus-5">+5</button>
    </section>
  `;
}

describe('Metronome controller persistence', () => {
  beforeEach(() => {
    buildDom();
    initMock.mockClear();
    setBpmMock.mockClear();
    setBeatsMock.mockClear();
    startMock.mockClear();
    stopMock.mockClear();
    renderMock.mockClear();
    highlightBeatMock.mockClear();
    localStorage.clear();
  });

  it('restores persisted bpm and beats from shared storage', async () => {
    localStorage.setItem('metronome_bpm', '96');
    localStorage.setItem('metronome_beats', '3');

    const { createMetronomeTool } = await import('../../js/tools/metronome/metronome.js');
    const tool = createMetronomeTool();
    tool.mount(document.getElementById('view-metronome'));

    expect(initMock).toHaveBeenCalledTimes(1);
    expect(setBpmMock).toHaveBeenCalledWith(96);
    expect(setBeatsMock).toHaveBeenCalledWith(3);
    expect(document.getElementById('metronome-bpm-value').textContent).toBe('96');
    expect(document.getElementById('metronome-beats-select').value).toBe('3');
  });

  it('persists bpm and beats updates through the shared storage service', async () => {
    const { createMetronomeTool } = await import('../../js/tools/metronome/metronome.js');
    const tool = createMetronomeTool();
    tool.mount(document.getElementById('view-metronome'));

    const slider = document.getElementById('metronome-bpm-slider');
    slider.value = '132';
    slider.dispatchEvent(new Event('input', { bubbles: true }));

    const beatsSelect = document.getElementById('metronome-beats-select');
    beatsSelect.value = '3';
    beatsSelect.dispatchEvent(new Event('change', { bubbles: true }));

    expect(localStorage.getItem('metronome_bpm')).toBe('132');
    expect(localStorage.getItem('metronome_beats')).toBe('3');
    expect(setBpmMock).toHaveBeenCalledWith(132);
    expect(setBeatsMock).toHaveBeenCalledWith(3);
  });
});
