import { analyzeAudio } from '../audioAnalyse/audioAnalyseEngine.js';
import {
  initCrosshair,
  resetPlayhead as resetAnalyzerPlayhead,
  renderAllCharts,
  updatePlayhead as updateAnalyzerPlayhead,
} from '../audioAnalyse/audioAnalyseSVG.js';
import {
  getGuitarOnsetStrategies,
  loadGuitarOnsetStrategiesFromRegistry,
  DEFAULT_GUITAR_ONSET_STRATEGY_KEY,
} from '../../shared/audio/guitarOnsetStrategies.js';
import { getSetting, SETTING_KEYS } from '../../shared/globalSettings.js';

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
  let playheadSec = null;
  let _onsetStrategyKey = getSetting(SETTING_KEYS.SHEET_MUSIC_ONSET_STRATEGY) ?? DEFAULT_GUITAR_ONSET_STRATEGY_KEY;

  function populateOnsetSelect(ui) {
    if (!ui.analysisOnsetSelectEl) return;
    const strategies = getGuitarOnsetStrategies();
    const currentKey = ui.analysisOnsetSelectEl.value || _onsetStrategyKey;
    const activeKey = strategies.some(s => s.key === currentKey) ? currentKey : (strategies[0]?.key ?? _onsetStrategyKey);
    ui.analysisOnsetSelectEl.innerHTML = strategies
      .map(s => `<option value="${s.key}"${s.key === activeKey ? ' selected' : ''}>${s.label}</option>`)
      .join('');
    _onsetStrategyKey = activeKey;
  }

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
    applyPlayhead();
    ui.analysisChartsWrapper.classList.remove('u-hidden');
  }

  function applyPlayhead() {
    if (!analysisResult || !Number.isFinite(playheadSec) || analysisResult.duration <= 0) {
      resetAnalyzerPlayhead();
      return;
    }
    updateAnalyzerPlayhead(playheadSec / analysisResult.duration);
  }

  function setPlayheadSec(sec) {
    playheadSec = Number.isFinite(sec) ? sec : null;
    applyPlayhead();
  }

  function resetPlayhead() {
    playheadSec = null;
    resetAnalyzerPlayhead();
  }

  async function run(ui) {
    const samples = getSamples();
    if (!samples) return;
    const runId = ++analysisRunId;
    analysisResult = null;
    ui.analysisChartsWrapper?.classList.add('u-hidden');
    setStatus(ui, 'Analyse läuft ...');
    try {
      const result = await analyzeAudio(samples, getSampleRate(), { onsetStrategyKey: _onsetStrategyKey });
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
    populateOnsetSelect(ui);
    loadGuitarOnsetStrategiesFromRegistry().then(() => populateOnsetSelect(ui));
    ui.analysisOnsetSelectEl?.addEventListener('change', () => {
      _onsetStrategyKey = ui.analysisOnsetSelectEl.value;
      void run(ui);
    });
  }

  return {
    render,
    resetPlayhead,
    run,
    setStatus,
    setPlayheadSec,
    wire,
  };
}
