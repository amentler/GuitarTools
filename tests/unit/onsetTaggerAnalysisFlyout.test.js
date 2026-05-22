// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { analyzeAudioMock } = vi.hoisted(() => ({
  analyzeAudioMock: vi.fn(),
}));

vi.mock('../../js/tools/audioAnalyse/audioAnalyseEngine.js', () => ({
  analyzeAudio: analyzeAudioMock,
}));

vi.mock('../../js/tools/audioAnalyse/audioAnalyseSVG.js', () => ({
  initCrosshair: vi.fn(),
  resetPlayhead: vi.fn(),
  renderAllCharts: vi.fn(),
  updatePlayhead: vi.fn(),
}));

const { createOnsetTaggerAnalysisFlyout } = await import('../../js/tools/onsetTagger/onsetTaggerAnalysisFlyout.js');

function makeUi() {
  return {
    analysisStatus: document.createElement('p'),
    analysisChartsWrapper: document.createElement('div'),
    analysisStatsEl: document.createElement('div'),
  };
}

function makeAnalysisResult(onsets) {
  return {
    frames: [{ t: 0 }],
    onsets,
    duration: 1,
    onsetStrategy: {
      key: 'xgb-test',
      label: 'XGB Test',
      modelId: 'model-test',
      trainingDataFiles: ['training_data_take-a.json'],
    },
  };
}

describe('createOnsetTaggerAnalysisFlyout statistics', () => {
  beforeEach(() => {
    analyzeAudioMock.mockReset();
  });

  it('renders metrics from the current tags when analysis runs', async () => {
    analyzeAudioMock.mockResolvedValue(makeAnalysisResult([0.1, 0.3]));
    const ui = makeUi();
    const flyout = createOnsetTaggerAnalysisFlyout({
      getSamples: () => new Float32Array([0, 1]),
      getSampleRate: () => 48000,
      getBaseName: () => 'take-a',
      getRangeStart: () => 0,
      getRangeEnd: () => 1,
      getCursorSec: () => 0,
      getTaggedOnsetsSec: () => [0.1],
    });

    await flyout.run(ui);

    const text = ui.analysisStatsEl.textContent.replace(/\s+/g, '');
    expect(text).toContain('TrainiertmitdieserWave:Ja');
    expect(text).toContain('TP1');
    expect(text).toContain('FP1');
    expect(text).toContain('F166.7%');
  });

  it('keeps the statistics snapshot when tags change without re-analysis', async () => {
    let taggedOnsets = [0.1];
    analyzeAudioMock.mockResolvedValue(makeAnalysisResult([0.1]));
    const ui = makeUi();
    const flyout = createOnsetTaggerAnalysisFlyout({
      getSamples: () => new Float32Array([0, 1]),
      getSampleRate: () => 48000,
      getBaseName: () => 'take-a',
      getRangeStart: () => 0,
      getRangeEnd: () => 1,
      getCursorSec: () => 0,
      getTaggedOnsetsSec: () => taggedOnsets,
    });

    await flyout.run(ui);
    const initialText = ui.analysisStatsEl.textContent;
    taggedOnsets = [0.1, 0.5];
    flyout.render(ui);

    expect(ui.analysisStatsEl.textContent).toBe(initialText);
  });
});
