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
import { collectFrameData } from '../../shared/audio/collectFrameData.js';
import { ONSET_FFT_SIZE, ONSET_HOP_SIZE } from '../../shared/audio/onsetPipelineConfig.js';
import {
  extractXGBoostFrameFeatures,
  buildContextFeatures,
  getFeatureOrder,
} from '../../shared/audio/xgboostFeatureExtractor.js';
import { readZip, downloadBlob } from '../../shared/zip.js';

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
  let _analysisResult = null;
  let _rangeStart     = 0;
  let _rangeEnd       = 0;
  let _normalizeY     = true;
  let _showDetectedOnsets = true;
  let _showTaggedOnsets   = true;
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
      rangeControls:       q('analyse-range-controls'),
      rangeStartEl:        q('analyse-range-start'),
      rangeEndEl:          q('analyse-range-end'),
      rangeDisplay:        q('analyse-range-display'),
      normalizeYEl:        q('analyse-normalize-y'),
      showDetectedOnsetsEl: q('analyse-show-detected-onsets'),
      showTaggedOnsetsEl:   q('analyse-show-tagged-onsets'),
      pitchStrategySelect: q('analyse-pitch-select'),
      onsetStrategySelect: q('analyse-onset-select'),
      exportTrainingBtn:   q('btn-export-training'),
      exportTrainingRow:   q('analyse-training-export-row'),
      exportStatusEl:      q('analyse-export-status'),
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

  function getTaggedOnsetsSec() {
    const taggedMs = _cachedManifest?.onsetsMs;
    if (!Array.isArray(taggedMs)) return [];
    return taggedMs
      .filter(ms => Number.isFinite(ms))
      .map(ms => ms / 1000)
      .sort((a, b) => a - b);
  }

  function renderCurrentAnalysis(ui) {
    if (!ui.chartsWrapper || !_cachedSamples || !_analysisResult) return;
    renderAllCharts(ui.chartsWrapper, _cachedSamples, _analysisResult, {
      rangeStart: _rangeStart,
      rangeEnd: _rangeEnd,
      normalizeY: _normalizeY,
      showDetectedOnsets: _showDetectedOnsets,
      showTaggedOnsets: _showTaggedOnsets,
      taggedOnsets: getTaggedOnsetsSec(),
    });
    initCrosshair(ui.chartsWrapper);
    ui.chartsWrapper.classList.remove('u-hidden');
  }

  function syncRangeControls(ui) {
    if (!_analysisResult || !ui.rangeStartEl || !ui.rangeEndEl) return;
    const duration = Math.max(0, _analysisResult.duration);
    let start = parseFloat(ui.rangeStartEl.value);
    let end = parseFloat(ui.rangeEndEl.value);
    if (!Number.isFinite(start)) start = 0;
    if (!Number.isFinite(end)) end = duration;
    if (start >= end) {
      if (document.activeElement === ui.rangeStartEl) {
        start = Math.max(0, end - 0.01);
        ui.rangeStartEl.value = start.toFixed(4);
      } else {
        end = Math.min(duration, start + 0.01);
        ui.rangeEndEl.value = end.toFixed(4);
      }
    }
    _rangeStart = Math.max(0, Math.min(Math.max(0, duration - 0.01), start));
    _rangeEnd = Math.max(_rangeStart + 0.01, Math.min(duration, end));
    if (ui.rangeDisplay) {
      ui.rangeDisplay.textContent = `${_rangeStart.toFixed(2)} s - ${_rangeEnd.toFixed(2)} s`;
    }
    renderCurrentAnalysis(ui);
    updatePlayhead(_analysisDur > 0 ? _playOffset / _analysisDur : 0);
  }

  function resetRangeControls(ui, duration) {
    _rangeStart = 0;
    _rangeEnd = duration;
    if (ui.rangeStartEl) {
      ui.rangeStartEl.min = '0';
      ui.rangeStartEl.max = duration.toFixed(4);
      ui.rangeStartEl.step = '0.001';
      ui.rangeStartEl.value = '0';
    }
    if (ui.rangeEndEl) {
      ui.rangeEndEl.min = '0';
      ui.rangeEndEl.max = duration.toFixed(4);
      ui.rangeEndEl.step = '0.001';
      ui.rangeEndEl.value = duration.toFixed(4);
    }
    if (ui.rangeDisplay) {
      ui.rangeDisplay.textContent = `0.00 s - ${duration.toFixed(2)} s`;
    }
    if (ui.normalizeYEl) ui.normalizeYEl.checked = _normalizeY;
    if (ui.showDetectedOnsetsEl) ui.showDetectedOnsetsEl.checked = _showDetectedOnsets;
    if (ui.showTaggedOnsetsEl) {
      ui.showTaggedOnsetsEl.checked = _showTaggedOnsets;
      ui.showTaggedOnsetsEl.disabled = getTaggedOnsetsSec().length === 0;
    }
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
    _cachedManifest = manifest ?? null;
    _analysisResult = result;
    _analysisDur    = result.duration;
    _audioBuffer    = null; // wird lazy beim ersten Play erstellt

    hideStatus(ui);
    showStats(ui, result, filename);

    resetRangeControls(ui, result.duration);
    renderCurrentAnalysis(ui);

    // Slider + Transport einblenden und Slider kalibrieren
    if (ui.sliderRow)   ui.sliderRow.classList.remove('u-hidden');
    if (ui.transportRow) ui.transportRow.classList.remove('u-hidden');
    if (ui.rangeControls) ui.rangeControls.classList.remove('u-hidden');
    if (ui.sliderEl) { ui.sliderEl.value = '0'; }
    if (ui.sliderTimeEl) ui.sliderTimeEl.textContent = '0.00 s';
    if (ui.sliderDurEl) ui.sliderDurEl.textContent = `${result.duration.toFixed(2)} s`;
    setPlayPauseLabel(ui, false);

    // Training-Export-Row einblenden
    if (ui.exportTrainingRow) ui.exportTrainingRow.classList.remove('u-hidden');
    if (ui.exportStatusEl)    ui.exportStatusEl.textContent = '';
  }

  async function handleTrainingExport(ui) {
    if (!_cachedSamples) {
      if (ui.exportStatusEl) ui.exportStatusEl.textContent = 'Keine Audiodaten geladen.';
      return;
    }
    if (ui.exportStatusEl) ui.exportStatusEl.textContent = '⏳ Exportiere…';
    if (ui.exportTrainingBtn) ui.exportTrainingBtn.disabled = true;

    try {
      const frames = await collectFrameData(
        _cachedSamples,
        _cachedSR,
        ONSET_FFT_SIZE,
        ONSET_HOP_SIZE,
      );
      const actualFftSize = ONSET_FFT_SIZE;
      const actualHopSize = ONSET_HOP_SIZE;
      const actualSampleRate = _cachedSR;
      const onsetStrategyKey = getSetting(SETTING_KEYS.SHEET_MUSIC_ONSET_STRATEGY);
      const onsetStrategy = resolveGuitarOnsetStrategy(onsetStrategyKey);
      let onsetState = onsetStrategy.createState();

      const featureOrder = getFeatureOrder();
      const trainingFrames = [];

      let prevLinearMag = null;
      let prevRms = 0;
      let prevHfc = 0;
      let prevSpectralCentroid = 0;
      let prevSpectralRolloff = 0;
      let prevSpectralFlatness = 0;
      let prevCrestFactor = 0;
      let prevLogBandFlux_150_6000 = 0;
      const historyBuffer = [];

      for (let i = 0; i < frames.length; i++) {
        const { samples: frame, frequencyData } = frames[i];
        const t = (i * actualHopSize + actualFftSize / 2) / actualSampleRate;

        const onsetResult = onsetStrategy.update(onsetState, { frequencyData, samples: frame });
        onsetState = onsetResult.nextState;

        const history = {
          prevMagnitudes: prevLinearMag,
          prevRms,
          prevHfc,
          prevSpectralCentroid,
          prevSpectralRolloff,
          prevSpectralFlatness,
          prevCrestFactor,
          prevLogBandFlux_150_6000,
        };

        const { baseFeatures, linearMagnitudes } = extractXGBoostFrameFeatures(
          frame,
          frequencyData,
          onsetResult,
          actualSampleRate,
          actualFftSize,
          1000,
          history,
        );

        const contextFeatures = buildContextFeatures(baseFeatures, historyBuffer, featureOrder);
        historyBuffer.unshift({ ...baseFeatures });
        if (historyBuffer.length > 30) historyBuffer.pop();

        prevLinearMag = linearMagnitudes;
        prevRms = baseFeatures.rms;
        prevHfc = baseFeatures.hfc;
        prevSpectralCentroid = baseFeatures.spectralCentroid;
        prevSpectralRolloff = baseFeatures.spectralRolloff;
        prevSpectralFlatness = baseFeatures.spectralFlatness;
        prevCrestFactor = baseFeatures.crestFactor;
        prevLogBandFlux_150_6000 = baseFeatures.logBandFlux_150_6000;

        trainingFrames.push({ t, features: contextFeatures });
      }

      const randomStr = Math.random().toString(36).slice(2, 8);
      const baseName = (_cachedFilename || 'audio').replace(/\.[^.]+$/, '');
      const exportName = `training_data_${baseName}_${randomStr}.json`;

      const exportObj = {
        schemaVersion: 1,
        metadata: {
          filename: _cachedFilename,
          sampleRate: actualSampleRate,
          fftSize: actualFftSize,
          hopSize: actualHopSize,
          frameCount: frames.length,
          featureOrder,
          onsetStrategyKey: onsetStrategyKey ?? 'default',
        },
        frames: trainingFrames,
        annotations: {
          onsetsMs: _cachedManifest?.onsetsMs ?? null,
        },
      };

      const blob = new Blob([JSON.stringify(exportObj)], { type: 'application/json' });
      downloadBlob(blob, exportName);

      if (ui.exportStatusEl) ui.exportStatusEl.textContent = `✅ ${exportName}`;
    } catch (err) {
      if (ui.exportStatusEl) ui.exportStatusEl.textContent = `❌ ${err.message}`;
    } finally {
      if (ui.exportTrainingBtn) ui.exportTrainingBtn.disabled = false;
    }
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
    _analysisResult = result;
    _analysisDur = result.duration;
    _audioBuffer = null;
    hideStatus(ui);
    showStats(ui, result, _cachedFilename);
    resetRangeControls(ui, result.duration);
    renderCurrentAnalysis(ui);
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
    ui.exportTrainingBtn?.addEventListener('click', () => handleTrainingExport(ui));

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

    ui.rangeStartEl?.addEventListener('input', () => syncRangeControls(ui));
    ui.rangeEndEl?.addEventListener('input', () => syncRangeControls(ui));
    ui.normalizeYEl?.addEventListener('change', () => {
      _normalizeY = ui.normalizeYEl.checked;
      renderCurrentAnalysis(ui);
    });
    ui.showDetectedOnsetsEl?.addEventListener('change', () => {
      _showDetectedOnsets = ui.showDetectedOnsetsEl.checked;
      renderCurrentAnalysis(ui);
    });
    ui.showTaggedOnsetsEl?.addEventListener('change', () => {
      _showTaggedOnsets = ui.showTaggedOnsetsEl.checked;
      renderCurrentAnalysis(ui);
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
    _analysisResult = null;
    _root = null;
  }

  return { mount, unmount };
}
