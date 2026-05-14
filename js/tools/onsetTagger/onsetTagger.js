/**
 * onsetTagger.js
 *
 * Main controller for the Onset Tagger tool.
 * Factory pattern: export function createOnsetTaggerFeature()
 */

import {
  clamp,
  addOnset,
  removeOnset,
  buildSidecarWithOnsets,
  computePlayheadPosition,
} from './onsetTaggerLogic.js';
import { loadRecordingFromSource } from '../../shared/recordingLoader.js';

import {
  renderWaveform,
  updatePlayhead,
  updateCursor,
  updateOnsetMarkers,
} from './onsetTaggerWaveform.js';

import { buildZip, downloadBlob } from './onsetTaggerZip.js';

const DEFAULT_SIDECAR_FIELDS = {
  // Routing
  category:        '',
  chord:           '',
  chordKey:        '',
  // Sequence content
  notes:           [],
  timeSig:         '',
  bpm:             '',
  tempoBpm:        '',
  notesPerBeat:    '',
  description:     '',
  // Recording metadata
  recordedAt:      '',
  sampleRate:      '',
  durationSeconds: '',
  // Instrument / technique
  guitarSize:      '',
  guitarStrings:   '',
  volume:          '',
  technique:       '',
  strumMode:       '',
  repeatIndex:     '',
  // Browser environment (nested)
  browserEnvironment: {
    browser:          '',
    browserVersion:   '',
    os:               '',
    osVersion:        '',
    model:            '',
    language:         '',
    recorderMimeType: '',
    userAgent:        '',
  },
};

const DROPDOWN_OPTIONS = {
  category:      ['', 'sheet-music-reading', 'open-strings'],
  chord:         ['', 'A-Dur', 'A-Moll', 'A7', 'Am7', 'Amaj7',
                  'C-Dur', 'C-Dur (1-Finger)', 'C7', 'Cmaj7',
                  'D-Dur', 'D7', 'Dsus2', 'E-Dur', 'E-Moll', 'Em7', 'Esus4',
                  'G-Dur', 'G-Dur (1-Finger)', 'G-Moll'],
  timeSig:       ['', '2/4', '3/4', '4/4', '3/8', '6/8'],
  bpm:           ['', '40', '50', '52', '60', '70', '80', '90', '100', '110', '120', '150', '180'],
  tempoBpm:      ['', '40', '50', '52', '60', '70', '80', '90', '100', '110', '120', '150', '180'],
  notesPerBeat:  ['', '1', '2', '3', '4'],
  volume:        ['', 'laut', 'mittel', 'leise'],
  guitarSize:    ['', 'Vollgröße', 'Dreiviertel', 'Halbe'],
  guitarStrings: ['', 'Nylon', 'Stahl'],
  technique:     ['', 'finger', 'Plektrum'],
  strumMode:     ['', 'single', 'strum', 'pattern'],
  browser:       ['', 'Chrome', 'Firefox', 'Edge', 'Safari', 'Unknown'],
  os:            ['', 'Windows', 'macOS', 'iOS', 'Android', 'Linux', 'Unknown'],
};

const NUMERIC_DROPDOWN_KEYS = new Set(['bpm', 'tempoBpm', 'notesPerBeat']);

/**
 * @returns {{ mount(root: Element): void, unmount(): void }}
 */
