import {
  getAllRecordingsMeta,
  deleteAllSheetMusicRecordings,
  deleteAllChordRecordings,
  deleteAllRecordings,
  deleteRecordingsByIds,
  downloadRecordingsAsZip,
} from './recordingsOverviewStorage.js';
import {
  formatFileSize,
  formatDate,
  buildAudioAnalyseUrl,
  buildOnsetTaggerUrl,
  buildTrainingDataOnsetTaggerUrl,
  getTrainingReviewIssueCount,
  sortTrainingReviewEntries,
} from './recordingsOverviewLogic.js';
import { getTrainingReviewEntries } from '../../shared/trainingDataReviewCatalog.js';

export function createRecordingsOverviewFeature() {
  let _root       = null;
  /** @type {Set<string>} keys are `${source}:${id}` */
  let _selectedKeys = new Set();
  let _recordings   = [];
  let _trainingEntries = [];
  let _trainingSortKey = 'issues';
  let _trainingSortDirection = 'desc';

  function recKey(rec) { return `${rec.source}:${rec.id}`; }

  function resolveUI() {
    const q = id => _root.getElementById?.(id) ?? _root.querySelector?.(`#${id}`) ?? document.getElementById(id);
    return {
      list:              q('recordings-list'),
      emptyMsg:          q('recordings-empty'),
      selectionActions:  q('recordings-selection-actions'),
      analyseBtn:        q('btn-open-analyse'),
      taggerBtn:         q('btn-open-tagger'),
      downloadSelBtn:    q('btn-download-selected'),
      deleteSelBtn:      q('btn-delete-selected'),
      bulkActions:       q('recordings-bulk-actions'),
      dlAllBtn:          q('btn-dl-all'),
      dlSheetBtn:        q('btn-dl-sheet'),
      dlChordBtn:        q('btn-dl-chord'),
      delAllBtn:         q('btn-del-all'),
      delSheetBtn:       q('btn-del-sheet'),
      delChordBtn:       q('btn-del-chord'),
      trainingList:      q('training-review-list'),
      trainingSummary:   q('training-review-summary'),
      trainingRefreshBtn: q('btn-refresh-training-review'),
      trainingSortBtns:  _root.querySelectorAll?.('[data-training-sort]') ?? [],
    };
  }

  function updateActionVisibility(ui) {
    const count = _selectedKeys.size;
    const hasSel = count > 0;
    const hasRecs = _recordings.length > 0;

    ui.selectionActions?.classList.toggle('u-hidden', !hasSel);
    ui.bulkActions?.classList.toggle('u-hidden', !hasRecs);

    // Analyse/Tagger only usable when exactly one recording is selected
    const exactlyOne = count === 1;
    if (ui.analyseBtn) ui.analyseBtn.disabled = !exactlyOne;
    if (ui.taggerBtn)  ui.taggerBtn.disabled  = !exactlyOne;
  }

  function renderList(ui) {
    const { list, emptyMsg } = ui;
    list.innerHTML = '';
    if (_recordings.length === 0) {
      emptyMsg?.classList.remove('u-hidden');
      updateActionVisibility(ui);
      return;
    }
    emptyMsg?.classList.add('u-hidden');

    for (const rec of _recordings) {
      const key = recKey(rec);
      const li = document.createElement('li');
      li.className = 'recordings-item';
      if (_selectedKeys.has(key)) li.classList.add('recordings-item--selected');
      li.dataset.id     = rec.id;
      li.dataset.source = rec.source;

      const badge = rec.source === 'sheet-music' ? 'Noten lesen' : 'Akkord-Recorder';
      li.innerHTML = `
        <label class="recordings-item__label">
          <input type="checkbox" class="recordings-item__check" ${_selectedKeys.has(key) ? 'checked' : ''}>
          <span class="recordings-item__info">
            <span class="recordings-item__badge">${badge}</span>
            <span class="recordings-item__name">${rec.name}</span>
            <span class="recordings-item__meta">${formatFileSize(rec.sizeBytes)} · ${formatDate(rec.date?.toISOString())}</span>
          </span>
        </label>
      `;

      const checkbox = li.querySelector('.recordings-item__check');
      checkbox.addEventListener('change', () => {
        if (checkbox.checked) {
          _selectedKeys.add(key);
          li.classList.add('recordings-item--selected');
        } else {
          _selectedKeys.delete(key);
          li.classList.remove('recordings-item--selected');
        }
        updateActionVisibility(ui);
      });

      list.appendChild(li);
    }
    updateActionVisibility(ui);
  }

  async function refreshList(ui) {
    _recordings = await getAllRecordingsMeta();
    // Remove stale keys
    const validKeys = new Set(_recordings.map(recKey));
    for (const k of _selectedKeys) {
      if (!validKeys.has(k)) _selectedKeys.delete(k);
    }
    renderList(ui);
  }

  function formatMetric(value) {
    return Number.isFinite(value) ? value.toFixed(2).replace(/\.?0+$/, '') : '–';
  }

  function formatCount(value) {
    return Number.isFinite(value) ? String(value) : '–';
  }

  function setCell(row, text, className = '') {
    const cell = document.createElement('td');
    cell.textContent = text;
    if (className) cell.className = className;
    row.appendChild(cell);
    return cell;
  }

  function renderTrainingReview(ui) {
    if (!ui.trainingList) return;
    ui.trainingList.innerHTML = '';
    const sorted = sortTrainingReviewEntries(_trainingEntries, _trainingSortKey, _trainingSortDirection);
    if (ui.trainingSummary) {
      const issueCount = _trainingEntries.filter(entry => getTrainingReviewIssueCount(entry) > 0).length;
      const metricCount = _trainingEntries.filter(entry => entry.metrics).length;
      ui.trainingSummary.textContent =
        `${_trainingEntries.length} Audioquellen, ${metricCount} mit Metrics, ${issueCount} mit FP/FN.`;
    }

    for (const entry of sorted) {
      const metrics = entry.metrics ?? {};
      const issueCount = getTrainingReviewIssueCount(entry);
      const row = document.createElement('tr');
      if (issueCount > 0) row.classList.add('recordings-training-table__problem');
      if (!entry.metrics) row.classList.add('recordings-training-table__missing');

      setCell(row, entry.name ?? entry.id ?? '–');
      setCell(row, entry.kind ?? '–');
      setCell(row, entry.match?.status ?? '–');
      setCell(row, formatCount(metrics.expected));
      setCell(row, formatCount(metrics.detected));
      setCell(row, formatCount(metrics.tp));
      setCell(row, formatCount(metrics.fp));
      setCell(row, formatCount(metrics.fn));
      setCell(row, formatMetric(metrics.precision));
      setCell(row, formatMetric(metrics.recall));

      const actionCell = setCell(row, '', 'recordings-training-table__action');
      const openBtn = document.createElement('button');
      openBtn.className = 'btn-play-stop';
      openBtn.type = 'button';
      openBtn.textContent = 'Tagger';
      openBtn.disabled = !entry.url || !['zip', 'wav'].includes(entry.kind);
      openBtn.addEventListener('click', () => {
        window.location.href = buildTrainingDataOnsetTaggerUrl(entry.id);
      });
      actionCell.appendChild(openBtn);

      ui.trainingList.appendChild(row);
    }
  }

  async function refreshTrainingReview(ui) {
    if (ui.trainingSummary) ui.trainingSummary.textContent = 'Lade Trainingsdaten ...';
    if (ui.trainingRefreshBtn) ui.trainingRefreshBtn.disabled = true;
    try {
      _trainingEntries = await getTrainingReviewEntries();
      renderTrainingReview(ui);
    } catch {
      _trainingEntries = [];
      if (ui.trainingList) ui.trainingList.innerHTML = '';
      if (ui.trainingSummary) ui.trainingSummary.textContent = 'Trainingsdaten konnten nicht geladen werden.';
    } finally {
      if (ui.trainingRefreshBtn) ui.trainingRefreshBtn.disabled = false;
    }
  }

  function getSelectedRecordings() {
    return _recordings.filter(r => _selectedKeys.has(recKey(r)));
  }

  function getSingleSelected() {
    if (_selectedKeys.size !== 1) return null;
    const [key] = _selectedKeys;
    return _recordings.find(r => recKey(r) === key) ?? null;
  }

  async function handleDeleteSelected(ui) {
    const sel = getSelectedRecordings();
    if (sel.length === 0) return;
    if (!confirm(`${sel.length} Aufnahme(n) unwiderruflich löschen?`)) return;
    if (ui.deleteSelBtn) ui.deleteSelBtn.disabled = true;
    try {
      await deleteRecordingsByIds(sel.map(r => ({ source: r.source, id: r.id })));
      _selectedKeys.clear();
      await refreshList(ui);
    } catch {
      alert('Fehler beim Löschen.');
    } finally {
      if (ui.deleteSelBtn) ui.deleteSelBtn.disabled = false;
    }
  }

  async function handleBulkDelete(ui, btn, deleteFn, label) {
    if (!confirm(`Alle ${label}-Aufnahmen unwiderruflich löschen?`)) return;
    if (btn) btn.disabled = true;
    try {
      await deleteFn();
      _selectedKeys.clear();
      await refreshList(ui);
    } catch {
      alert('Fehler beim Löschen.');
    } finally {
      if (btn) btn.disabled = false;
    }
  }

  async function handleDownloadSelected(ui) {
    const sel = getSelectedRecordings();
    if (sel.length === 0) return;
    if (ui.downloadSelBtn) ui.downloadSelBtn.disabled = true;
    try {
      await downloadRecordingsAsZip(sel, `aufnahmen-auswahl-${Date.now()}.zip`);
    } catch {
      alert('ZIP-Download fehlgeschlagen.');
    } finally {
      if (ui.downloadSelBtn) ui.downloadSelBtn.disabled = false;
    }
  }

  async function handleDownloadAll(ui, btn, filter, zipName) {
    const recs = filter ? _recordings.filter(r => r.source === filter) : _recordings;
    if (recs.length === 0) return;
    if (btn) btn.disabled = true;
    try {
      await downloadRecordingsAsZip(recs, zipName);
    } catch {
      alert('ZIP-Download fehlgeschlagen.');
    } finally {
      if (btn) btn.disabled = false;
    }
  }

  function mount(root) {
    _root = root;
    const ui = resolveUI();

    ui.selectionActions?.classList.add('u-hidden');
    ui.bulkActions?.classList.add('u-hidden');

    ui.analyseBtn?.addEventListener('click', () => {
      const rec = getSingleSelected();
      if (!rec) return;
      window.location.href = buildAudioAnalyseUrl(rec.source, rec.id);
    });

    ui.taggerBtn?.addEventListener('click', () => {
      const rec = getSingleSelected();
      if (!rec) return;
      window.location.href = buildOnsetTaggerUrl(rec.source, rec.id);
    });

    ui.downloadSelBtn?.addEventListener('click', () => void handleDownloadSelected(ui));
    ui.deleteSelBtn?.addEventListener('click',   () => void handleDeleteSelected(ui));

    ui.dlAllBtn?.addEventListener('click',   () => void handleDownloadAll(ui, ui.dlAllBtn,   null,            `alle-aufnahmen-${Date.now()}.zip`));
    ui.dlSheetBtn?.addEventListener('click', () => void handleDownloadAll(ui, ui.dlSheetBtn, 'sheet-music',   `notenlesen-aufnahmen-${Date.now()}.zip`));
    ui.dlChordBtn?.addEventListener('click', () => void handleDownloadAll(ui, ui.dlChordBtn, 'chord-recorder',`akkord-aufnahmen-${Date.now()}.zip`));

    ui.delAllBtn?.addEventListener('click',   () => void handleBulkDelete(ui, ui.delAllBtn,   deleteAllRecordings,           'alle'));
    ui.delSheetBtn?.addEventListener('click', () => void handleBulkDelete(ui, ui.delSheetBtn, deleteAllSheetMusicRecordings, 'Noten-lesen'));
    ui.delChordBtn?.addEventListener('click', () => void handleBulkDelete(ui, ui.delChordBtn, deleteAllChordRecordings,      'Akkord-Recorder'));
    ui.trainingRefreshBtn?.addEventListener('click', () => void refreshTrainingReview(ui));
    ui.trainingSortBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        const key = btn.dataset.trainingSort;
        if (_trainingSortKey === key) {
          _trainingSortDirection = _trainingSortDirection === 'desc' ? 'asc' : 'desc';
        } else {
          _trainingSortKey = key;
          _trainingSortDirection = key === 'name' || key === 'kind' || key === 'match' ? 'asc' : 'desc';
        }
        renderTrainingReview(ui);
      });
    });

    refreshList(ui).catch(() => {
      if (ui.emptyMsg) {
        ui.emptyMsg.textContent = 'Aufnahmen konnten nicht geladen werden.';
        ui.emptyMsg.classList.remove('u-hidden');
      }
    });
    refreshTrainingReview(ui).catch(() => {});
  }

  function unmount() {
    _root        = null;
    _selectedKeys = new Set();
  }

  return { mount, unmount };
}
