import { saveRecordingToSource } from '../../shared/recordingLoader.js';
import { buildSidecarWithOnsets } from './onsetTaggerLogic.js';
import { DEFAULT_SIDECAR_FIELDS, readMetaForm } from './onsetTaggerMetaForm.js';

function arrayBufferToUint8Array(buffer) {
  return new Uint8Array(buffer.slice(0));
}

export function createOnsetTaggerPersistenceController({
  getWavArrayBuffer,
  getSamples,
  getSource,
  getId,
  getBaseName,
  getOnsets,
  getSidecarData,
  setSavedRecording,
}) {
  let _persistTimer = null;

  function getCurrentSidecar(ui) {
    const formValues = ui.metaForm ? readMetaForm(ui) : (getSidecarData() ?? DEFAULT_SIDECAR_FIELDS);
    return buildSidecarWithOnsets(formValues, getOnsets(), { id: getId(), baseName: getBaseName() });
  }

  function setSaveStatus(ui, text) {
    if (ui.saveStatus) ui.saveStatus.textContent = text;
  }

  async function persist(ui) {
    const wavArrayBuffer = getWavArrayBuffer();
    if (!wavArrayBuffer || !getSamples()) return null;
    const sidecar = getCurrentSidecar(ui);
    const saved = await saveRecordingToSource(getSource() || 'sheet-music', getId(), {
      wav: arrayBufferToUint8Array(wavArrayBuffer),
      sidecar,
      id: getId(),
      baseName: getBaseName(),
    });
    if (!saved) return null;
    setSavedRecording(saved, sidecar);
    return saved;
  }

  function schedule(ui) {
    if (!getWavArrayBuffer() || !getSamples()) return;
    if (_persistTimer !== null) clearTimeout(_persistTimer);
    setSaveStatus(ui, 'Speichert ...');
    _persistTimer = setTimeout(() => {
      _persistTimer = null;
      persist(ui)
        .then(() => setSaveStatus(ui, 'Gespeichert'))
        .catch(() => setSaveStatus(ui, 'Speichern fehlgeschlagen'));
    }, 350);
  }

  return { getCurrentSidecar, persist, schedule, setSaveStatus };
}
