import {
  clamp,
  computeRangeSliderState,
  computeFocusedRange,
  computeSteppedZoomRange,
  constrainVisibleRange,
  removeOnset,
  normalizeRecordingBaseName,
  resolveRecordingFileBaseName,
  normalizeSidecarFormat,
  extractRandomSuffix,
  buildGeneratedBaseName,
} from './onsetTaggerLogic.js';
import { loadRecordingFromSource } from '../../shared/recordingLoader.js';
import { getGuitarOnsetStrategies, loadGuitarOnsetStrategiesFromRegistry } from '../../shared/audio/guitarOnsetStrategies.js';
import { createGlobalDebugStore } from '../../shared/debug/index.js';
import { createOnsetTaggerPersistenceController } from './onsetTaggerPersistence.js';
import { createOnsetTaggerAnalysisFlyout } from './onsetTaggerAnalysisFlyout.js';
import { renderOnsetList } from './onsetTaggerOnsetList.js';
import { createAudioTransport } from '../../shared/audio/audioTransport.js';
import { wireOnsetTaggerEvents } from './onsetTaggerEventWiring.js';

import {
  renderWaveform,
  updatePlayhead,
  updateCursor,
  updateOnsetMarkers,
} from './onsetTaggerWaveform.js';

import { buildRecordingZip, readRecordingZip, downloadBlob } from '../../shared/zip.js';
import {
  DEFAULT_SIDECAR_FIELDS,
  renderMetaForm,
  readMetaForm,
} from './onsetTaggerMetaForm.js';

const FOCUS_WINDOW_SEC = 0.6;
const MIN_VISIBLE_RANGE_SEC = 0.01;
const ZOOM_STEP_FRACTION = 0.1;

