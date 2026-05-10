/**
 * audioAnalyse.js
 *
 * Haupt-Controller für das Audio-Analyse Werkzeug.
 * Koordiniert: Laden (IndexedDB / Datei-Upload), Analyse-Engine, Chart-Rendering.
 *
 * Factory-Pattern: export function createAudioAnalyseFeature()
 */

import { loadLastRecording } from '../../shared/audioAnalyseStorage.js';
import { decodeWav, analyzeAudio } from './audioAnalyseEngine.js';
import {
  renderAllCharts,
  initCrosshair,
} from './audioAnalyseSVG.js';
import {
  getSetting,
  SETTING_KEYS,
} from '../../shared/globalSettings.js';
import {
  resolveGuitarOnsetStrategy,
} from '../../shared/audio/guitarOnsetStrategies.js';

const PITCH_STRATEGY_LABELS = {
  'fast-note-matcher': 'Fast Note Matcher',
  'essentia-pitch-yin': 'Essentia PitchYin',
};

/**
 * @returns {{ mount(root?: Document|Element): void, unmount(): void }}
 */
export function createAudioAnalyseFeature() {
  let _root = null;

  function resolveUI(root) {
    const q = (id) => root.getElementById?.(id) ?? root.querySelector?.(`#${id}`) ?? document.getElementById(id);
    return {
      loadLastBtn:   q('btn-load-last'),
      fileInput:     q('input-wav-file'),
      fileLabel:     q('label-wav-file'),
      dropzone:      q('analyse-dropzone'),
      chartsWrapper: q('analyse-charts-wrapper'),
      statsHeader:   q('analyse-stats-header'),
      statusMsg:     q('analyse-status-msg'),
      strategyPitch: q('analyse-strategy-pitch'),
      strategyOnset: q('analyse-strategy-onset'),
    };
  }

  function showStatus(ui, msg, isError = false) {
    if (!ui.statusMsg) return;
    ui.statusMsg.textContent = msg;
    ui.statusMsg.classList.toggle('analyse-status--error', isError);
    ui.statusMsg.classList.remove('u-hidden');
  }

  function hideStatus(ui) {
    if (ui.statusMsg) ui.statusMsg.classList.add('u-hidden');
  }

  function showStats(ui, result, filename) {
    if (!ui.statsHeader) return;
    const onsetCount = result.onsets.length;
    const pitchFrames = result.frames.filter(f => f.hz !== null).length;
    ui.statsHeader.innerHTML = [
      filename ? `<span class="stat-item">📁 ${filename}</span>` : '',
      `<span class="stat-item">⏱ ${result.duration.toFixed(2)} s</span>`,
      `<span class="stat-item">🖼 ${result.frames.length} Frames (${result.fftSize} Samples)</span>`,
      `<span class="stat-item">⚡ ${onsetCount} Onsets</span>`,
      `<span class="stat-item">🎵 ${pitchFrames} Pitch-Frames</span>`,
    ].filter(Boolean).join('');
    ui.statsHeader.classList.remove('u-hidden');
  }

  function updateStrategyLabels(ui) {
    const pitchKey = getSetting(SETTING_KEYS.SHEET_MUSIC_RECOGNITION_STRATEGY);
    const onsetKey = getSetting(SETTING_KEYS.SHEET_MUSIC_ONSET_STRATEGY);
    const onsetStrategy = resolveGuitarOnsetStrategy(onsetKey);
    if (ui.strategyPitch) ui.strategyPitch.textContent = PITCH_STRATEGY_LABELS[pitchKey] ?? pitchKey;
    if (ui.strategyOnset) ui.strategyOnset.textContent = onsetStrategy?.label ?? onsetKey;
  }

  async function runAnalysis(ui, arrayBuffer, filename = '') {
    showStatus(ui, 'Dekodiere Audio…');
    let decoded;
    try {
      decoded = await decodeWav(arrayBuffer);
    } catch (err) {
      showStatus(ui, `Fehler beim Dekodieren: ${err.message}`, true);
      return;
    }

    showStatus(ui, 'Analysiere Frames…');
    const onsetStrategyKey = getSetting(SETTING_KEYS.SHEET_MUSIC_ONSET_STRATEGY);
    let result;
    try {
      result = analyzeAudio(decoded.samples, decoded.sampleRate, { onsetStrategyKey });
    } catch (err) {
      showStatus(ui, `Analyse-Fehler: ${err.message}`, true);
      return;
    }

    hideStatus(ui);
    showStats(ui, result, filename);

    if (!ui.chartsWrapper) return;
    renderAllCharts(ui.chartsWrapper, decoded.samples, result);
    initCrosshair(ui.chartsWrapper);
    ui.chartsWrapper.classList.remove('u-hidden');
  }

  async function handleLoadLast(ui) {
    showStatus(ui, 'Lade letzte Aufnahme aus IndexedDB…');
    let entry;
    try {
      entry = await loadLastRecording();
    } catch {
      showStatus(ui, 'IndexedDB-Fehler: Aufnahme konnte nicht geladen werden.', true);
      return;
    }
    if (!entry) {
      showStatus(ui, 'Keine gespeicherte Aufnahme gefunden. Erstelle zuerst eine Aufnahme in „Noten lesen".', true);
      return;
    }
    const { wav, savedAt } = entry;
    const filename = savedAt ? `Aufnahme vom ${new Date(savedAt).toLocaleString('de-DE')}` : 'Letzte Aufnahme';
    await runAnalysis(ui, wav.buffer, filename);
  }

  async function handleFileInput(ui, file) {
    if (!file) return;
    if (!file.name.endsWith('.wav') && file.type !== 'audio/wav') {
      showStatus(ui, 'Bitte eine WAV-Datei auswählen.', true);
      return;
    }
    showStatus(ui, `Lese ${file.name}…`);
    const buffer = await file.arrayBuffer();
    await runAnalysis(ui, buffer, file.name);
  }

  function wireDropzone(ui) {
    const dz = ui.dropzone;
    if (!dz) return;

    dz.addEventListener('dragover', (e) => {
      e.preventDefault();
      dz.classList.add('dragover');
    });
    dz.addEventListener('dragleave', () => dz.classList.remove('dragover'));
    dz.addEventListener('drop', async (e) => {
      e.preventDefault();
      dz.classList.remove('dragover');
      const file = e.dataTransfer?.files?.[0];
      if (file) await handleFileInput(ui, file);
    });
  }

  function mount(root = document) {
    _root = root;
    const ui = resolveUI(root);

    updateStrategyLabels(ui);

    ui.loadLastBtn?.addEventListener('click', () => void handleLoadLast(ui));

    ui.fileInput?.addEventListener('change', async (e) => {
      const file = e.target.files?.[0];
      if (file) await handleFileInput(ui, file);
      // Input zurücksetzen, damit dieselbe Datei erneut gewählt werden kann
      e.target.value = '';
    });

    wireDropzone(ui);
  }

  function unmount() {
    _root = null;
  }

  return { mount, unmount };
}
