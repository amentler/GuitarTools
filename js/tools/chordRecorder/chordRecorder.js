import { CHORDS, CHORD_META } from '../../data/akkordData.js';
import { chordStringToFretboardIndex } from '../../domain/chords/chordFretboardMapping.js';
import { createStorageService } from '../../shared/storage/storageService.js';
import { buildVariationList } from './chordRecorderVariations.js';

const STORAGE_PREFIX = 'chord-recorder-';
const ROOT_ORDER = ['A', 'C', 'D', 'E', 'F', 'G', 'H'];
const TYPE_ORDER = ['Dur', 'Moll', 'Dom7', 'Maj7', 'Min7', 'Dim', 'Sus', 'Add'];

const GUITAR_SIZES = ['Vollgröße', '7/8', '3/4', '1/2', '1/4', 'Unbekannt'];
const GUITAR_STRINGS = ['Steel', 'Nylon'];
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

  function getConfig() {
    return {
      guitarSize:    storageService.getString('guitarSize', { defaultValue: 'Vollgröße' }),
      guitarStrings: storageService.getString('guitarStrings', { defaultValue: 'Steel' }),
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
    const btn = root?.querySelector('#cr-start-btn');
    if (!btn) return;
    const config = getConfig();
    const ready = selectedChord && config.techniken.length > 0 && config.strumModi.length > 0;
    btn.classList.toggle('u-hidden', !ready);
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
    if (stringsSelect) stringsSelect.value = storageService.getString('guitarStrings', { defaultValue: 'Steel' });
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

  async function mount(rootEl) {
    root = rootEl;
    root.innerHTML = `
      <div class="chord-recorder">

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
          <h2 class="cr-section-title">③ Akkord wählen</h2>
          <div id="cr-chord-grid" class="cr-chord-grid"></div>
        </section>

        <div class="cr-start-container">
          <button id="cr-start-btn" type="button" class="btn-start u-hidden">
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
  }

  return { mount };
}
