/**
 * audioAnalyse.js
 *
 * Haupt-Controller für das Audio-Analyse Werkzeug.
 * Koordiniert: Laden (IndexedDB / Datei-Upload), Analyse-Engine, Chart-Rendering.
 *
 * Factory-Pattern: export function createAudioAnalyseFeature()
 */

import { loadLatestSheetMusicTake } from '../../shared/audioAnalyseStorage.js';
import { loadRecordingFromSource } from '../../shared/recordingLoader.js';
import { decodeWav, analyzeAudio, collectFrameData } from './audioAnalyseEngine.js';
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
} from '../../shared/audio/guitarOnsetStrategies.js';
import {
  setEssentiaSheetMusicStrategyInstance,
} from '../../shared/audio/sheetMusicRecognition.js';
import { getEssentia } from '../../shared/audio/essentiaLoader.js';
import { createEssentiaSheetMusicStrategy } from '../../shared/audio/essentiaSheetMusicStrategy.js';
import { ONSET_FFT_SIZE, ONSET_HOP_SIZE } from '../../shared/audio/onsetPipelineConfig.js';
import {
  extractXGBoostFrameFeatures,
  buildContextFeatures,
  getFeatureOrder,
} from '../../shared/audio/xgboostFeatureExtractor.js';
import { resolveGuitarOnsetStrategy as _resolveOnset } from '../../shared/audio/guitarOnsetStrategies.js';
import { downloadBlob } from '../../shared/zip.js';

const PITCH_STRATEGY_LABELS = {
  'fast-note-matcher': 'Fast Note Matcher',
  'essentia-pitch-yin': 'Essentia PitchYin',
};

/**
 * @returns {{ mount(root?: Document|Element): void, unmount(): void }}
 */
export function createAudioAnalyseFeature() {
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
  let _cachedFilename = '';     // original file name for export
  let _cachedManifest = null;   // sidecar/manifest JSON (onsetsMs annotations)
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
      playPauseBtn:   q('btn-play-pause'),
      stopBtn:        q('btn-stop-audio'),
      bottomBar:      q('analyse-bottom-bar'),
      sliderEl:       q('analyse-slider'),
      sliderTimeEl:   q('analyse-slider-time'),
      sliderDurEl:    q('analyse-slider-dur'),
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
    const pitchKey = getSetting(SETTING_KEYS.SHEET_MUSIC_RECOGNITION_STRATEGY);
    const onsetKey = getSetting(SETTING_KEYS.SHEET_MUSIC_ONSET_STRATEGY);
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

    showStatus(ui, 'Analysiere Frames…');
    const pitchStrategyKey = getSetting(SETTING_KEYS.SHEET_MUSIC_RECOGNITION_STRATEGY);
    const onsetStrategyKey = getSetting(SETTING_KEYS.SHEET_MUSIC_ONSET_STRATEGY);
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

    // Samples + Metadaten für Wiedergabe cachen
    _cachedSamples  = decoded.samples;
    _cachedSR       = decoded.sampleRate;
    _cachedFilename = filename;
    _cachedManifest = manifest ?? null;
    _analysisDur   = result.duration;
    _audioBuffer   = null; // wird lazy beim ersten Play erstellt

    hideStatus(ui);
    showStats(ui, result, filename);

    if (!ui.chartsWrapper) return;
    renderAllCharts(ui.chartsWrapper, decoded.samples, result);
    initCrosshair(ui.chartsWrapper);
    ui.chartsWrapper.classList.remove('u-hidden');

    // Bottom-Bar einblenden und Slider kalibrieren
    if (ui.bottomBar) ui.bottomBar.classList.remove('u-hidden');
    if (ui.sliderEl) { ui.sliderEl.value = '0'; }
    if (ui.sliderTimeEl) ui.sliderTimeEl.textContent = '0.00 s';
    if (ui.sliderDurEl) ui.sliderDurEl.textContent = `${result.duration.toFixed(2)} s`;

    // Play/Stop-Buttons einblenden
    if (ui.playPauseBtn) ui.playPauseBtn.classList.remove('u-hidden');
    if (ui.stopBtn)      ui.stopBtn.classList.remove('u-hidden');
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
      const frameResult = await collectFrameData(
        _cachedSamples,
        _cachedSR,
        ONSET_FFT_SIZE,
        ONSET_HOP_SIZE,
      );
      const { frames, actualFftSize, actualHopSize, actualSampleRate } = frameResult;
      const onsetStrategyKey = getSetting(SETTING_KEYS.SHEET_MUSIC_ONSET_STRATEGY);
      const onsetStrategy = _resolveOnset(onsetStrategyKey);
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
        const { samples: frame, frequencyData, t } = frames[i];

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
    _audioBuffer  = null;
    _cachedSamples = null;
    _root = null;
  }

  return { mount, unmount };
}
