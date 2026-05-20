import {
  clamp,
  addOnsetWithIndex,
  computeRangeSliderState,
  computeFocusedRange,
  computeSteppedZoomRange,
  constrainVisibleRange,
  removeOnset,
  mergeOnsetsWithMinDistance,
  moveOnset,
  computePlayheadPosition,
  normalizeRecordingBaseName,
  resolveRecordingFileBaseName,
} from './onsetTaggerLogic.js';
import { loadRecordingFromSource } from '../../shared/recordingLoader.js';
import { detectOnsetsOffline } from '../../shared/audio/offlineOnsetDetection.js';
import { getGuitarOnsetStrategies } from '../../shared/audio/guitarOnsetStrategies.js';
import { createGlobalDebugStore } from '../../shared/debug/index.js';
import { closeLoadMenu, wireLoadMenu } from './onsetTaggerLoadMenu.js';
import { createOnsetTaggerPersistenceController } from './onsetTaggerPersistence.js';
import { createOnsetTaggerAnalysisFlyout } from './onsetTaggerAnalysisFlyout.js';

import {
  clientXToTime,
  renderWaveform,
  updatePlayhead,
  updateCursor,
  updateOnsetMarkers,
} from './onsetTaggerWaveform.js';

import { buildRecordingZip, readZip, downloadBlob } from '../../shared/zip.js';
import {
  DEFAULT_SIDECAR_FIELDS,
  renderMetaForm,
} from './onsetTaggerMetaForm.js';

const STRATEGY_IMPORT_MIN_DISTANCE_MS = 50;
const FOCUS_WINDOW_SEC = 0.6;
const MIN_VISIBLE_RANGE_SEC = 0.01;
const ZOOM_STEP_FRACTION = 0.1;

