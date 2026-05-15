/**
 * audioAnalyse.js
 *
 * Haupt-Controller für das Audio-Analyse Werkzeug.
 * Koordiniert: Laden (IndexedDB / Datei-Upload), Analyse-Engine, Chart-Rendering.
 *
 * Factory-Pattern: export function createAudioAnalyseFeature()
 */

import { createGlobalDebugStore } from '../../shared/debug/index.js';
import { loadLatestSheetMusicTake } from '../../shared/audioAnalyseStorage.js';
import { loadRecordingFromSource } from '../../shared/recordingLoader.js';
import { decodeWav, analyzeAudio } from './audioAnalyseEngine.js';
import {
  renderAllCharts,
  initCrosshair,
  updatePlayhead,
  resetPlayhead,
  setCrosshairFromFraction,
} from './audioAnalyseSVG.js';
import {
  getSetting,
  SETTING_KEYS,
} from '../../shared/globalSettings.js';
import {
  resolveGuitarOnsetStrategy,
  getGuitarOnsetStrategies,
} from '../../shared/audio/guitarOnsetStrategies.js';
import {
  setEssentiaSheetMusicStrategyInstance,
  getSheetMusicRecognitionStrategies,
} from '../../shared/audio/sheetMusicRecognition.js';
import { getEssentia } from '../../shared/audio/essentiaLoader.js';
import { createEssentiaSheetMusicStrategy } from '../../shared/audio/essentiaSheetMusicStrategy.js';
import { readZip } from '../../shared/zip.js';

const PITCH_STRATEGY_LABELS = {
  'fast-note-matcher': 'Fast Note Matcher',
  'essentia-pitch-yin': 'Essentia PitchYin',
};

/**
 * @returns {{ mount(root?: Document|Element): void, unmount(): void }}
 */