export function createOnsetTaggerFeature() {
  // ── State ──────────────────────────────────────────────────────────────────
  let _samples       = null;   // Float32Array
  let _sampleRate    = 44100;
  let _duration      = 0;      // seconds
  let _wavArrayBuffer = null;  // original for ZIP export
  let _wavFilename   = '';

  let _sidecarData   = null;   // parsed JSON object
  let _sidecarFilename = '';

  let _rangeStart    = 0;
  let _rangeEnd      = 0;
  let _cursorSec     = 0;
  let _onsetsMs      = [];

  // Playback
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

  // ── UI helpers ─────────────────────────────────────────────────────────────

  function q(id) { return _root.querySelector(`#${id}`); }

  function resolveUI() {
    return {
      wavBtn:        q('tagger-wav-btn'),
      wavInput:      q('tagger-wav-input'),
      wavLabel:      q('tagger-wav-label'),
      jsonBtn:       q('tagger-json-btn'),
      jsonInput:     q('tagger-json-input'),
      jsonLabel:     q('tagger-json-label'),
      waveformWrap:  q('tagger-waveform-wrap'),
      step1:         q('tagger-step1'),
      step2:         q('tagger-step2'),
      rangeStartEl:  q('tagger-range-start'),
      rangeEndEl:    q('tagger-range-end'),
      rangeDisplay:  q('tagger-range-display'),
      cursorEl:      q('tagger-cursor'),
      cursorDisplay: q('tagger-cursor-display'),
      addOnsetBtn:   q('tagger-add-onset'),
      playBtn:       q('tagger-play'),
      stopBtn:       q('tagger-stop'),
      speedBtns:     _root.querySelectorAll('[data-speed]'),
      onsetList:     q('tagger-onset-list'),
      metaForm:      q('tagger-meta-form'),
      exportBtn:     q('tagger-export'),
    };
  }

  // ── Range slider sync ──────────────────────────────────────────────────────

  function syncRangeSliders(ui) {
    const start = parseFloat(ui.rangeStartEl.value);
    const end   = parseFloat(ui.rangeEndEl.value);
    // Prevent inversion: start must be < end
    if (start >= end) {
      if (document.activeElement === ui.rangeStartEl) {
        ui.rangeStartEl.value = Math.max(0, end - 0.01).toFixed(4);
      } else {
        ui.rangeEndEl.value = Math.min(_duration, start + 0.01).toFixed(4);
      }
    }
    _rangeStart = parseFloat(ui.rangeStartEl.value);
    _rangeEnd   = parseFloat(ui.rangeEndEl.value);

    if (ui.rangeDisplay) {
      ui.rangeDisplay.textContent = `${_rangeStart.toFixed(2)} s – ${_rangeEnd.toFixed(2)} s`;
    }

    // Clamp cursor to new range
    _cursorSec = clamp(_cursorSec, _rangeStart, _rangeEnd);
    ui.cursorEl.min   = 0;
    ui.cursorEl.max   = Math.round((_rangeEnd - _rangeStart) * 1000);
    ui.cursorEl.value = Math.round((_cursorSec - _rangeStart) * 1000);
    if (ui.cursorDisplay) {
      ui.cursorDisplay.textContent = `${_cursorSec.toFixed(3)} s`;
    }

    redrawWaveform(ui);
  }

  // ── Waveform ───────────────────────────────────────────────────────────────

  function redrawWaveform(ui) {
    if (!_samples) return;
    _svgEl = renderWaveform(
      ui.waveformWrap, _samples, _sampleRate, _rangeStart, _rangeEnd,
      { onsetsMs: _onsetsMs, cursorSec: _cursorSec }
    );
  }

  // ── Playback ───────────────────────────────────────────────────────────────

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

  // ── Onset list rendering ───────────────────────────────────────────────────

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
      li.className = 'tagger-onset-item';
      const span = document.createElement('span');
      span.textContent = `${i + 1}. ${ms} ms`;
      const btn = document.createElement('button');
      btn.className = 'tagger-onset-remove';
      btn.setAttribute('data-index', i);
      btn.setAttribute('aria-label', `Onset ${ms} ms entfernen`);
      btn.textContent = '✕';
      li.appendChild(span);
      li.appendChild(btn);
      ui.onsetList.appendChild(li);
    });
  }

  // ── Metadata editor ────────────────────────────────────────────────────────

  function renderMetaForm(ui, data) {
    if (!ui.metaForm) return;
    ui.metaForm.innerHTML = '';
    for (const [key, value] of Object.entries(data)) {
      if (key === 'onsetsMs') continue;
      if (key === 'browserEnvironment' && value && typeof value === 'object' && !Array.isArray(value)) {
        const heading = document.createElement('p');
        heading.className = 'tagger-meta-section-heading';
        heading.textContent = 'Browser / Aufnahme';
        ui.metaForm.appendChild(heading);
        for (const [subKey, subValue] of Object.entries(value)) {
          const row = buildMetaRow(`be-${subKey}`, subKey, subValue, 'browserEnvironment');
          ui.metaForm.appendChild(row);
        }
        continue;
      }
      ui.metaForm.appendChild(buildMetaRow(key, key, value, null));
    }
  }

  function buildMetaRow(id, labelText, value, parentKey) {
    const row = document.createElement('div');
    row.className = parentKey ? 'tagger-meta-row tagger-meta-row--nested' : 'tagger-meta-row';
    const label = document.createElement('label');
    label.className = 'tagger-meta-label';
    label.textContent = labelText;
    label.htmlFor = `meta-${id}`;
    const inputEl = buildMetaInput(id, labelText, value, parentKey);
    inputEl.id = `meta-${id}`;
    row.appendChild(label);
    row.appendChild(inputEl);
    return row;
  }

  function buildMetaInput(id, key, value, parentKey) {
    const lookupKey = key;

    if (lookupKey in DROPDOWN_OPTIONS) {
      const sel = document.createElement('select');
      sel.name = id;
      if (parentKey) sel.dataset.parent = parentKey;
      sel.className = 'tagger-meta-input tagger-meta-select';
      const strVal = (value === null || value === undefined) ? '' : String(value);
      const opts = DROPDOWN_OPTIONS[lookupKey];
      const allOpts = (strVal && !opts.includes(strVal)) ? [...opts, strVal] : opts;
      for (const opt of allOpts) {
        const o = document.createElement('option');
        o.value = opt;
        o.textContent = opt === '' ? '—' : opt;
        if (opt === strVal) o.selected = true;
        sel.appendChild(o);
      }
      return sel;
    }

    if (typeof value === 'boolean') {
      const el = document.createElement('input');
      el.type = 'checkbox';
      el.name = id;
      el.checked = value;
      if (parentKey) el.dataset.parent = parentKey;
      el.className = 'tagger-meta-input';
      return el;
    }

    if (typeof value === 'number') {
      const el = document.createElement('input');
      el.type = 'number';
      el.name = id;
      el.value = value;
      if (parentKey) el.dataset.parent = parentKey;
      el.className = 'tagger-meta-input';
      return el;
    }

    if (Array.isArray(value) && (value.length === 0 || value.every(v => typeof v === 'string'))) {
      const el = document.createElement('textarea');
      el.rows = 4;
      el.name = id;
      el.value = value.map(v => v.toLowerCase()).join(', ');
      el.dataset.fieldType = 'string-array';
      if (parentKey) el.dataset.parent = parentKey;
      el.className = 'tagger-meta-textarea tagger-meta-notes tagger-meta-input';
      return el;
    }

    if (typeof value === 'object' || Array.isArray(value)) {
      const el = document.createElement('textarea');
      el.rows = 3;
      el.name = id;
      el.value = JSON.stringify(value, null, 2);
      if (parentKey) el.dataset.parent = parentKey;
      el.className = 'tagger-meta-textarea tagger-meta-input';
      return el;
    }

    const el = document.createElement('input');
    el.type = 'text';
    el.name = id;
    el.value = String(value ?? '');
    if (parentKey) el.dataset.parent = parentKey;
    el.className = 'tagger-meta-input';
    return el;
  }

  function readInputValue(el) {
    if (el.type === 'checkbox') return el.checked;
    if (el.type === 'number') return el.value === '' ? '' : parseFloat(el.value);
    if (el.tagName === 'SELECT') {
      if (!el.value) return el.value;
      if (NUMERIC_DROPDOWN_KEYS.has(el.name)) return parseFloat(el.value);
      return el.value;
    }
    if (el.tagName === 'TEXTAREA') {
      if (el.dataset.fieldType === 'string-array') {
        return el.value.split(',').map(s => s.trim().toUpperCase()).filter(Boolean);
      }
      try { return JSON.parse(el.value); } catch { return el.value; }
    }
    return el.value;
  }

  function readMetaForm(ui) {
    if (!ui.metaForm) return {};
    const result = {};
    for (const el of ui.metaForm.querySelectorAll('[name]')) {
      const parent = el.dataset.parent;
      const val = readInputValue(el);
      if (parent) {
        if (!result[parent]) result[parent] = {};
        result[parent][el.name.replace(/^be-/, '')] = val;
      } else {
        result[el.name] = val;
      }
    }
    return result;
  }

  // ── ZIP export ─────────────────────────────────────────────────────────────

  function handleExport(ui) {
    if (!_wavArrayBuffer) return;

    const formValues = readMetaForm(ui);
    const sidecar    = buildSidecarWithOnsets(formValues, _onsetsMs);
    const jsonBytes  = new TextEncoder().encode(JSON.stringify(sidecar, null, 2));

    const wavName    = _wavFilename || 'recording.wav';
    const jsonName   = _sidecarFilename || wavName.replace(/\.wav$/i, '.json');

    const zipData = buildZip([
      { name: wavName,  data: new Uint8Array(_wavArrayBuffer) },
      { name: jsonName, data: jsonBytes },
    ]);

    const base = wavName.replace(/\.wav$/i, '');
    downloadBlob(zipData, `${base}-tagged.zip`, 'application/zip');
  }

  // ── File loading ───────────────────────────────────────────────────────────

  async function applyWavBuffer(arrayBuffer, filename, ui) {
    _wavArrayBuffer = arrayBuffer;
    _wavFilename    = filename;
    if (ui.wavLabel) ui.wavLabel.textContent = filename + ' ✓';
    try {
      const ctx = getOrCreateAudioCtx();
      const decoded = await ctx.decodeAudioData(_wavArrayBuffer.slice(0));
      _samples    = decoded.getChannelData(0);
      _sampleRate = decoded.sampleRate;
      _duration   = decoded.duration;
      _audioBuffer = null;

      _rangeStart = 0;
      _rangeEnd   = _duration;
      _cursorSec  = 0;
      _onsetsMs   = [];

      ui.rangeStartEl.min   = 0;
      ui.rangeStartEl.max   = _duration.toFixed(4);
      ui.rangeStartEl.step  = '0.001';
      ui.rangeStartEl.value = '0';
      ui.rangeEndEl.min     = 0;
      ui.rangeEndEl.max     = _duration.toFixed(4);
      ui.rangeEndEl.step    = '0.001';
      ui.rangeEndEl.value   = _duration.toFixed(4);
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
    } catch (err) {
      if (ui.wavLabel) ui.wavLabel.textContent = `Fehler: ${err.message}`;
    }
  }

  function applySidecarData(sidecarObj, filename, ui) {
    _sidecarData     = sidecarObj;
    _sidecarFilename = filename;
    if (ui.jsonLabel) ui.jsonLabel.textContent = filename + ' ✓';
    if (Array.isArray(_sidecarData.onsetsMs)) {
      _onsetsMs = _sidecarData.onsetsMs.slice();
      if (_svgEl) updateOnsetMarkers(_svgEl, _onsetsMs, _rangeStart, _rangeEnd);
      renderOnsetList(ui);
    }
    renderMetaForm(ui, _sidecarData);
    enableStep2(ui);
  }

  function loadWav(file, ui) {
    const reader = new FileReader();
    reader.onload = async (e) => applyWavBuffer(e.target.result, file.name, ui);
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

  function enableStep2(ui) {
    if (!_samples) return;
    ui.step2.classList.remove('tagger-section--disabled');
    if (!_sidecarData) {
      renderMetaForm(ui, DEFAULT_SIDECAR_FIELDS);
    }
  }

  // ── mount / unmount ────────────────────────────────────────────────────────

  function mount(root = document) {
    _root = root;
    const ui = resolveUI();

    // WAV file button
    if (ui.wavBtn && ui.wavInput) {
      ui.wavBtn.addEventListener('click', () => ui.wavInput.click());
    }
    if (ui.wavInput) {
      ui.wavInput.addEventListener('change', (e) => {
        const file = e.target.files?.[0];
        if (file) loadWav(file, ui);
      });
    }

    // JSON file button
    if (ui.jsonBtn && ui.jsonInput) {
      ui.jsonBtn.addEventListener('click', () => ui.jsonInput.click());
    }
    if (ui.jsonInput) {
      ui.jsonInput.addEventListener('change', (e) => {
        const file = e.target.files?.[0];
        if (file) loadJson(file, ui);
      });
    }

    // Range sliders
    if (ui.rangeStartEl) {
      ui.rangeStartEl.addEventListener('input', () => syncRangeSliders(ui));
    }
    if (ui.rangeEndEl) {
      ui.rangeEndEl.addEventListener('input', () => syncRangeSliders(ui));
    }

    // Onset cursor slider (value in ms relative to rangeStart)
    if (ui.cursorEl) {
      ui.cursorEl.addEventListener('input', () => {
        const relMs = parseFloat(ui.cursorEl.value);
        _cursorSec = clamp(_rangeStart + relMs / 1000, _rangeStart, _rangeEnd);
        if (ui.cursorDisplay) {
          ui.cursorDisplay.textContent = `${_cursorSec.toFixed(3)} s`;
        }
        if (_svgEl) updateCursor(_svgEl, _cursorSec, _rangeStart, _rangeEnd);
      });
    }

    // Add onset button
    if (ui.addOnsetBtn) {
      ui.addOnsetBtn.addEventListener('click', () => {
        const ms = Math.round(_cursorSec * 1000);
        _onsetsMs = addOnset(_onsetsMs, ms);
        renderOnsetList(ui);
        if (_svgEl) updateOnsetMarkers(_svgEl, _onsetsMs, _rangeStart, _rangeEnd);
      });
    }

    // Onset list remove buttons (delegated)
    if (ui.onsetList) {
      ui.onsetList.addEventListener('click', (e) => {
        const btn = e.target.closest('[data-index]');
        if (!btn) return;
        const idx = parseInt(btn.dataset.index, 10);
        _onsetsMs = removeOnset(_onsetsMs, idx);
        renderOnsetList(ui);
        if (_svgEl) updateOnsetMarkers(_svgEl, _onsetsMs, _rangeStart, _rangeEnd);
      });
    }

    // Play/Pause button
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

    // Stop button
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
          syncRangeSliders(ui);
        }
      });
    }

    // Speed buttons
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

    // Export button
    if (ui.exportBtn) {
      ui.exportBtn.addEventListener('click', () => handleExport(ui));
    }

    // Auto-load from recordings overview via URL params
    const params = new URLSearchParams(window.location.search);
    const source = params.get('source');
    const id     = params.get('id') ?? '';
    if (source) {
      loadRecordingFromSource(source, id).then(entry => {
        if (!entry) return;
        const filename       = source === 'chord-recorder' ? `${id}.wav` : 'notenlesen.wav';
        const sidecarFilename = source === 'chord-recorder' ? `${id}.json` : 'manifest.json';
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
