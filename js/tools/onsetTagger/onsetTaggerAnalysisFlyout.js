import { analyzeAudio } from '../audioAnalyse/audioAnalyseEngine.js';
import {
  initCrosshair,
  renderAllCharts,
} from '../audioAnalyse/audioAnalyseSVG.js';

export function createOnsetTaggerAnalysisFlyout({
  getSamples,
  getSampleRate,
  getRangeStart,
  getRangeEnd,
  getCursorSec,
  getTaggedOnsetsSec,
}) {
  let analysisResult = null;
  let analysisRunId = 0;
  let normalizeY = true;
  let showDetectedOnsets = true;
  let showTaggedOnsets = true;

  function setStatus(ui, text, isError = false) {
    if (!ui.analysisStatus) return;
    ui.analysisStatus.textContent = text;
    ui.analysisStatus.classList.toggle('tagger-analysis-status--error', isError);
  }

  function syncOptions(ui) {
    if (ui.analysisNormalizeYEl) normalizeY = ui.analysisNormalizeYEl.checked;
    if (ui.analysisShowDetectedOnsetsEl) showDetectedOnsets = ui.analysisShowDetectedOnsetsEl.checked;
    if (ui.analysisShowTaggedOnsetsEl) showTaggedOnsets = ui.analysisShowTaggedOnsetsEl.checked;
  }

  function render(ui) {
    const samples = getSamples();
    if (!ui.analysisChartsWrapper || !samples || !analysisResult) return;
    renderAllCharts(ui.analysisChartsWrapper, samples, analysisResult, {
      rangeStart: getRangeStart(),
      rangeEnd: getRangeEnd(),
      normalizeY,
      showDetectedOnsets,
      showTaggedOnsets,
      taggedOnsets: getTaggedOnsetsSec(),
      currentOnsetSec: getCursorSec(),
    });
    for (const wrap of ui.analysisChartsWrapper.querySelectorAll('.analysis-chart-svg-wrap')) {
      const aspect = wrap.style.getPropertyValue('--chart-aspect').trim();
      const match = aspect.match(/^([0-9.]+)\s*\/\s*([0-9.]+)$/);
      if (match) {
        wrap.style.setProperty('--chart-aspect', `${match[1]} / ${Number(match[2]) * 3}`);
      }
    }
    initCrosshair(ui.analysisChartsWrapper);
    ui.analysisChartsWrapper.classList.remove('u-hidden');
  }

  async function run(ui) {
    const samples = getSamples();
    if (!samples) return;
    const runId = ++analysisRunId;
    analysisResult = null;
    ui.analysisChartsWrapper?.classList.add('u-hidden');
    setStatus(ui, 'Analyse läuft ...');
    try {
      const result = await analyzeAudio(samples, getSampleRate());
      if (runId !== analysisRunId) return;
      analysisResult = result;
      setStatus(ui, `${result.frames.length} Frames, ${result.onsets.length} erkannte Onsets.`);
      render(ui);
    } catch (err) {
      if (runId !== analysisRunId) return;
      setStatus(ui, `Analyse-Fehler: ${err.message}`, true);
    }
  }

  function wire(ui) {
    syncOptions(ui);
    ui.analysisNormalizeYEl?.addEventListener('change', () => {
      normalizeY = ui.analysisNormalizeYEl.checked;
      render(ui);
    });
    ui.analysisShowDetectedOnsetsEl?.addEventListener('change', () => {
      showDetectedOnsets = ui.analysisShowDetectedOnsetsEl.checked;
      render(ui);
    });
    ui.analysisShowTaggedOnsetsEl?.addEventListener('change', () => {
      showTaggedOnsets = ui.analysisShowTaggedOnsetsEl.checked;
      render(ui);
    });
  }

  return {
    render,
    run,
    setStatus,
    wire,
  };
}
