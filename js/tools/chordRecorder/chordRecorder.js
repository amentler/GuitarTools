import { CHORDS, CHORD_META } from '../../data/akkordData.js';
import { chordStringToFretboardIndex } from '../../domain/chords/chordFretboardMapping.js';
import { createStorageService } from '../../shared/storage/storageService.js';
import { buildVariationList } from './chordRecorderVariations.js';
import { runQualityGates } from './chordRecorderQuality.js';
import { createChordRecorderAudio, encodeWav } from './chordRecorderAudio.js';
import { createChordRecorderUI } from './chordRecorderUI.js';
import {
  generateRandom5,
  toChordKey,
  buildFileName,
  buildSidecarJson,
  addRecording,
  clearRecordings,
  getAllRecordings,
  getRecordingCount,
  downloadAllAsZip,
  removeRecordingByBaseName,
} from './chordRecorderFiles.js';

const STORAGE_PREFIX = 'chord-recorder-';
const ROOT_ORDER = ['A', 'C', 'D', 'E', 'F', 'G', 'H'];
const TYPE_ORDER = ['Dur', 'Moll', 'Dom7', 'Maj7', 'Min7', 'Dim', 'Sus', 'Add'];
const SINGLE_STRUM_MS = 4000;
const BEAT_MS = 750; // 80 BPM
const PRE_COUNTDOWN = [3, 2, 1];

const AUTO_ADVANCE_SEC = 5;

function getDurationMs(strumModus) {
  if (strumModus === 'multi1') return 4 * BEAT_MS;
  if (strumModus === 'multi2') return 8 * BEAT_MS;
  return SINGLE_STRUM_MS;
}

async function autoAdvanceOrWait(ui) {
  let paused = false;
  let t = AUTO_ADVANCE_SEC;
  while (t >= 1) {
    ui.setAutoCountdown(t, paused);
    const res = await Promise.race([
      paused ? new Promise(() => {}) : sleep(1000).then(() => 'tick'),
      ui.nextAction(),
    ]);
    if (res === 'tick') { t--; continue; }
    if (res === 'pause') { paused = !paused; continue; }
    ui.hideAutoCountdown();
    return res;
  }
  ui.hideAutoCountdown();
  return 'next';
}

const GUITAR_SIZES = ['Vollgröße', '7/8', '3/4', '1/2', '1/4', 'Unbekannt'];
const GUITAR_STRINGS = ['Nylon', 'Steel'];
const TECHNIKEN = [
  { value: 'finger',      label: 'Finger' },
  { value: 'fingernagel', label: 'Fingernagel' },
  { value: 'plektrum',    label: 'Plektrum' },
];
const STRUM_MODI = [
  { value: 'single', label: 'Single-Strum' },
  { value: 'multi1', label: 'Multi 1 Takt' },
  { value: 'multi2', label: 'Multi 2 Takte' },
];

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

function getSortedChordNames() {
  return Object.keys(CHORDS)
    .filter(name => CHORD_META[name])
    .sort((a, b) => {
      const ma = CHORD_META[a];
      const mb = CHORD_META[b];
      const rootDiff = ROOT_ORDER.indexOf(ma.rootNote) - ROOT_ORDER.indexOf(mb.rootNote);
      if (rootDiff !== 0) return rootDiff;
      return TYPE_ORDER.indexOf(ma.chordType) - TYPE_ORDER.indexOf(mb.chordType);
    });
}

