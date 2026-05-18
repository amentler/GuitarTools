import {
  loadXGBoostOnsetModel,
  detectOnsetsOfflineXGBoost,
} from '../../shared/audio/offlineOnsetDetectionXGBoost.js';

const XGBOOST_DEFAULT_THRESHOLD = 0.5;
const XGBOOST_DEFAULT_REFRACTORY_MS = 100;

export function createOnsetTaggerXGBoostController({
  getSamples,
  getSampleRate,
  getOnsets,
  setOnsets,
  mergeOnsets,
  updateOnsetUI,
  schedulePersist,
}) {
  let _onnxModel = null;
  let _xgboostSchema = null;

  function updateRunBtn(ui) {
    if (!ui.xgboostRunBtn) return;
    const ready = getSamples() && _onnxModel && _onnxModel.session && _xgboostSchema;
    ui.xgboostRunBtn.disabled = !ready;
  }

  async function handleRun(ui) {
    const samples = getSamples();
    if (!samples || !_onnxModel || !_onnxModel.session || !_xgboostSchema) return;
    if (ui.xgboostRunBtn) ui.xgboostRunBtn.disabled = true;
    if (ui.xgboostStatus) ui.xgboostStatus.textContent = '⏳ XGBoost läuft…';

    try {
      const result = await detectOnsetsOfflineXGBoost(
        samples,
        getSampleRate(),
        _onnxModel,
        {
          threshold: XGBOOST_DEFAULT_THRESHOLD,
          refractoryMs: XGBOOST_DEFAULT_REFRACTORY_MS,
        },
      );

      const merged = mergeOnsets(getOnsets(), result.onsetsMs);
      setOnsets(merged.onsetsMs);
      updateOnsetUI(ui);
      schedulePersist(ui);
      if (ui.xgboostStatus) {
        ui.xgboostStatus.textContent =
          `✅ ${result.onsetsMs.length} erkannt, ${merged.added} hinzugefügt, ${merged.skipped} übersprungen.`;
      }
    } catch (err) {
      if (ui.xgboostStatus) ui.xgboostStatus.textContent = `❌ ${err.message}`;
    } finally {
      updateRunBtn(ui);
    }
  }

  function wire(ui) {
    if (ui.onnxBtn) {
      ui.onnxBtn.addEventListener('click', () => ui.onnxInput?.click());
    }
    if (ui.onnxInput) {
      ui.onnxInput.addEventListener('change', async (e) => {
        const file = e.target.files?.[0];
        if (!file) return;
        e.target.value = '';
        if (ui.onnxLabel) ui.onnxLabel.textContent = `⏳ ${file.name}…`;
        if (!_xgboostSchema) {
          if (ui.onnxLabel) ui.onnxLabel.textContent = `${file.name} (Schema fehlt noch)`;
          _onnxModel = { pendingModelFile: file, session: null, schema: null };
          updateRunBtn(ui);
          return;
        }
        if (ui.xgboostStatus) ui.xgboostStatus.textContent = 'Lade Modell…';
        try {
          _onnxModel = await loadXGBoostOnsetModel(file, _xgboostSchema);
          if (ui.onnxLabel) ui.onnxLabel.textContent = `${file.name} ✓`;
          if (ui.xgboostStatus) ui.xgboostStatus.textContent = '';
          updateRunBtn(ui);
        } catch (err) {
          if (ui.onnxLabel) ui.onnxLabel.textContent = `Fehler: ${err.message}`;
          if (ui.xgboostStatus) ui.xgboostStatus.textContent = `❌ ${err.message}`;
        }
      });
    }
    if (ui.schemaBtn) {
      ui.schemaBtn.addEventListener('click', () => ui.schemaInput?.click());
    }
    if (ui.schemaInput) {
      ui.schemaInput.addEventListener('change', async (e) => {
        const file = e.target.files?.[0];
        if (!file) return;
        e.target.value = '';
        if (ui.schemaLabel) ui.schemaLabel.textContent = `⏳ ${file.name}…`;
        try {
          const text = await file.text();
          _xgboostSchema = JSON.parse(text);
          if (ui.schemaLabel) ui.schemaLabel.textContent = `${file.name} ✓`;
          if (_onnxModel?.pendingModelFile) {
            const modelFile = _onnxModel.pendingModelFile;
            _onnxModel = null;
            if (ui.xgboostStatus) ui.xgboostStatus.textContent = 'Lade Modell…';
            try {
              _onnxModel = await loadXGBoostOnsetModel(modelFile, _xgboostSchema);
              if (ui.onnxLabel) ui.onnxLabel.textContent = `${modelFile.name} ✓`;
              if (ui.xgboostStatus) ui.xgboostStatus.textContent = '';
            } catch (err2) {
              if (ui.xgboostStatus) ui.xgboostStatus.textContent = `❌ ${err2.message}`;
            }
          }
          updateRunBtn(ui);
        } catch (err) {
          if (ui.schemaLabel) ui.schemaLabel.textContent = `Fehler: ${err.message}`;
        }
      });
    }
    if (ui.xgboostRunBtn) {
      ui.xgboostRunBtn.addEventListener('click', () => handleRun(ui));
    }
  }

  return { wire, updateRunBtn };
}