export function createOnsetTaggerFeature() {
  const _debugStore = createGlobalDebugStore();
  let _samples       = null;   // Float32Array
  let _sampleRate    = 44100;
  let _duration      = 0;
  let _wavArrayBuffer = null;
  let _wavFilename   = '';
  let _fileBaseName  = 'recording';
  let _sidecarFilename = '';
  let _sidecarData   = null;
  let _recordingSource = '';
  let _recordingId = '';

  let _rangeStart    = 0;
  let _rangeEnd      = 0;
  let _cursorSec     = 0;
  let _onsetsMs      = [];
  let _selectedOnsetIndex = -1;
  let _playbackRate  = 1.0;
  let _root = null;
  let _svgEl = null;
  let _ui = null;

  const _transport = createAudioTransport();
  const _analysisFlyout = createOnsetTaggerAnalysisFlyout({
    getSamples: () => _samples,
    getSampleRate: () => _sampleRate,
    getBaseName: () => _fileBaseName,
    getRangeStart: () => _rangeStart,
    getRangeEnd: () => _rangeEnd,
    getCursorSec: () => _cursorSec,
    getTaggedOnsetsSec: () => _onsetsMs
      .filter(ms => Number.isFinite(ms))
      .map(ms => ms / 1000)
      .sort((a, b) => a - b),
  });
  const _persistence = createOnsetTaggerPersistenceController({
    getWavArrayBuffer: () => _wavArrayBuffer,
    getSamples: () => _samples,
    getSource: () => _recordingSource,
    getId: () => _recordingId,
    getBaseName: () => _fileBaseName,
    getOnsets: () => _onsetsMs,
    getSidecarData: () => _sidecarData,
    setSavedRecording: (saved, sidecar) => {
      _recordingSource = saved.source;
      _recordingId = saved.id;
      _sidecarData = sidecar;
      setBaseName(saved.baseName);
    },
  });

  function q(id) {
    return _root.querySelector(`#${id}`) ?? document.getElementById(id);
  }

  function resolveUI() {
    return {
      wavBtn:        q('tagger-wav-btn'),
      loadMenuBtn:   q('tagger-load-menu-btn'),
      loadMenuPanel: q('tagger-load-menu-panel'),
      wavInput:      q('tagger-wav-input'),
      wavLabel:      q('tagger-wav-label'),
      jsonBtn:       q('tagger-json-btn'),
      jsonInput:     q('tagger-json-input'),
      jsonLabel:     q('tagger-json-label'),
      zipBtn:        q('tagger-zip-btn'),
      zipInput:      q('tagger-zip-input'),
      zipLabel:      q('tagger-zip-label'),
      waveformWrap:  q('tagger-waveform-wrap'),
      step1:         q('tagger-step1'),
      step2:         q('tagger-step2'),
      rangeStartEl:  q('tagger-range-start'),
      rangeEndEl:    q('tagger-range-end'),
      rangeDisplay:  q('tagger-range-display'),
      cursorEl:      q('tagger-cursor'),
      cursorDisplay: q('tagger-cursor-display'),
      addOnsetBtn:   q('tagger-add-onset'),
      removeOnsetBtn: q('tagger-remove-onset'),
      zoomInBtn:      q('tagger-zoom-in'),
      zoomOutBtn:     q('tagger-zoom-out'),
      strategyList:   q('tagger-strategy-list'),
      strategyStatus: q('tagger-strategy-status'),
      playBtn:       q('tagger-play'),
      stopBtn:       q('tagger-stop'),
      speedBtns:     document.querySelectorAll('[data-speed]'),
      onsetList:     q('tagger-onset-list'),
      metaForm:      q('tagger-meta-form'),
      autoBpmValue:  q('tagger-auto-bpm-value'),
      exportBtn:     q('tagger-export'),
      exportTopBtn:  q('tagger-export-top'),
      filenameInput: q('tagger-filename-input'),
      saveStatus:    q('tagger-save-status'),
      openAnalyserBtn: q('tagger-open-analyser'),
      analysisStatus: q('tagger-analysis-status'),
      analysisChartsWrapper: q('tagger-analysis-charts-wrapper'),
      analysisNormalizeYEl: q('tagger-analysis-normalize-y'),
      analysisShowDetectedOnsetsEl: q('tagger-analysis-show-detected-onsets'),
      analysisShowTaggedOnsetsEl: q('tagger-analysis-show-tagged-onsets'),
      analysisOnsetSelectEl: q('tagger-analysis-onset-select'),
      analysisStatsEl: q('tagger-analysis-stats'),
    };
  }

  // ── Name helpers ────────────────────────────────────────────────────────────

  function setBaseName(value) {
    _fileBaseName = normalizeRecordingBaseName(value, _fileBaseName || 'recording');
    _wavFilename = `${_fileBaseName}.wav`;
    _sidecarFilename = `${_fileBaseName}.json`;
    const display = _ui?.metaForm?.querySelector('.tagger-basename-display');
    if (display) display.textContent = _fileBaseName;
  }

  function computeAndSetBaseName() {
    if (!_ui?.metaForm) return;
    const meta = readMetaForm(_ui);
    const suffix = extractRandomSuffix(_recordingId);
    const generated = buildGeneratedBaseName(meta, suffix);
    setBaseName(generated);
  }

  function schedulePersist() {
    _persistence.schedule(_ui);
  }

  // ── Range / cursor sync ─────────────────────────────────────────────────────

  function syncRangeSliderBounds() {
    const sliderState = computeRangeSliderState(_rangeStart, _rangeEnd, _duration);
    _ui.rangeStartEl.min = sliderState.start.min.toFixed(4);
    _ui.rangeStartEl.max = sliderState.start.max.toFixed(4);
    _ui.rangeStartEl.value = sliderState.start.value.toFixed(4);
    _ui.rangeEndEl.min = sliderState.end.min.toFixed(4);
    _ui.rangeEndEl.max = sliderState.end.max.toFixed(4);
    _ui.rangeEndEl.value = sliderState.end.value.toFixed(4);
  }

  function syncRangeSliders(changedEdge = 'both') {
    const range = constrainVisibleRange(
      parseFloat(_ui.rangeStartEl.value),
      parseFloat(_ui.rangeEndEl.value),
      _duration, changedEdge, MIN_VISIBLE_RANGE_SEC,
    );
    _rangeStart = range.start;
    _rangeEnd = range.end;
    syncRangeSliderBounds();
    if (_ui.rangeDisplay) {
      _ui.rangeDisplay.textContent = `${_rangeStart.toFixed(2)} s – ${_rangeEnd.toFixed(2)} s`;
    }
    _cursorSec = clamp(_cursorSec, _rangeStart, _rangeEnd);
    _ui.cursorEl.min   = 0;
    _ui.cursorEl.max   = Math.round((_rangeEnd - _rangeStart) * 1000);
    _ui.cursorEl.value = Math.round((_cursorSec - _rangeStart) * 1000);
    if (_ui.cursorDisplay) {
      _ui.cursorDisplay.textContent = `${_cursorSec.toFixed(3)} s`;
    }
    redrawWaveform();
    _analysisFlyout.render(_ui);
  }

  function syncCursorUI() {
    _cursorSec = clamp(_cursorSec, _rangeStart, _rangeEnd);
    _ui.cursorEl.min = 0;
    _ui.cursorEl.max = Math.round((_rangeEnd - _rangeStart) * 1000);
    _ui.cursorEl.value = Math.round((_cursorSec - _rangeStart) * 1000);
    if (_ui.cursorDisplay) {
      _ui.cursorDisplay.textContent = `${_cursorSec.toFixed(3)} s`;
    }
    _analysisFlyout.render(_ui);
  }

  function setVisibleRange(start, end) {
    const range = constrainVisibleRange(start, end, _duration, 'both', MIN_VISIBLE_RANGE_SEC);
    _rangeStart = range.start;
    _rangeEnd = range.end;
    _ui.rangeStartEl.value = _rangeStart.toFixed(4);
    _ui.rangeEndEl.value = _rangeEnd.toFixed(4);
    syncRangeSliders();
  }

  function focusOnTime(sec) {
    const range = computeFocusedRange(sec, _duration, FOCUS_WINDOW_SEC);
    setVisibleRange(range.start, range.end);
    _cursorSec = clamp(sec, _rangeStart, _rangeEnd);
    syncCursorUI();
    if (_svgEl) updateCursor(_svgEl, _cursorSec, _rangeStart, _rangeEnd);
  }

  function stepZoom(direction) {
    const range = computeSteppedZoomRange(
      _rangeStart, _rangeEnd, _duration, direction, ZOOM_STEP_FRACTION, MIN_VISIBLE_RANGE_SEC,
    );
    setVisibleRange(range.start, range.end);
  }

  // ── Onset UI ────────────────────────────────────────────────────────────────

  function updateOnsetUI() {
    if (!_ui.removeOnsetBtn) return;
    const hasSelection = _selectedOnsetIndex >= 0 && _selectedOnsetIndex < _onsetsMs.length;
    _ui.removeOnsetBtn.disabled = !hasSelection;
    renderOnsetList(_ui.onsetList, _onsetsMs, _selectedOnsetIndex, _ui.autoBpmValue);
    if (_svgEl) updateOnsetMarkers(_svgEl, _onsetsMs, _rangeStart, _rangeEnd, _selectedOnsetIndex);
    _analysisFlyout.render(_ui);
  }

  function removeOnsetAt(index, selectNeighbor = false) {
    if (index < 0 || index >= _onsetsMs.length) return;
    _onsetsMs = removeOnset(_onsetsMs, index);
    if (selectNeighbor && _onsetsMs.length > 0) {
      _selectedOnsetIndex = Math.min(index, _onsetsMs.length - 1);
      const selectedMs = _onsetsMs[_selectedOnsetIndex];
      if (Number.isFinite(selectedMs)) {
        _cursorSec = clamp(selectedMs / 1000, _rangeStart, _rangeEnd);
        syncCursorUI();
      }
    } else if (_selectedOnsetIndex === index) {
      _selectedOnsetIndex = -1;
    } else if (_selectedOnsetIndex > index) {
      _selectedOnsetIndex--;
    }
    updateOnsetUI();
    schedulePersist();
  }

  function redrawWaveform() {
    if (!_samples) return;
    _svgEl = renderWaveform(
      _ui.waveformWrap, _samples, _sampleRate, _rangeStart, _rangeEnd,
      { onsetsMs: _onsetsMs, cursorSec: _cursorSec, selectedOnsetIndex: _selectedOnsetIndex }
    );
  }

  // ── Playback ────────────────────────────────────────────────────────────────

  function buildAudioBuffer() {
    const ctx = _transport.getCtx();
    const buf = ctx.createBuffer(1, _samples.length, _sampleRate);
    buf.copyToChannel(_samples, 0);
    return buf;
  }

  function startPlayback(offset) {
    const audioBuf = buildAudioBuffer();
    _transport.start(audioBuf, {
      offset,
      loopStart: _rangeStart,
      loopEnd: _rangeEnd,
      playbackRate: _playbackRate,
      onTick: (pos) => {
        if (_svgEl) updatePlayhead(_svgEl, pos, _rangeStart, _rangeEnd);
        _analysisFlyout.setPlayheadSec(pos);
      },
    });
    if (_ui.playBtn) _ui.playBtn.textContent = '⏸ Pause';
  }

  function stopPlayback(reset = false) {
    if (reset) {
      const pos = _transport.getOffset();
      _transport.stop();
      if (_svgEl) updatePlayhead(_svgEl, null, _rangeStart, _rangeEnd);
      _analysisFlyout.resetPlayhead();
      void pos; // offset already reset by transport.stop()
    } else {
      _transport.pause();
      const pos = _transport.getOffset();
      if (_svgEl) updatePlayhead(_svgEl, pos, _rangeStart, _rangeEnd);
      _analysisFlyout.setPlayheadSec(pos);
    }
    if (_ui.playBtn) _ui.playBtn.textContent = '▶ Play';
  }

  // ── Strategy buttons ────────────────────────────────────────────────────────

  function renderStrategyButtons(ui, afterRefresh = false) {
    if (!ui.strategyList) return;
    ui.strategyList.innerHTML = '';
    for (const strategy of getGuitarOnsetStrategies()) {
      const btn = document.createElement('button');
      btn.className = 'tagger-strategy-btn';
      btn.type = 'button';
      btn.dataset.strategyKey = strategy.key;
      btn.title = strategy.description;
      btn.textContent = strategy.label.replace(/^Guitar Onset Detector \((.*)\)$/, '$1');
      ui.strategyList.appendChild(btn);
    }
    if (!afterRefresh) loadGuitarOnsetStrategiesFromRegistry().then(() => renderStrategyButtons(ui, true));
  }

  // ── Export / analyser ───────────────────────────────────────────────────────

  function handleExport() {
    if (!_wavArrayBuffer) return;
    const sidecar   = _persistence.getCurrentSidecar(_ui);
    const jsonBytes = new TextEncoder().encode(JSON.stringify(sidecar, null, 2));
    const base      = normalizeRecordingBaseName(_fileBaseName, 'recording');
    downloadBlob(buildRecordingZip(base, new Uint8Array(_wavArrayBuffer), jsonBytes), `${base}-tagged.zip`, 'application/zip');
  }

  async function handleOpenAnalyser() {
    if (!_wavArrayBuffer || !_samples) return;
    _persistence.setSaveStatus(_ui, 'Speichert ...');
    try {
      const saved = await _persistence.persist(_ui);
      if (!saved) return;
      _persistence.setSaveStatus(_ui, 'Gespeichert');
      window.location.href =
        `../audio-analyse/index.html?source=${encodeURIComponent(saved.source)}&id=${encodeURIComponent(saved.id)}`;
    } catch {
      _persistence.setSaveStatus(_ui, 'Speichern fehlgeschlagen');
    }
  }

  // ── File loading ────────────────────────────────────────────────────────────

  async function applyWavBuffer(arrayBuffer, filename) {
    _wavArrayBuffer = arrayBuffer;
    _wavFilename    = filename;
    setBaseName(filename);
    if (_ui.wavLabel) _ui.wavLabel.textContent = filename + ' ✓';
    try {
      const decoded = await _transport.getCtx().decodeAudioData(_wavArrayBuffer.slice(0));
      _samples    = decoded.getChannelData(0);
      _sampleRate = decoded.sampleRate;
      _duration   = decoded.duration;
      _debugStore.addEntry('audio:decoded', {
        sampleRate: _sampleRate, duration: _duration, length: decoded.length, filename,
      }, { source: 'onsetTagger' });

      _transport.stop();
      _transport.setOffset(0);
      _rangeStart = 0;
      _rangeEnd   = _duration;
      _cursorSec  = 0;
      _onsetsMs   = [];
      _selectedOnsetIndex = -1;
      _analysisFlyout.resetPlayhead();

      _ui.rangeStartEl.step  = '0.001';
      _ui.rangeEndEl.step    = '0.001';
      syncRangeSliderBounds();
      _ui.cursorEl.min   = 0;
      _ui.cursorEl.max   = Math.round(_duration * 1000);
      _ui.cursorEl.value = 0;
      if (_ui.rangeDisplay) _ui.rangeDisplay.textContent = `0.00 s – ${_duration.toFixed(2)} s`;
      if (_ui.cursorDisplay) _ui.cursorDisplay.textContent = '0.000 s';

      _ui.step1.classList.remove('tagger-section--disabled');
      redrawWaveform();
      updateOnsetUI();
      enableStep2();
      void _analysisFlyout.run(_ui);
    } catch (err) {
      if (_ui.wavLabel) _ui.wavLabel.textContent = `Fehler: ${err.message}`;
      _analysisFlyout.setStatus(_ui, `Analyse-Fehler: ${err.message}`, true);
    }
  }

  function applySidecarData(sidecarObj, filename) {
    const normalized = normalizeSidecarFormat(sidecarObj);
    _sidecarData     = normalized;
    _sidecarFilename = filename;
    // Only adopt sidecar id if no storage-bound id is set yet
    if (!_recordingId && normalized.id) _recordingId = normalized.id;
    if (_ui.jsonLabel) _ui.jsonLabel.textContent = filename + ' ✓';
    if (Array.isArray(normalized.onsetsMs)) {
      _onsetsMs = normalized.onsetsMs.slice();
      _selectedOnsetIndex = -1;
      if (_svgEl) updateOnsetMarkers(_svgEl, _onsetsMs, _rangeStart, _rangeEnd, _selectedOnsetIndex);
      updateOnsetUI();
    }
    renderMetaForm(_ui, { ...DEFAULT_SIDECAR_FIELDS, ...normalized }, _fileBaseName);
    enableStep2();
    // Only start analysis when audio is already decoded
    if (_samples) void _analysisFlyout.run(_ui);
    schedulePersist();
  }

  function loadWav(file) {
    const reader = new FileReader();
    reader.onload = async (e) => {
      _recordingSource = '';
      _recordingId = '';
      await applyWavBuffer(e.target.result, file.name);
    };
    reader.readAsArrayBuffer(file);
  }

  function loadJson(file) {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        applySidecarData(JSON.parse(e.target.result), file.name);
      } catch (err) {
        if (_ui.jsonLabel) _ui.jsonLabel.textContent = `Fehler: ${err.message}`;
      }
    };
    reader.readAsText(file);
  }

  async function loadZip(file) {
    _recordingSource = '';
    _recordingId = '';
    const result = await readRecordingZip(file);
    if (!result) {
      if (_ui.zipLabel) _ui.zipLabel.textContent = 'Keine WAV-Datei in ZIP';
      return;
    }
    if (_ui.zipLabel) _ui.zipLabel.textContent = file.name + ' ✓';
    await applyWavBuffer(result.wavBuffer, result.wavName);
    if (result.sidecar) applySidecarData(result.sidecar, result.wavName.replace(/\.wav$/i, '.json'));
  }

  function enableStep2() {
    if (!_samples) return;
    _ui.step2.classList.remove('tagger-section--disabled');
    if (!_sidecarData) renderMetaForm(_ui, DEFAULT_SIDECAR_FIELDS, _fileBaseName);
  }

  // ── Mount / unmount ─────────────────────────────────────────────────────────

  function mount(root = document) {
    _root = root;
    _ui = resolveUI();

    wireOnsetTaggerEvents(_ui, {
      getSamples:            () => _samples,
      getSampleRate:         () => _sampleRate,
      getDuration:           () => _duration,
      getOnsetsMs:           () => _onsetsMs,
      setOnsetsMs:           (v) => { _onsetsMs = v; },
      getSelectedOnsetIndex: () => _selectedOnsetIndex,
      setSelectedOnsetIndex: (v) => { _selectedOnsetIndex = v; },
      getRangeStart:  () => _rangeStart,
      setRangeStart:  (v) => { _rangeStart = v; },
      getRangeEnd:    () => _rangeEnd,
      setRangeEnd:    (v) => { _rangeEnd = v; },
      getCursorSec:   () => _cursorSec,
      setCursorSec:   (v) => { _cursorSec = v; },
      getPlayOffset:  () => _transport.getOffset(),
      setPlayOffset:  (v) => _transport.setOffset(v),
      getPlaybackRate: () => _playbackRate,
      setPlaybackRate: (v) => {
        _transport.setRate(v);
        _playbackRate = v;
      },
      getFileBaseName:    () => _fileBaseName,
      setFileBaseName:    (v) => { _fileBaseName = v; },
      setWavFilename:     (v) => { _wavFilename = v; },
      setSidecarFilename: (v) => { _sidecarFilename = v; },
      isPlaying: () => _transport.isPlaying(),
      getSvgEl:  () => _svgEl,
      loadWav, loadJson, loadZip,
      syncRangeSliders, syncCursorUI,
      setVisibleRange, focusOnTime, stepZoom,
      updateOnsetUI, removeOnsetAt,
      schedulePersist,
      handleExport, handleOpenAnalyser,
      startPlayback, stopPlayback,
      setBaseName,
      computeAndSetBaseName,
      renderStrategyButtons,
      wireAnalysisFlyout: (ui) => _analysisFlyout.wire(ui),
      computePos: () => _transport.getPosition(),
    });

    const params = new URLSearchParams(window.location.search);
    const source = params.get('source');
    const id     = params.get('id') ?? '';
    if (source) {
      loadRecordingFromSource(source, id).then(entry => {
        if (!entry) return;
        _recordingSource = source;
        _recordingId = entry.id ?? id;
        const baseName = resolveRecordingFileBaseName(source, id, entry);
        const filename = `${baseName}.wav`;
        const sidecarFilename = `${baseName}.json`;
        applyWavBuffer(entry.wav.buffer, filename).then(() => {
          if (entry.manifest) applySidecarData(entry.manifest, sidecarFilename);
        });
      }).catch(() => {});
    }
  }

  function unmount() {
    _transport.close();
    _root = null;
    _ui = null;
  }

  return { mount, unmount };
}