export function createOnsetTaggerFeature() {
  const _debugStore = createGlobalDebugStore();
  let _samples       = null;   // Float32Array
  let _sampleRate    = 44100;
  let _duration      = 0;      // seconds
  let _wavArrayBuffer = null;  // original for ZIP export
  let _wavFilename   = '';
  let _fileBaseName  = 'recording';

  let _sidecarData   = null;   // parsed JSON object
  let _sidecarFilename = '';
  let _recordingSource = '';
  let _recordingId = '';

  let _rangeStart    = 0;
  let _rangeEnd      = 0;
  let _cursorSec     = 0;
  let _onsetsMs      = [];
  let _selectedOnsetIndex = -1;

  let _audioCtx      = null;
  let _audioBuffer   = null;
  let _sourceNode    = null;
  let _playStartTime = 0;
  let _playOffset    = 0;      // seconds, position within buffer at last play/pause
  let _isPlaying     = false;
  let _playbackRate  = 1.0;
  let _rafId         = null;

  let _root = null;
  let _svgEl = null;
  const _analysisFlyout = createOnsetTaggerAnalysisFlyout({
    getSamples: () => _samples,
    getSampleRate: () => _sampleRate,
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
      setBaseName(resolveUI(), saved.baseName);
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
      zoomInBtn:      q('tagger-zoom-in'),
      zoomOutBtn:     q('tagger-zoom-out'),
      strategyList:   q('tagger-strategy-list'),
      strategyStatus: q('tagger-strategy-status'),
      playBtn:       q('tagger-play'),
      stopBtn:       q('tagger-stop'),
      speedBtns:     _root.querySelectorAll('[data-speed]'),
      onsetList:     q('tagger-onset-list'),
      metaForm:      q('tagger-meta-form'),
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
    };
  }

  function setBaseName(ui, value) {
    _fileBaseName = normalizeRecordingBaseName(value, _fileBaseName || 'recording');
    _wavFilename = `${_fileBaseName}.wav`;
    _sidecarFilename = `${_fileBaseName}.json`;
    if (ui.filenameInput && ui.filenameInput.value !== _fileBaseName) {
      ui.filenameInput.value = _fileBaseName;
    }
  }

  function schedulePersist(ui) {
    _persistence.schedule(ui);
  }

  function syncRangeSliderBounds(ui) {
    const sliderState = computeRangeSliderState(_rangeStart, _rangeEnd, _duration);
    ui.rangeStartEl.min = sliderState.start.min.toFixed(4);
    ui.rangeStartEl.max = sliderState.start.max.toFixed(4);
    ui.rangeStartEl.value = sliderState.start.value.toFixed(4);
    ui.rangeEndEl.min = sliderState.end.min.toFixed(4);
    ui.rangeEndEl.max = sliderState.end.max.toFixed(4);
    ui.rangeEndEl.value = sliderState.end.value.toFixed(4);
  }

  function syncRangeSliders(ui, changedEdge = 'both') {
    const range = constrainVisibleRange(
      parseFloat(ui.rangeStartEl.value),
      parseFloat(ui.rangeEndEl.value),
      _duration,
      changedEdge,
      MIN_VISIBLE_RANGE_SEC,
    );
    _rangeStart = range.start;
    _rangeEnd = range.end;
    syncRangeSliderBounds(ui);

    if (ui.rangeDisplay) {
      ui.rangeDisplay.textContent = `${_rangeStart.toFixed(2)} s – ${_rangeEnd.toFixed(2)} s`;
    }

    _cursorSec = clamp(_cursorSec, _rangeStart, _rangeEnd);
    ui.cursorEl.min   = 0;
    ui.cursorEl.max   = Math.round((_rangeEnd - _rangeStart) * 1000);
    ui.cursorEl.value = Math.round((_cursorSec - _rangeStart) * 1000);
    if (ui.cursorDisplay) {
      ui.cursorDisplay.textContent = `${_cursorSec.toFixed(3)} s`;
    }

    redrawWaveform(ui);
    _analysisFlyout.render(ui);
  }

  function syncCursorUI(ui) {
    _cursorSec = clamp(_cursorSec, _rangeStart, _rangeEnd);
    ui.cursorEl.min = 0;
    ui.cursorEl.max = Math.round((_rangeEnd - _rangeStart) * 1000);
    ui.cursorEl.value = Math.round((_cursorSec - _rangeStart) * 1000);
    if (ui.cursorDisplay) {
      ui.cursorDisplay.textContent = `${_cursorSec.toFixed(3)} s`;
    }
    _analysisFlyout.render(ui);
  }

  function setVisibleRange(ui, start, end) {
    const range = constrainVisibleRange(start, end, _duration, 'both', MIN_VISIBLE_RANGE_SEC);
    _rangeStart = range.start;
    _rangeEnd = range.end;
    ui.rangeStartEl.value = _rangeStart.toFixed(4);
    ui.rangeEndEl.value = _rangeEnd.toFixed(4);
    syncRangeSliders(ui);
  }

  function focusOnTime(ui, sec) {
    const range = computeFocusedRange(sec, _duration, FOCUS_WINDOW_SEC);
    setVisibleRange(ui, range.start, range.end);
    _cursorSec = clamp(sec, _rangeStart, _rangeEnd);
    syncCursorUI(ui);
    if (_svgEl) updateCursor(_svgEl, _cursorSec, _rangeStart, _rangeEnd);
  }

  function stepZoom(ui, direction) {
    const range = computeSteppedZoomRange(
      _rangeStart,
      _rangeEnd,
      _duration,
      direction,
      ZOOM_STEP_FRACTION,
      MIN_VISIBLE_RANGE_SEC,
    );
    setVisibleRange(ui, range.start, range.end);
  }

  function updateOnsetUI(ui) {
    renderOnsetList(ui);
    if (_svgEl) {
      updateOnsetMarkers(_svgEl, _onsetsMs, _rangeStart, _rangeEnd, _selectedOnsetIndex);
    }
    _analysisFlyout.render(ui);
  }

  function redrawWaveform(ui) {
    if (!_samples) return;
    _svgEl = renderWaveform(
      ui.waveformWrap, _samples, _sampleRate, _rangeStart, _rangeEnd,
      { onsetsMs: _onsetsMs, cursorSec: _cursorSec, selectedOnsetIndex: _selectedOnsetIndex }
    );
  }

  function getOrCreateAudioCtx() {
    if (!_audioCtx || _audioCtx.state === 'closed') {
      _audioCtx = new AudioContext();
    }
    return _audioCtx;
  }

  function buildAudioBuffer(ctx) {
    if (_audioBuffer) return _audioBuffer;
    const buf = ctx.createBuffer(1, _samples.length, _sampleRate);
    buf.copyToChannel(_samples, 0);
    _audioBuffer = buf;
    return buf;
  }

  function startPlayback(ui, offset) {
    const ctx = getOrCreateAudioCtx();
    if (ctx.state === 'suspended') ctx.resume();

    const buf = buildAudioBuffer(ctx);
    _sourceNode = ctx.createBufferSource();
    _sourceNode.buffer = buf;
    _sourceNode.loop = true;
    _sourceNode.loopStart = _rangeStart;
    _sourceNode.loopEnd   = _rangeEnd;
    _sourceNode.playbackRate.value = _playbackRate;
    _sourceNode.connect(ctx.destination);
    _sourceNode.start(0, offset);

    _playStartTime = ctx.currentTime;
    _playOffset    = offset;
    _isPlaying     = true;
    setPlayLabel(ui, true);
    startRAF();
  }

  function stopPlayback(ui, reset = false) {
    cancelRAF();
    if (_sourceNode) {
      try { _sourceNode.stop(); } catch { /* already stopped */ }
      _sourceNode = null;
    }
    if (_isPlaying && _audioCtx) {
      const elapsed = (_audioCtx.currentTime - _playStartTime) * _playbackRate;
      const loopLen = _rangeEnd - _rangeStart;
      _playOffset = loopLen > 0
        ? _rangeStart + ((_playOffset - _rangeStart + elapsed) % loopLen)
        : _rangeStart;
    }
    _isPlaying = false;
    setPlayLabel(ui, false);
    if (reset) {
      _playOffset = _rangeStart;
      if (_svgEl) updatePlayhead(_svgEl, null, _rangeStart, _rangeEnd);
    } else {
      if (_svgEl) updatePlayhead(_svgEl, _playOffset, _rangeStart, _rangeEnd);
    }
  }

  function setPlayLabel(ui, playing) {
    if (ui.playBtn) ui.playBtn.textContent = playing ? '⏸ Pause' : '▶ Play';
  }

  function startRAF() {
    cancelRAF();
    function tick() {
      if (!_isPlaying || !_audioCtx || !_svgEl) return;
      const pos = computePlayheadPosition(
        _playStartTime, _audioCtx.currentTime, _playbackRate,
        _rangeStart, _rangeEnd, _playOffset
      );
      updatePlayhead(_svgEl, pos, _rangeStart, _rangeEnd);
      _rafId = requestAnimationFrame(tick);
    }
    _rafId = requestAnimationFrame(tick);
  }

  function cancelRAF() {
    if (_rafId !== null) { cancelAnimationFrame(_rafId); _rafId = null; }
  }

  function renderOnsetList(ui) {
    if (!ui.onsetList) return;
    ui.onsetList.innerHTML = '';
    if (_onsetsMs.length === 0) {
      const empty = document.createElement('li');
      empty.className = 'tagger-onset-empty';
      empty.textContent = 'Noch keine Onsets markiert.';
      ui.onsetList.appendChild(empty);
      return;
    }
    _onsetsMs.forEach((ms, i) => {
      const li = document.createElement('li');
      li.className = i === _selectedOnsetIndex
        ? 'tagger-onset-item tagger-onset-item--selected'
        : 'tagger-onset-item';
      const selectBtn = document.createElement('button');
      selectBtn.className = 'tagger-onset-select';
      selectBtn.type = 'button';
      selectBtn.setAttribute('data-select-index', i);
      selectBtn.setAttribute('aria-pressed', i === _selectedOnsetIndex ? 'true' : 'false');
      selectBtn.textContent = `${i + 1}`;
      const btn = document.createElement('button');
      btn.className = 'tagger-onset-remove';
      btn.setAttribute('data-index', i);
      btn.setAttribute('aria-label', `Onset ${ms} ms entfernen`);
      btn.textContent = '✕';
      li.appendChild(selectBtn);
      li.appendChild(btn);
      ui.onsetList.appendChild(li);
    });
  }

  function renderStrategyButtons(ui) {
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
  }

  function setStrategyStatus(ui, text) {
    if (ui.strategyStatus) ui.strategyStatus.textContent = text;
  }

  function handleExport(ui) {
    if (!_wavArrayBuffer) return;
    const sidecar    = _persistence.getCurrentSidecar(ui);
    const jsonBytes  = new TextEncoder().encode(JSON.stringify(sidecar, null, 2));
    const base       = normalizeRecordingBaseName(_fileBaseName, 'recording');
    downloadBlob(buildRecordingZip(base, new Uint8Array(_wavArrayBuffer), jsonBytes), `${base}-tagged.zip`, 'application/zip');
  }

  async function handleOpenAnalyser(ui) {
    if (!_wavArrayBuffer || !_samples) return;
    _persistence.setSaveStatus(ui, 'Speichert ...');
    try {
      const saved = await _persistence.persist(ui);
      if (!saved) return;
      _persistence.setSaveStatus(ui, 'Gespeichert');
      window.location.href =
        `../audio-analyse/index.html?source=${encodeURIComponent(saved.source)}&id=${encodeURIComponent(saved.id)}`;
    } catch {
      _persistence.setSaveStatus(ui, 'Speichern fehlgeschlagen');
    }
  }

  async function applyWavBuffer(arrayBuffer, filename, ui) {
    _wavArrayBuffer = arrayBuffer;
    _wavFilename    = filename;
    setBaseName(ui, filename);
    if (ui.wavLabel) ui.wavLabel.textContent = filename + ' ✓';
    try {
      const ctx = getOrCreateAudioCtx();
      const decoded = await ctx.decodeAudioData(_wavArrayBuffer.slice(0));
      _samples    = decoded.getChannelData(0);
      _sampleRate = decoded.sampleRate;
      _duration   = decoded.duration;
      _audioBuffer = null;
      _debugStore.addEntry('audio:decoded', {
        sampleRate: _sampleRate,
        duration: _duration,
        length: decoded.length,
        filename,
      }, { source: 'onsetTagger' });

      _rangeStart = 0;
      _rangeEnd   = _duration;
      _cursorSec  = 0;
      _onsetsMs   = [];
      _selectedOnsetIndex = -1;

      ui.rangeStartEl.step  = '0.001';
      ui.rangeEndEl.step    = '0.001';
      syncRangeSliderBounds(ui);
      ui.cursorEl.min   = 0;
      ui.cursorEl.max   = Math.round(_duration * 1000);
      ui.cursorEl.value = 0;

      if (ui.rangeDisplay) {
        ui.rangeDisplay.textContent = `0.00 s – ${_duration.toFixed(2)} s`;
      }
      if (ui.cursorDisplay) {
        ui.cursorDisplay.textContent = '0.000 s';
      }

      ui.step1.classList.remove('tagger-section--disabled');
      redrawWaveform(ui);
      renderOnsetList(ui);
      enableStep2(ui);
      void _analysisFlyout.run(ui);
    } catch (err) {
      if (ui.wavLabel) ui.wavLabel.textContent = `Fehler: ${err.message}`;
      _analysisFlyout.setStatus(ui, `Analyse-Fehler: ${err.message}`, true);
    }
  }

  function applySidecarData(sidecarObj, filename, ui) {
    _sidecarData     = sidecarObj;
    _sidecarFilename = filename;
    if (ui.jsonLabel) ui.jsonLabel.textContent = filename + ' ✓';
    if (Array.isArray(_sidecarData.onsetsMs)) {
      _onsetsMs = _sidecarData.onsetsMs.slice();
      _selectedOnsetIndex = -1;
      if (_svgEl) updateOnsetMarkers(_svgEl, _onsetsMs, _rangeStart, _rangeEnd, _selectedOnsetIndex);
      renderOnsetList(ui);
    }
    renderMetaForm(ui, _sidecarData);
    enableStep2(ui);
    _analysisFlyout.render(ui);
    schedulePersist(ui);
  }

  function loadWav(file, ui) {
    const reader = new FileReader();
    reader.onload = async (e) => {
      _recordingSource = '';
      _recordingId = '';
      await applyWavBuffer(e.target.result, file.name, ui);
    };
    reader.readAsArrayBuffer(file);
  }

  function loadJson(file, ui) {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        applySidecarData(JSON.parse(e.target.result), file.name, ui);
      } catch (err) {
        if (ui.jsonLabel) ui.jsonLabel.textContent = `Fehler: ${err.message}`;
      }
    };
    reader.readAsText(file);
  }

  async function loadZip(file, ui) {
    _recordingSource = '';
    _recordingId = '';
    const buf     = await file.arrayBuffer();
    const entries = readZip(new Uint8Array(buf));
    const wavEntry  = entries.find(e => e.name.toLowerCase().endsWith('.wav'));
    const jsonEntry = entries.find(e => e.name.toLowerCase().endsWith('.json'));
    if (!wavEntry) {
      if (ui.zipLabel) ui.zipLabel.textContent = 'Keine WAV-Datei in ZIP';
      return;
    }
    if (ui.zipLabel) ui.zipLabel.textContent = file.name + ' ✓';
    await applyWavBuffer(wavEntry.data.buffer, wavEntry.name, ui);
    if (jsonEntry) {
      try {
        applySidecarData(JSON.parse(new TextDecoder().decode(jsonEntry.data)), jsonEntry.name, ui);
      } catch (err) {
        if (ui.jsonLabel) ui.jsonLabel.textContent = `Fehler: ${err.message}`;
      }
    }
  }

  function enableStep2(ui) {
    if (!_samples) return;
    ui.step2.classList.remove('tagger-section--disabled');
    if (!_sidecarData) {
      renderMetaForm(ui, DEFAULT_SIDECAR_FIELDS);
    }
  }

  function mount(root = document) {
    _root = root;
    const ui = resolveUI();
    renderStrategyButtons(ui);
    _analysisFlyout.wire(ui);

    wireLoadMenu(ui);

    if (ui.wavBtn && ui.wavInput) {
      ui.wavBtn.addEventListener('click', () => {
        closeLoadMenu(ui);
        ui.wavInput.click();
      });
    }
    if (ui.wavInput) {
      ui.wavInput.addEventListener('change', (e) => {
        const file = e.target.files?.[0];
        if (file) loadWav(file, ui);
      });
    }

    if (ui.jsonBtn && ui.jsonInput) {
      ui.jsonBtn.addEventListener('click', () => {
        closeLoadMenu(ui);
        ui.jsonInput.click();
      });
    }
    if (ui.jsonInput) {
      ui.jsonInput.addEventListener('change', (e) => {
        const file = e.target.files?.[0];
        if (file) loadJson(file, ui);
      });
    }

    if (ui.zipBtn && ui.zipInput) {
      ui.zipBtn.addEventListener('click', () => {
        closeLoadMenu(ui);
        ui.zipInput.click();
      });
    }
    if (ui.zipInput) {
      ui.zipInput.addEventListener('change', (e) => {
        const file = e.target.files?.[0];
        if (file) loadZip(file, ui);
      });
    }

    if (ui.rangeStartEl) {
      ui.rangeStartEl.addEventListener('input', () => syncRangeSliders(ui, 'start'));
    }
    if (ui.rangeEndEl) {
      ui.rangeEndEl.addEventListener('input', () => syncRangeSliders(ui, 'end'));
    }

    if (ui.cursorEl) {
      ui.cursorEl.addEventListener('input', () => {
        const relMs = parseFloat(ui.cursorEl.value);
        _cursorSec = clamp(_rangeStart + relMs / 1000, _rangeStart, _rangeEnd);
        if (_selectedOnsetIndex >= 0) {
          const ms = Math.round(_cursorSec * 1000);
          const moved = moveOnset(_onsetsMs, _selectedOnsetIndex, ms);
          _onsetsMs = moved.onsetsMs;
          _selectedOnsetIndex = moved.index;
          schedulePersist(ui);
        }
        if (ui.cursorDisplay) {
          ui.cursorDisplay.textContent = `${_cursorSec.toFixed(3)} s`;
        }
        if (_svgEl) updateCursor(_svgEl, _cursorSec, _rangeStart, _rangeEnd);
        updateOnsetUI(ui);
      });
    }

    if (ui.addOnsetBtn) {
      ui.addOnsetBtn.addEventListener('click', () => {
        const ms = Math.round(_cursorSec * 1000);
        const result = addOnsetWithIndex(_onsetsMs, ms);
        _onsetsMs = result.onsetsMs;
        _selectedOnsetIndex = result.index;
        updateOnsetUI(ui);
        schedulePersist(ui);
      });
    }
    if (ui.zoomInBtn) {
      ui.zoomInBtn.addEventListener('click', () => {
        if (_duration > 0) stepZoom(ui, 'in');
      });
    }
    if (ui.zoomOutBtn) {
      ui.zoomOutBtn.addEventListener('click', () => {
        if (_duration > 0) stepZoom(ui, 'out');
      });
    }

    if (ui.waveformWrap) {
      ui.waveformWrap.addEventListener('click', (e) => {
        if (!_svgEl || !_samples) return;
        const onsetMarker = e.target.closest?.('[data-onset-index]');
        if (onsetMarker) {
          const idx = parseInt(onsetMarker.dataset.onsetIndex, 10);
          const ms = _onsetsMs[idx];
          if (Number.isFinite(ms)) {
            _selectedOnsetIndex = idx;
            focusOnTime(ui, ms / 1000);
            updateOnsetUI(ui);
          }
          return;
        }
        const sec = clientXToTime(_svgEl, e.clientX, _rangeStart, _rangeEnd);
        _cursorSec = clamp(sec, _rangeStart, _rangeEnd);
        const result = addOnsetWithIndex(_onsetsMs, Math.round(_cursorSec * 1000));
        _onsetsMs = result.onsetsMs;
        _selectedOnsetIndex = result.index;
        syncCursorUI(ui);
        updateOnsetUI(ui);
        if (_svgEl) updateCursor(_svgEl, _cursorSec, _rangeStart, _rangeEnd);
        schedulePersist(ui);
      });
    }

    if (ui.onsetList) {
      ui.onsetList.addEventListener('click', (e) => {
        const removeBtn = e.target.closest('[data-index]');
        if (removeBtn) {
          const idx = parseInt(removeBtn.dataset.index, 10);
          _onsetsMs = removeOnset(_onsetsMs, idx);
          if (_selectedOnsetIndex === idx) {
            _selectedOnsetIndex = -1;
          } else if (_selectedOnsetIndex > idx) {
            _selectedOnsetIndex--;
          }
          updateOnsetUI(ui);
          schedulePersist(ui);
          return;
        }

        const selectBtn = e.target.closest('[data-select-index]');
        if (!selectBtn) return;
        _selectedOnsetIndex = parseInt(selectBtn.dataset.selectIndex, 10);
        const ms = _onsetsMs[_selectedOnsetIndex];
        if (!Number.isFinite(ms)) return;
        focusOnTime(ui, ms / 1000);
        updateOnsetUI(ui);
      });
    }

    if (ui.strategyList) {
      ui.strategyList.addEventListener('click', (e) => {
        const btn = e.target.closest('[data-strategy-key]');
        if (!btn || !_samples) return;
        const strategyKey = btn.dataset.strategyKey;
        setStrategyStatus(ui, 'Erkennung läuft ...');
        btn.disabled = true;
        detectOnsetsOffline(_samples, _sampleRate, { strategyKey })
          .then(result => {
            const merged = mergeOnsetsWithMinDistance(
              _onsetsMs,
              result.onsetsMs,
              STRATEGY_IMPORT_MIN_DISTANCE_MS,
            );
            _onsetsMs = merged.onsetsMs;
            _selectedOnsetIndex = -1;
            updateOnsetUI(ui);
            schedulePersist(ui);
            setStrategyStatus(ui, `${merged.added} hinzugefügt, ${merged.skipped} übersprungen.`);
          })
          .catch(err => setStrategyStatus(ui, `Fehler: ${err.message}`))
          .finally(() => { btn.disabled = false; });
      });
    }

    if (ui.playBtn) {
      ui.playBtn.addEventListener('click', () => {
        if (_isPlaying) {
          stopPlayback(ui, false);
        } else {
          if (!_samples) return;
          const offset = clamp(_playOffset, _rangeStart, _rangeEnd);
          startPlayback(ui, offset);
        }
      });
    }

    if (ui.stopBtn) {
      ui.stopBtn.addEventListener('click', () => {
        stopPlayback(ui, true);
        // Reset range view to full file
        if (_duration > 0) {
          _rangeStart = 0;
          _rangeEnd   = _duration;
          _playOffset = 0;
          ui.rangeStartEl.value = '0';
          ui.rangeEndEl.value   = _duration.toFixed(4);
          syncRangeSliders(ui, 'both');
        }
      });
    }

    ui.speedBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        ui.speedBtns.forEach(b => b.classList.remove('tagger-speed--active'));
        btn.classList.add('tagger-speed--active');
        _playbackRate = parseFloat(btn.dataset.speed);
        if (_isPlaying && _sourceNode) {
          _sourceNode.playbackRate.value = _playbackRate;
        }
      });
    });

    if (ui.exportBtn) {
      ui.exportBtn.addEventListener('click', () => handleExport(ui));
    }
    if (ui.exportTopBtn) {
      ui.exportTopBtn.addEventListener('click', () => handleExport(ui));
    }
    if (ui.openAnalyserBtn) {
      ui.openAnalyserBtn.addEventListener('click', () => void handleOpenAnalyser(ui));
    }
    if (ui.filenameInput) {
      ui.filenameInput.addEventListener('input', () => {
        _fileBaseName = normalizeRecordingBaseName(ui.filenameInput.value, _fileBaseName || 'recording');
        _wavFilename = `${_fileBaseName}.wav`;
        _sidecarFilename = `${_fileBaseName}.json`;
        schedulePersist(ui);
      });
      ui.filenameInput.addEventListener('change', () => {
        setBaseName(ui, ui.filenameInput.value);
        schedulePersist(ui);
      });
      ui.filenameInput.addEventListener('blur', () => setBaseName(ui, ui.filenameInput.value));
    }
    if (ui.metaForm) {
      ui.metaForm.addEventListener('change', () => schedulePersist(ui));
      ui.metaForm.addEventListener('input', (e) => {
        if (e.target?.tagName === 'TEXTAREA') schedulePersist(ui);
      });
    }

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
        applyWavBuffer(entry.wav.buffer, filename, ui).then(() => {
          if (entry.manifest) applySidecarData(entry.manifest, sidecarFilename, ui);
        });
      }).catch(() => {});
    }
  }

  function unmount() {
    cancelRAF();
    if (_sourceNode) {
      try { _sourceNode.stop(); } catch { /* ok */ }
      _sourceNode = null;
    }
    if (_audioCtx) {
      _audioCtx.close().catch(() => {});
      _audioCtx = null;
    }
    _root = null;
  }

  return { mount, unmount };
}