export function createAudioAnalyseFeature() {
  const _debugStore = createGlobalDebugStore();
  let _root = null;

  // ── Playback-State ─────────────────────────────────────────────────────────
  let _audioCtx       = null;
  let _audioBuffer    = null;   // decoded AudioBuffer für Web Audio
  let _sourceNode     = null;   // laufende AudioBufferSourceNode
  let _playStartTime  = 0;      // audioCtx.currentTime beim Start
  let _playOffset     = 0;      // Abspielposition beim letzten Pause (Sekunden)
  let _isPlaying      = false;
  let _rafId          = null;
  let _analysisDur    = 1;
  let _cachedSamples  = null;   // Float32Array für späteren Re-Decode-Bedarf
  let _cachedSR       = 44100;
  let _cachedFilename = '';
  let _cachedManifest = null;
  let _sliderDragging = false;

  function resolveUI(root) {
    const q = (id) => root.getElementById?.(id) ?? root.querySelector?.(`#${id}`) ?? document.getElementById(id);
    return {
      fileInput:      q('input-wav-file'),
      fileLabel:      q('label-wav-file'),
      dropzone:       q('analyse-dropzone'),
      chartsWrapper:  q('analyse-charts-wrapper'),
      statsHeader:    q('analyse-stats-header'),
      statusMsg:      q('analyse-status-msg'),
      strategyPitch:  q('analyse-strategy-pitch'),
      strategyOnset:  q('analyse-strategy-onset'),
      playPauseBtn:        q('btn-play-pause'),
      stopBtn:             q('btn-stop-audio'),
      bottomBar:           q('analyse-bottom-bar'),
      sliderRow:           q('analyse-slider-row'),
      transportRow:        q('analyse-transport-row'),
      sliderEl:            q('analyse-slider'),
      sliderTimeEl:        q('analyse-slider-time'),
      sliderDurEl:         q('analyse-slider-dur'),
      pitchStrategySelect: q('analyse-pitch-select'),
      onsetStrategySelect: q('analyse-onset-select'),
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
    const pitchKey = ui.pitchStrategySelect?.value ?? getSetting(SETTING_KEYS.SHEET_MUSIC_RECOGNITION_STRATEGY);
    const onsetKey = ui.onsetStrategySelect?.value ?? getSetting(SETTING_KEYS.SHEET_MUSIC_ONSET_STRATEGY);
    const onsetStrategy = resolveGuitarOnsetStrategy(onsetKey);
    if (ui.strategyPitch) ui.strategyPitch.textContent = PITCH_STRATEGY_LABELS[pitchKey] ?? pitchKey;
    if (ui.strategyOnset) ui.strategyOnset.textContent = onsetStrategy?.label ?? onsetKey;
  }

  async function ensureSelectedPitchStrategyReady(pitchStrategyKey) {
    if (pitchStrategyKey !== 'essentia-pitch-yin') return;
    const essentia = await getEssentia();
    setEssentiaSheetMusicStrategyInstance(createEssentiaSheetMusicStrategy(essentia));
  }

  async function runAnalysis(ui, arrayBuffer, filename = '', manifest = null) {
    // Laufende Wiedergabe stoppen, bevor neue Analyse beginnt
    stopPlayback(ui);

    showStatus(ui, 'Dekodiere Audio…');
    let decoded;
    try {
      decoded = await decodeWav(arrayBuffer);
    } catch (err) {
      showStatus(ui, `Fehler beim Dekodieren: ${err.message}`, true);
      return;
    }
    _debugStore.addEntry('audio:decoded', {
      sampleRate: decoded.sampleRate,
      duration: decoded.audioBuffer.duration,
      length: decoded.audioBuffer.length,
      filename,
    }, { source: 'audioAnalyse' });

    showStatus(ui, 'Analysiere Frames…');
    const pitchStrategyKey = ui.pitchStrategySelect?.value ?? getSetting(SETTING_KEYS.SHEET_MUSIC_RECOGNITION_STRATEGY);
    const onsetStrategyKey = ui.onsetStrategySelect?.value ?? getSetting(SETTING_KEYS.SHEET_MUSIC_ONSET_STRATEGY);
    let result;
    try {
      await ensureSelectedPitchStrategyReady(pitchStrategyKey);
      result = await analyzeAudio(decoded.samples, decoded.sampleRate, {
        onsetStrategyKey,
        pitchStrategyKey,
        targetSequence: manifest?.notes,
      });
    } catch (err) {
      showStatus(ui, `Analyse-Fehler: ${err.message}`, true);
      return;
    }

    // Samples + Metadaten für Wiedergabe und Re-Analyse cachen
    _cachedSamples  = decoded.samples;
    _cachedSR       = decoded.sampleRate;
    _cachedFilename = filename;
    _cachedManifest = manifest;
    _analysisDur    = result.duration;
    _audioBuffer    = null; // wird lazy beim ersten Play erstellt

    hideStatus(ui);
    showStats(ui, result, filename);

    if (!ui.chartsWrapper) return;
    renderAllCharts(ui.chartsWrapper, decoded.samples, result);
    initCrosshair(ui.chartsWrapper);
    ui.chartsWrapper.classList.remove('u-hidden');

    // Slider + Transport einblenden und Slider kalibrieren
    if (ui.sliderRow)   ui.sliderRow.classList.remove('u-hidden');
    if (ui.transportRow) ui.transportRow.classList.remove('u-hidden');
    if (ui.sliderEl) { ui.sliderEl.value = '0'; }
    if (ui.sliderTimeEl) ui.sliderTimeEl.textContent = '0.00 s';
    if (ui.sliderDurEl) ui.sliderDurEl.textContent = `${result.duration.toFixed(2)} s`;
    setPlayPauseLabel(ui, false);
  }

  // ── Playback-Hilfsfunktionen ───────────────────────────────────────────────

  function setPlayPauseLabel(ui, playing) {
    if (ui.playPauseBtn) ui.playPauseBtn.textContent = playing ? '⏸ Pause' : '▶ Abspielen';
  }

  function getOrCreateAudioCtx() {
    if (!_audioCtx || _audioCtx.state === 'closed') {
      _audioCtx = new AudioContext();
    }
    return _audioCtx;
  }

  function buildAudioBuffer(ctx) {
    if (_audioBuffer) return _audioBuffer;
    const buf = ctx.createBuffer(1, _cachedSamples.length, _cachedSR);
    buf.copyToChannel(_cachedSamples, 0);
    _audioBuffer = buf;
    return buf;
  }

  function startPlayback(ui, offset = 0) {
    const ctx = getOrCreateAudioCtx();
    if (ctx.state === 'suspended') ctx.resume();

    const buf = buildAudioBuffer(ctx);
    _sourceNode = ctx.createBufferSource();
    _sourceNode.buffer = buf;
    _sourceNode.loop = true;
    _sourceNode.connect(ctx.destination);
    _sourceNode.start(0, offset % _analysisDur);

    _playStartTime = ctx.currentTime - (offset % _analysisDur);
    _playOffset    = offset % _analysisDur;
    _isPlaying     = true;
    setPlayPauseLabel(ui, true);
    startRaf(ui);
  }

  function pausePlayback(ui) {
    if (!_isPlaying) return;
    const ctx = _audioCtx;
    const elapsed = ctx.currentTime - _playStartTime;
    _playOffset = elapsed % _analysisDur;

    _sourceNode?.stop();
    _sourceNode = null;
    _isPlaying  = false;
    setPlayPauseLabel(ui, false);
    stopRaf();

    // Crosshair + Slider an Pause-Position setzen
    const fraction = _playOffset / _analysisDur;
    setCrosshairFromFraction(fraction);
    if (ui.sliderEl) ui.sliderEl.value = String(Math.round(fraction * 1000));
    if (ui.sliderTimeEl) ui.sliderTimeEl.textContent = `${_playOffset.toFixed(2)} s`;
  }

  function stopPlayback(ui) {
    _sourceNode?.stop();
    _sourceNode = null;
    _isPlaying  = false;
    _playOffset = 0;
    stopRaf();
    resetPlayhead();
    if (ui) {
      setPlayPauseLabel(ui, false);
      if (ui.sliderEl) ui.sliderEl.value = '0';
      if (ui.sliderTimeEl) ui.sliderTimeEl.textContent = '0.00 s';
    }
  }

  function startRaf(ui) {
    if (_rafId !== null) return;
    function tick() {
      if (!_isPlaying || !_audioCtx) return;
      const elapsed  = _audioCtx.currentTime - _playStartTime;
      const fraction = (elapsed % _analysisDur) / _analysisDur;
      updatePlayhead(fraction);
      if (!_sliderDragging && ui.sliderEl) {
        ui.sliderEl.value = String(Math.round(fraction * 1000));
      }
      if (ui.sliderTimeEl) {
        ui.sliderTimeEl.textContent = `${(fraction * _analysisDur).toFixed(2)} s`;
      }
      _rafId = requestAnimationFrame(tick);
    }
    _rafId = requestAnimationFrame(tick);
  }

  function stopRaf() {
    if (_rafId !== null) {
      cancelAnimationFrame(_rafId);
      _rafId = null;
    }
  }

  function handlePlayPause(ui) {
    if (!_cachedSamples) return;
    if (_isPlaying) {
      pausePlayback(ui);
    } else {
      startPlayback(ui, _playOffset);
    }
  }

  function handleStop(ui) {
    stopPlayback(ui);
  }

  async function reAnalyze(ui) {
    if (!_cachedSamples) return;
    stopPlayback(ui);
    showStatus(ui, 'Analysiere Frames…');
    const pitchStrategyKey = ui.pitchStrategySelect?.value ?? getSetting(SETTING_KEYS.SHEET_MUSIC_RECOGNITION_STRATEGY);
    const onsetStrategyKey = ui.onsetStrategySelect?.value ?? getSetting(SETTING_KEYS.SHEET_MUSIC_ONSET_STRATEGY);
    let result;
    try {
      await ensureSelectedPitchStrategyReady(pitchStrategyKey);
      result = await analyzeAudio(_cachedSamples, _cachedSR, {
        onsetStrategyKey,
        pitchStrategyKey,
        targetSequence: _cachedManifest?.notes,
      });
    } catch (err) {
      showStatus(ui, `Analyse-Fehler: ${err.message}`, true);
      return;
    }
    _analysisDur = result.duration;
    _audioBuffer = null;
    hideStatus(ui);
    showStats(ui, result, _cachedFilename);
    if (!ui.chartsWrapper) return;
    renderAllCharts(ui.chartsWrapper, _cachedSamples, result);
    initCrosshair(ui.chartsWrapper);
    if (ui.sliderEl) ui.sliderEl.value = '0';
    if (ui.sliderTimeEl) ui.sliderTimeEl.textContent = '0.00 s';
    if (ui.sliderDurEl) ui.sliderDurEl.textContent = `${result.duration.toFixed(2)} s`;
    setPlayPauseLabel(ui, false);
    updateStrategyLabels(ui);
  }

  async function handleLoadLatest(ui, { silent = false } = {}) {
    if (!silent) showStatus(ui, 'Lade neueste Notenlesen-Aufnahme aus IndexedDB…');
    let entry;
    try {
      entry = await loadLatestSheetMusicTake();
    } catch {
      showStatus(ui, 'IndexedDB-Fehler: Aufnahme konnte nicht geladen werden.', true);
      return;
    }
    if (!entry) {
      if (!silent) {
        showStatus(ui, 'Keine gespeicherte Aufnahme gefunden. Erstelle zuerst eine Aufnahme in „Noten lesen".', true);
      }
      return;
    }
    const { wav, savedAt } = entry;
    const filename = entry.baseName
      ?? (savedAt ? `Notenlesen · ${new Date(savedAt).toLocaleString('de-DE')}` : '');
    await runAnalysis(ui, wav.buffer, filename, entry.sidecar);
  }

  async function handleFileInput(ui, file) {
    if (!file) return;
    if (file.name.toLowerCase().endsWith('.zip') || file.type === 'application/zip') {
      const buf     = await file.arrayBuffer();
      const entries = readZip(new Uint8Array(buf));
      const wavEntry  = entries.find(e => e.name.toLowerCase().endsWith('.wav'));
      if (!wavEntry) { showStatus(ui, 'Keine WAV-Datei in der ZIP gefunden.', true); return; }
      const jsonEntry = entries.find(e => e.name.toLowerCase().endsWith('.json'));
      let sidecar;
      if (jsonEntry) {
        try { sidecar = JSON.parse(new TextDecoder().decode(jsonEntry.data)); } catch { /* ignore */ }
      }
      showStatus(ui, `Lese ${wavEntry.name} aus ZIP…`);
      await runAnalysis(ui, wavEntry.data.buffer, wavEntry.name, sidecar);
      return;
    }
    if (!file.name.endsWith('.wav') && file.type !== 'audio/wav') {
      showStatus(ui, 'Bitte eine WAV- oder ZIP-Datei auswählen.', true);
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

    // Dropdowns mit Strategielisten befüllen und auf globale Defaults vorselektieren
    const defaultPitch = getSetting(SETTING_KEYS.SHEET_MUSIC_RECOGNITION_STRATEGY);
    const defaultOnset = getSetting(SETTING_KEYS.SHEET_MUSIC_ONSET_STRATEGY);

    if (ui.pitchStrategySelect) {
      ui.pitchStrategySelect.innerHTML = getSheetMusicRecognitionStrategies()
        .map(s => `<option value="${s.key}"${s.key === defaultPitch ? ' selected' : ''}>${s.label}</option>`)
        .join('');
    }
    if (ui.onsetStrategySelect) {
      ui.onsetStrategySelect.innerHTML = getGuitarOnsetStrategies()
        .map(s => `<option value="${s.key}"${s.key === defaultOnset ? ' selected' : ''}>${s.label}</option>`)
        .join('');
    }

    ui.pitchStrategySelect?.addEventListener('change', () => {
      updateStrategyLabels(ui);
      if (_cachedSamples) void reAnalyze(ui);
    });
    ui.onsetStrategySelect?.addEventListener('change', () => {
      updateStrategyLabels(ui);
      if (_cachedSamples) void reAnalyze(ui);
    });

    updateStrategyLabels(ui);

    ui.fileInput?.addEventListener('change', async (e) => {
      const file = e.target.files?.[0];
      if (file) await handleFileInput(ui, file);
      // Input zurücksetzen, damit dieselbe Datei erneut gewählt werden kann
      e.target.value = '';
    });

    ui.playPauseBtn?.addEventListener('click', () => handlePlayPause(ui));
    ui.stopBtn?.addEventListener('click', () => handleStop(ui));

    // Slider: Drag-Flag setzen, damit RAF den Slider nicht überschreibt
    ui.sliderEl?.addEventListener('pointerdown', () => { _sliderDragging = true; });
    ui.sliderEl?.addEventListener('pointerup',   () => { _sliderDragging = false; });
    ui.sliderEl?.addEventListener('pointercancel', () => { _sliderDragging = false; });

    // Slider: Seek während Drag und per Tastatur
    ui.sliderEl?.addEventListener('input', () => {
      if (!_cachedSamples) return;
      const frac      = parseInt(ui.sliderEl.value, 10) / 1000;
      const newOffset = frac * _analysisDur;
      const wasPlaying = _isPlaying;

      if (_isPlaying) {
        _sourceNode?.stop();
        _sourceNode = null;
        _isPlaying  = false;
        stopRaf();
      }

      _playOffset = newOffset;
      updatePlayhead(frac);
      setCrosshairFromFraction(frac);
      if (ui.sliderTimeEl) ui.sliderTimeEl.textContent = `${newOffset.toFixed(2)} s`;

      if (wasPlaying) startPlayback(ui, newOffset);
    });

    wireDropzone(ui);

    const params = new URLSearchParams(window.location.search);
    const source = params.get('source');
    const id     = params.get('id') ?? '';
    if (source) {
      void handleLoadFromSource(ui, source, id);
    } else {
      void handleLoadLatest(ui, { silent: true });
    }
  }

  async function handleLoadFromSource(ui, source, id) {
    showStatus(ui, 'Lade Aufnahme…');
    let entry;
    try {
      entry = await loadRecordingFromSource(source, id);
    } catch {
      showStatus(ui, 'Aufnahme konnte nicht geladen werden.', true);
      return;
    }
    if (!entry) {
      showStatus(ui, 'Aufnahme nicht gefunden.', true);
      return;
    }
    const name = source === 'sheet-music'
      ? entry.baseName ?? entry.id ?? id
      : id;
    await runAnalysis(ui, entry.wav.buffer, name, entry.manifest);
  }

  function unmount() {
    stopPlayback(null);
    if (_audioCtx && _audioCtx.state !== 'closed') {
      _audioCtx.close();
      _audioCtx = null;
    }
    _audioBuffer    = null;
    _cachedSamples  = null;
    _cachedFilename = '';
    _cachedManifest = null;
    _root = null;
  }

  return { mount, unmount };
}
