import { getAllRecordingsMeta } from './recordingsOverviewStorage.js';
import {
  formatFileSize,
  formatDate,
  buildAudioAnalyseUrl,
  buildOnsetTaggerUrl,
} from './recordingsOverviewLogic.js';

export function createRecordingsOverviewFeature() {
  let _root       = null;
  let _selected   = null;
  let _recordings = [];

  function resolveUI() {
    const q = id => _root.getElementById?.(id) ?? _root.querySelector?.(`#${id}`) ?? document.getElementById(id);
    return {
      list:       q('recordings-list'),
      actions:    q('recordings-actions'),
      analyseBtn: q('btn-open-analyse'),
      taggerBtn:  q('btn-open-tagger'),
      emptyMsg:   q('recordings-empty'),
    };
  }

  function renderList(ui) {
    const { list, emptyMsg } = ui;
    list.innerHTML = '';
    if (_recordings.length === 0) {
      emptyMsg?.classList.remove('u-hidden');
      return;
    }
    emptyMsg?.classList.add('u-hidden');

    for (const rec of _recordings) {
      const li = document.createElement('li');
      li.className = 'recordings-item';
      li.dataset.id     = rec.id;
      li.dataset.source = rec.source;

      const badge = rec.source === 'sheet-music' ? 'Noten lesen' : 'Akkord-Recorder';
      li.innerHTML = `
        <span class="recordings-item__badge">${badge}</span>
        <span class="recordings-item__name">${rec.name}</span>
        <span class="recordings-item__meta">${formatFileSize(rec.sizeBytes)} · ${formatDate(rec.date?.toISOString())}</span>
      `;

      li.addEventListener('click', () => selectRecording(li, rec, ui));
      list.appendChild(li);
    }
  }

  function selectRecording(li, rec, ui) {
    _selected = rec;
    _root.querySelectorAll('.recordings-item--selected')
      .forEach(el => el.classList.remove('recordings-item--selected'));
    li.classList.add('recordings-item--selected');
    ui.actions.classList.remove('u-hidden');
  }

  function mount(root) {
    _root = root;
    const ui = resolveUI();

    ui.actions?.classList.add('u-hidden');

    ui.analyseBtn?.addEventListener('click', () => {
      if (!_selected) return;
      window.location.href = buildAudioAnalyseUrl(_selected.source, _selected.id);
    });

    ui.taggerBtn?.addEventListener('click', () => {
      if (!_selected) return;
      window.location.href = buildOnsetTaggerUrl(_selected.source, _selected.id);
    });

    getAllRecordingsMeta().then(recordings => {
      _recordings = recordings;
      renderList(ui);
    }).catch(() => {
      if (ui.emptyMsg) {
        ui.emptyMsg.textContent = 'Aufnahmen konnten nicht geladen werden.';
        ui.emptyMsg.classList.remove('u-hidden');
      }
    });
  }

  function unmount() {
    _root     = null;
    _selected = null;
  }

  return { mount, unmount };
}
