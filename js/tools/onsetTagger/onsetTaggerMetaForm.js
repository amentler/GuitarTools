export const DEFAULT_SIDECAR_FIELDS = {
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

export const DROPDOWN_OPTIONS = {
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

export const NUMERIC_DROPDOWN_KEYS = new Set(['bpm', 'tempoBpm', 'notesPerBeat']);

export function renderMetaForm(ui, data) {
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

export function buildMetaRow(id, labelText, value, parentKey) {
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

export function buildMetaInput(id, key, value, parentKey) {
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

export function readInputValue(el) {
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

export function readMetaForm(ui) {
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
