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
import {
  computeTaggedOnsetMetrics,
  resolveOnsetModelTrainingStatus,
} from '../../shared/audio/taggedOnsetMetrics.js';

export function createOnsetTaggerAnalysisFlyout({
  getSamples,
  getSampleRate,
  getBaseName,
  getRangeStart,
  getRangeEnd,
  getCursorSec,
  getTaggedOnsetsSec,
}) {
  let analysisResult = null;
  let statsSnapshot = null;
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

  function formatPercent(value) {
    return `${(value * 100).toFixed(1)}%`;
  }

  function formatMs(value) {
    return value === null || !Number.isFinite(value) ? 'n/a' : `${value.toFixed(1)} ms`;
  }

  function formatSignedMs(value) {
    return value === null || !Number.isFinite(value)
      ? 'n/a'
      : `${value >= 0 ? '+' : ''}${value.toFixed(1)} ms`;
  }

  function formatTrainingStatus(status) {
    if (status === 'trained') return 'Ja';
    if (status === 'not-trained') return 'Nein';
    return 'Unbekannt';
  }

  function buildStatsSnapshot(result) {
    const taggedOnsetsMs = getTaggedOnsetsSec().map(sec => Math.round(sec * 1000));
    const detectedOnsetsMs = (result.onsets ?? []).map(sec => Math.round(sec * 1000));
    const metrics = computeTaggedOnsetMetrics(taggedOnsetsMs, detectedOnsetsMs);
    const training = resolveOnsetModelTrainingStatus(
      getBaseName?.() ?? '',
      result.onsetStrategy?.trainingDataFiles,
    );
    return {
      metrics,
      hasTags: taggedOnsetsMs.length > 0,
      strategy: result.onsetStrategy ?? null,
      training,
    };
  }

  function renderStats(ui) {
    if (!ui.analysisStatsEl) return;
    if (!statsSnapshot) {
      ui.analysisStatsEl.classList.add('u-hidden');
      ui.analysisStatsEl.innerHTML = '';
      return;
    }
    ui.analysisStatsEl.classList.remove('u-hidden');
    const { metrics, hasTags, strategy, training } = statsSnapshot;
    const { counts } = metrics;
    const { metrics: values } = metrics;
    const modelLine = strategy?.modelId
      ? `<span>Modell: ${strategy.modelId}</span>`
      : '<span>Modell: n/a</span>';
    const trainedLine = `<span>Trainiert mit dieser Wave: ${formatTrainingStatus(training.status)}</span>`;

    if (!hasTags) {
      ui.analysisStatsEl.innerHTML = `
        <div class="tagger-analysis-stats__meta">
          ${modelLine}
          ${trainedLine}
        </div>
        <p class="tagger-analysis-stats__empty">Keine Referenz-Tags für diese Statistik geladen.</p>
      `;
      return;
    }

    ui.analysisStatsEl.innerHTML = `
      <div class="tagger-analysis-stats__meta">
        ${modelLine}
        ${trainedLine}
      </div>
      <div class="tagger-analysis-stats__grid" aria-label="Onset-Strategie-Statistik">
        <span>TP</span><strong>${counts.truePositives}</strong>
        <span>FP</span><strong>${counts.falsePositives}</strong>
        <span>FN</span><strong>${counts.falseNegatives}</strong>
        <span>TN</span><strong>n/a</strong>
        <span>Precision</span><strong>${formatPercent(values.precision)}</strong>
        <span>Recall</span><strong>${formatPercent(values.recall)}</strong>
        <span>F1</span><strong>${formatPercent(values.f1)}</strong>
        <span>Detected/Expected</span><strong>${counts.detected}/${counts.expected}</strong>
        <span>Treffer</span><strong>${counts.goodMatches + counts.acceptableMatches}/${counts.expected}</strong>
        <span>Good/Acceptable</span><strong>${counts.goodMatches}/${counts.acceptableMatches}</strong>
        <span>Duplicates</span><strong>${counts.duplicates}</strong>
        <span>Early/Late</span><strong>${counts.earlyMatches}/${counts.lateMatches}</strong>
        <span>Timing avg</span><strong>${formatMs(values.meanAbsErrorMs)}</strong>
        <span>Timing p95</span><strong>${formatMs(values.p95AbsErrorMs)}</strong>
        <span>Bias</span><strong>${formatSignedMs(values.meanSignedErrorMs)}</strong>
      </div>
    `;
  }

  function syncOptions(ui) {
    if (ui.analysisNormalizeYEl) normalizeY = ui.analysisNormalizeYEl.checked;
    if (ui.analysisShowDetectedOnsetsEl) showDetectedOnsets = ui.analysisShowDetectedOnsetsEl.checked;
    if (ui.analysisShowTaggedOnsetsEl) showTaggedOnsets = ui.analysisShowTaggedOnsetsEl.checked;
  }

  function render(ui) {
    const samples = getSamples();
    renderStats(ui);
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
    statsSnapshot = null;
    renderStats(ui);
    ui.analysisChartsWrapper?.classList.add('u-hidden');
    setStatus(ui, 'Analyse läuft ...');
    try {
      const result = await analyzeAudio(samples, getSampleRate(), { onsetStrategyKey: _onsetStrategyKey });
      if (runId !== analysisRunId) return;
      analysisResult = result;
      statsSnapshot = buildStatsSnapshot(result);
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