export function createChordRecorderTool({
  storageService = createStorageService({ prefix: STORAGE_PREFIX }),
} = {}) {
  let root = null;
  let selectedChord = null;
  let currentView = 'record';
  let activePlayback = null;

  function getConfig() {
    return {
      guitarSize:    storageService.getString('guitarSize', { defaultValue: 'Vollgröße' }),
      guitarStrings: storageService.getString('guitarStrings', { defaultValue: 'Nylon' }),
      techniken: TECHNIKEN
        .map(t => t.value)
        .filter(v => storageService.getBoolean(`technik-${v}`, { defaultValue: v !== 'plektrum' })),
      strumModi: STRUM_MODI
        .map(m => m.value)
        .filter(v => storageService.getBoolean(`strumModus-${v}`, { defaultValue: v === 'single' })),
    };
  }

  function updateVariationCount() {
    const config = getConfig();
    const count = buildVariationList(config).length;
    const el = root?.querySelector('#cr-variation-count');
    if (el) el.textContent = `${count} Aufnahmen geplant`;
  }

  function updateStartButton() {
    const config = getConfig();
    const ready = selectedChord && config.techniken.length > 0 && config.strumModi.length > 0;
    root?.querySelectorAll('[data-start]').forEach(btn => btn.classList.toggle('u-hidden', !ready));
  }

  function renderChordGrid() {
    const container = root?.querySelector('#cr-chord-grid');
    if (!container) return;
    container.innerHTML = '';

    for (const chordName of getSortedChordNames()) {
      const positions = CHORDS[chordName];
      if (!positions) continue;

      const card = document.createElement('button');
      card.className = 'cr-chord-card';
      card.dataset.chord = chordName;
      card.type = 'button';
      card.setAttribute('aria-label', chordName);

      const nameEl = document.createElement('div');
      nameEl.className = 'cr-chord-name';
      nameEl.textContent = chordName;
      card.appendChild(nameEl);
      if (selectedChord === chordName) {
        card.classList.add('cr-chord-card--selected');
      }

      const fretboard = document.createElement('gt-fretboard');
      fretboard.setAttribute('frets', '5');
      fretboard.positions = positions.map(p => ({
        stringIndex: chordStringToFretboardIndex(p.string),
        fret: p.muted ? 0 : p.fret,
        state: p.muted ? 'muted' : 'selected',
        label: p.finger ? String(p.finger) : null,
      }));
      card.appendChild(fretboard);

      card.addEventListener('click', () => {
        container.querySelectorAll('.cr-chord-card').forEach(c => c.classList.remove('cr-chord-card--selected'));
        card.classList.add('cr-chord-card--selected');
        selectedChord = chordName;
        updateStartButton();
      });

      container.appendChild(card);
    }
  }

  function setView(viewName) {
    stopPlayback();
    currentView = viewName;
    renderCurrentView();
  }

  function stopPlayback() {
    if (!activePlayback) return;
    activePlayback.audio.pause();
    activePlayback.audio.currentTime = 0;
    URL.revokeObjectURL(activePlayback.url);
    activePlayback = null;
  }

  function formatTakeTimestamp(recordedAt) {
    const date = new Date(recordedAt);
    if (Number.isNaN(date.getTime())) return '';
    return date.toLocaleString('de-DE', {
      dateStyle: 'short',
      timeStyle: 'short',
    });
  }

  function formatTakeLabel(sidecar) {
    return [
      sidecar.technique,
      sidecar.volume,
      sidecar.strumMode,
      `Take ${sidecar.repeatIndex}/2`,
    ].join(' · ');
  }

  function getManageItemStatus(sidecar) {
    if (!sidecar?.quality?.passed) return 'Fehler';
    if (sidecar.quality.warnReasons?.length) return `Warnung: ${sidecar.quality.warnReasons.join(', ')}`;
    return 'OK';
  }

  function playRecording(baseName) {
    const recording = getAllRecordings().find(entry => entry.baseName === baseName);
    if (!recording) return;
    if (activePlayback?.baseName === baseName) {
      stopPlayback();
      renderCurrentView();
      return;
    }

    stopPlayback();
    const url = URL.createObjectURL(recording.wavBlob);
    const audio = new Audio(url);
    activePlayback = { baseName, audio, url };
    audio.addEventListener('ended', () => {
      stopPlayback();
      renderCurrentView();
    }, { once: true });
    void audio.play().catch(() => {
      stopPlayback();
      renderCurrentView();
    });
    renderCurrentView();
  }

  function deleteRecording(baseName) {
    if (activePlayback?.baseName === baseName) {
      stopPlayback();
    }
    removeRecordingByBaseName(baseName);
    renderCurrentView();
  }

  function clearAllRecordingsWithConfirm() {
    const count = getRecordingCount();
    if (count === 0) return;
    if (!confirm(`${count} Aufnahme${count !== 1 ? 'n' : ''} unwiderruflich löschen?`)) return;
    stopPlayback();
    clearRecordings();
    renderCurrentView();
  }

  function bindInstrumentControls() {
    const sizeSelect = root?.querySelector('#cr-guitar-size');
    const stringsSelect = root?.querySelector('#cr-guitar-strings');

    sizeSelect?.addEventListener('change', e => {
      storageService.set('guitarSize', e.target.value);
    });
    stringsSelect?.addEventListener('change', e => {
      storageService.set('guitarStrings', e.target.value);
    });

    if (sizeSelect) sizeSelect.value = storageService.getString('guitarSize', { defaultValue: 'Vollgröße' });
    if (stringsSelect) stringsSelect.value = storageService.getString('guitarStrings', { defaultValue: 'Nylon' });
  }

  function bindVariantControls() {
    root?.querySelectorAll('[data-technik]').forEach(cb => {
      const key = `technik-${cb.dataset.technik}`;
      cb.checked = storageService.getBoolean(key, { defaultValue: cb.dataset.technik !== 'plektrum' });
      cb.addEventListener('change', () => {
        storageService.set(key, String(cb.checked));
        updateVariationCount();
        updateStartButton();
      });
    });

    root?.querySelectorAll('[data-strum-modus]').forEach(cb => {
      const key = `strumModus-${cb.dataset.strumModus}`;
      cb.checked = storageService.getBoolean(key, { defaultValue: cb.dataset.strumModus === 'single' });
      cb.addEventListener('change', () => {
        storageService.set(key, String(cb.checked));
        updateVariationCount();
        updateStartButton();
      });
    });
  }

  function updateToolMenu() {
    const count = getRecordingCount();
    const downloadBtn = root?.querySelector('#cr-download-all');
    const manageBtn   = root?.querySelector('#cr-manage-recordings');
    const countEl     = root?.querySelector('#cr-rec-count');
    if (downloadBtn) downloadBtn.disabled = count === 0;
    if (manageBtn) manageBtn.disabled = false;
    if (countEl) {
      countEl.textContent = count === 0
        ? 'Keine Aufnahmen gespeichert'
        : `${count} Aufnahme${count !== 1 ? 'n' : ''} gespeichert`;
    }
  }

  function renderRecordView() {
    root.innerHTML = `
      <div class="chord-recorder">

        <div class="cr-tool-menu">
          <button id="cr-download-all" type="button" class="cr-btn cr-btn--tool" disabled>
            ⬇ Alles herunterladen
          </button>
          <button id="cr-manage-recordings" type="button" class="cr-btn cr-btn--tool">
            Verwaltung
          </button>
          <span id="cr-rec-count" class="cr-rec-count"></span>
        </div>

        <section class="cr-section">
          <h2 class="cr-section-title">① Instrument</h2>
          <div class="cr-instrument-row">
            <label class="cr-label">
              Größe
              <select id="cr-guitar-size" class="cr-select">
                ${GUITAR_SIZES.map(s => `<option value="${s}">${s}</option>`).join('')}
              </select>
            </label>
            <label class="cr-label">
              Saiten
              <select id="cr-guitar-strings" class="cr-select">
                ${GUITAR_STRINGS.map(s => `<option value="${s}">${s}</option>`).join('')}
              </select>
            </label>
          </div>
        </section>

        <section class="cr-section">
          <h2 class="cr-section-title">② Varianten</h2>
          <div class="cr-variant-row">
            <span class="cr-label">Technik</span>
            ${TECHNIKEN.map(t => `
              <label class="cr-checkbox-label">
                <input type="checkbox" data-technik="${t.value}" />
                ${t.label}
              </label>
            `).join('')}
          </div>
          <div class="cr-variant-row">
            <span class="cr-label">Strum-Modus</span>
            ${STRUM_MODI.map(m => `
              <label class="cr-checkbox-label">
                <input type="checkbox" data-strum-modus="${m.value}" />
                ${m.label}
              </label>
            `).join('')}
          </div>
          <p id="cr-variation-count" class="cr-variation-count"></p>
        </section>

        <section class="cr-section">
          <div class="cr-section-header">
            <h2 class="cr-section-title">③ Akkord wählen</h2>
            <button type="button" class="btn-start u-hidden" data-start>
              Aufnahme starten
            </button>
          </div>
          <div id="cr-chord-grid" class="cr-chord-grid"></div>
        </section>

        <div class="cr-start-container">
          <button type="button" class="btn-start u-hidden" data-start>
            Aufnahme starten
          </button>
        </div>

      </div>
    `;

    bindInstrumentControls();
    bindVariantControls();
    renderChordGrid();
    updateVariationCount();
    updateStartButton();
    updateToolMenu();

    root.querySelectorAll('[data-start]').forEach(btn => btn.addEventListener('click', startSession));

    root.querySelector('#cr-download-all')?.addEventListener('click', async () => {
      await downloadAllAsZip('chord-recordings');
    });

    root.querySelector('#cr-manage-recordings')?.addEventListener('click', () => setView('manage'));
  }

  function renderManageView() {
    const recordings = getAllRecordings().slice().reverse();
    const count = recordings.length;
    root.innerHTML = `
      <div class="chord-recorder">
        <div class="cr-tool-menu">
          <button id="cr-back-to-record" type="button" class="cr-btn cr-btn--tool">
            ← Zurück zur Aufnahme
          </button>
          <button id="cr-clear-all" type="button" class="cr-btn cr-btn--tool cr-btn--danger" ${count === 0 ? 'disabled' : ''}>
            🗑 Alle Aufnahmen löschen
          </button>
          <span id="cr-rec-count" class="cr-rec-count"></span>
        </div>

        <section class="cr-section">
          <h2 class="cr-section-title">Recording-Verwaltung</h2>
          ${count === 0 ? `
            <p class="cr-manage-copy">Noch keine Aufnahmen in dieser Session.</p>
          ` : `
            <div class="cr-manage-list">
              ${recordings.map(({ baseName, sidecar }) => `
                <article class="cr-manage-item" data-recording="${baseName}">
                  <div class="cr-manage-meta">
                    <strong class="cr-manage-title">${sidecar.chord}</strong>
                    <span class="cr-manage-subtitle">${formatTakeLabel(sidecar)}</span>
                    <span class="cr-manage-subtitle">${formatTakeTimestamp(sidecar.recordedAt)}</span>
                    <span class="cr-manage-subtitle">Status: ${getManageItemStatus(sidecar)}</span>
                  </div>
                  <div class="cr-manage-actions">
                    <button
                      type="button"
                      class="cr-btn cr-btn--tool"
                      data-play-recording="${baseName}"
                    >
                      ${activePlayback?.baseName === baseName ? 'Stoppen' : 'Anhören'}
                    </button>
                    <button
                      type="button"
                      class="cr-btn cr-btn--danger"
                      data-delete-recording="${baseName}"
                    >
                      Löschen
                    </button>
                  </div>
                </article>
              `).join('')}
            </div>
          `}
        </section>
      </div>
    `;

    root.querySelector('#cr-back-to-record')?.addEventListener('click', () => setView('record'));
    root.querySelector('#cr-clear-all')?.addEventListener('click', clearAllRecordingsWithConfirm);
    root.querySelectorAll('[data-play-recording]').forEach(btn => {
      btn.addEventListener('click', () => playRecording(btn.dataset.playRecording));
    });
    root.querySelectorAll('[data-delete-recording]').forEach(btn => {
      btn.addEventListener('click', () => deleteRecording(btn.dataset.deleteRecording));
    });
    updateToolMenu();
  }

  function renderCurrentView() {
    if (!root) return;
    if (currentView === 'manage') {
      renderManageView();
      return;
    }
    renderRecordView();
  }

  async function runVariation(audio, ui, index, total) {
    const positions = CHORDS[selectedChord];
    const config = getConfig();
    const variations = buildVariationList(config);
    const variation = variations[index];

    ui.render(selectedChord, positions, variation, index, total);

    // Pre-recording countdown 3-2-1
    for (const n of PRE_COUNTDOWN) {
      ui.setPhase('countdown', n);
      const result = await Promise.race([sleep(1000), ui.nextAction()]);
      if (result === 'stop') return 'stop';
      if (typeof result === 'string') return 'next';
    }

    // Onset detection
    let onsetResolve;
    const onsetPromise = new Promise(resolve => { onsetResolve = resolve; });
    audio.startOnsetWatch(() => {
      audio.stopOnsetWatch();
      onsetResolve('onset');
    });

    // Level watch runs from listening through end of recording
    audio.startLevelWatch(rms => ui.setLevel(rms));

    ui.setPhase('listening');
    const listenResult = await Promise.race([onsetPromise, ui.nextAction()]);
    audio.stopOnsetWatch();

    if (listenResult !== 'onset') {
      audio.stopLevelWatch();
      return listenResult === 'stop' ? 'stop' : 'next';
    }

    // Recording — duration and display depend on strum mode
    const durationMs = getDurationMs(variation.strumModus);
    const recPromise = audio.recordForDuration(durationMs);

    if (variation.strumModus === 'single') {
      const steps = Math.floor(durationMs / 1000);
      for (let t = steps; t >= 0; t--) {
        ui.setPhase('recording', t);
        if (t > 0) await sleep(1000);
      }
    } else {
      const totalBeats = durationMs / BEAT_MS;
      ui.showBeats(totalBeats);
      for (let b = 1; b <= totalBeats; b++) {
        ui.setBeat(b);
        await sleep(BEAT_MS);
      }
    }

    const { samples, sampleRate, durationSec } = await recPromise;
    audio.stopLevelWatch();

    // Quality gates
    const quality = runQualityGates(samples, sampleRate, durationSec);

    // Clear any accidental button presses during recording, then show result
    ui.clearQueue();
    ui.showResult(quality);

    // Auto-advance after 5s if passed, otherwise wait for manual action
    const action = quality.passed
      ? await autoAdvanceOrWait(ui)
      : await ui.nextAction();
    const userFlags = (action === 'buzz' || action === 'muted') ? [action] : [];

    // Build filename and sidecar
    const chordKey = toChordKey(selectedChord);
    const baseName = buildFileName(variation, chordKey, generateRandom5());
    const sidecar = buildSidecarJson(selectedChord, chordKey, variation, config, quality, {
      sampleRate, durationSec, userFlags,
    });

    // Encode and store (download happens via ZIP on setup screen)
    const wavBlob = encodeWav(samples, sampleRate);
    addRecording({ baseName, wavBlob, sidecar });

    return action;
  }

  async function startSession() {
    const config = getConfig();
    const variations = buildVariationList(config);
    if (!selectedChord || variations.length === 0) return;

    const audio = createChordRecorderAudio();
    const ui = createChordRecorderUI(root);

    try {
      await audio.open();
    } catch (err) {
      root.innerHTML = `<p class="cr-error">Mikrofon-Fehler: ${err.message}</p>
        <button type="button" class="btn-back" onclick="history.back()">← Zurück</button>`;
      return;
    }

    let i = 0;
    while (i < variations.length) {
      const action = await runVariation(audio, ui, i, variations.length);
      if (action === 'stop') break;
      if (action === 'repeat') continue;
      i++;
    }

    audio.close();
    renderCurrentView();
  }

  async function mount(rootEl) {
    root = rootEl;
    renderCurrentView();
  }

  return { mount };
}
