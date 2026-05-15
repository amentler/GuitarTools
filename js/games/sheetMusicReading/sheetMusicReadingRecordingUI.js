import { buildZip, downloadBlob } from '../../shared/zip.js';
import { saveSheetMusicTake } from '../../shared/audioAnalyseStorage.js';
import { collectBrowserEnvironment } from '../../shared/browserEnvironment.js';

export function makeBasename(bars, bpm, timeSig) {
  const timeSigSafe = timeSig.replace('/', '-');
  const uniqueNoteNames = [...new Set(bars.flat().map(n => n.name))].slice(0, 8).join('');
  const chars = '0123456789abcdefghijklmnopqrstuvwxyz';
  const rand = Array.from({ length: 5 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
  return `notenlesen_${timeSigSafe}_${bpm}bpm_${uniqueNoteNames}_${rand}`;
}

export function makeManifest(bars, bpm, timeSig, browserEnv) {
  return {
    notes: bars.flat().map(n => `${n.name}${n.octave}`),
    bpm,
    timeSig,
    notesPerBeat: 1,
    description: 'Noten lesen',
    category: 'sheet-music-reading',
    recordedAt: new Date().toISOString(),
    browserEnv: browserEnv ?? {},
  };
}

export function createRecordingUI({ recorder, getSaved, setSaved, getAudioSession, getUI }) {
  function syncRecordingUI() {
    const ui = getUI();
    const savedRecordings = getSaved();
    const isRec = recorder.isRecording;
    ui.recordBtn?.classList.toggle('u-hidden', isRec);
    ui.recordStopBtn?.classList.toggle('u-hidden', !isRec);
    ui.recordCancelBtn?.classList.toggle('u-hidden', !isRec);
    if (ui.downloadBtn) ui.downloadBtn.classList.toggle('u-hidden', savedRecordings.length === 0);
    if (ui.analyseBtn) ui.analyseBtn.classList.toggle('u-hidden', savedRecordings.length === 0);
    if (ui.recordingsBtn) ui.recordingsBtn.classList.remove('u-hidden');
  }

  async function startRecording() {
    if (recorder.isRecording) return;
    const audioSession = getAudioSession();
    const ui = getUI();
    try {
      await recorder.start(audioSession.stream ?? null);
    } catch {
      if (ui.permission) {
        ui.permission.classList.remove('u-hidden');
        ui.permission.textContent = 'Mikrofon nicht verfügbar. Aufnahme konnte nicht gestartet werden.';
      }
      return;
    }
    syncRecordingUI();
  }

  async function stopRecording(state) {
    const capturedMimeType = recorder.mimeType;
    const [wav, browserEnv] = await Promise.all([
      recorder.stop(),
      collectBrowserEnvironment(capturedMimeType),
    ]);
    if (!wav) {
      syncRecordingUI();
      return;
    }
    const baseName = makeBasename(state.bars, state.bpm, state.timeSig);
    const manifest = makeManifest(state.bars, state.bpm, state.timeSig, browserEnv);
    const saved = getSaved();
    saved.push({ baseName, wav, manifest });
    setSaved(saved);
    saveSheetMusicTake(wav, manifest, { baseName }).catch(() => {});
    syncRecordingUI();
  }

  function cancelRecording() {
    recorder.cancel();
    syncRecordingUI();
  }

  function downloadRecordings() {
    const savedRecordings = getSaved();
    if (!savedRecordings.length) return;
    const files = savedRecordings.flatMap(({ baseName, wav, manifest }) => [
      { name: `${baseName}.wav`,  data: wav },
      { name: `${baseName}.json`, data: new TextEncoder().encode(JSON.stringify(manifest, null, 2)) },
    ]);
    const zip = buildZip(files);
    downloadBlob(zip, `noten-lesen-aufnahmen-${Date.now()}.zip`, 'application/zip');
    if (confirm('Gespeicherte Aufnahmen jetzt löschen?')) {
      setSaved([]);
      syncRecordingUI();
    }
  }

  return { syncRecordingUI, startRecording, stopRecording, cancelRecording, downloadRecordings };
}
