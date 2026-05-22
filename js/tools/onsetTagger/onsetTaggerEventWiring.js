/**
 * onsetTaggerEventWiring.js — All addEventListener calls and their handler
 * logic for the onset tagger.
 *
 * Receives `ui` (DOM references) and a `ctx` object with getters/setters
 * for shared mutable state plus bound action callbacks.
 */

import { clamp, addOnsetWithIndex, moveOnset, mergeOnsetsWithMinDistance } from './onsetTaggerLogic.js';
import { closeLoadMenu, wireLoadMenu } from './onsetTaggerLoadMenu.js';
import { detectOnsetsOffline } from '../../shared/audio/offlineOnsetDetection.js';
import { clientXToTime, updateCursor } from './onsetTaggerWaveform.js';

const STRATEGY_IMPORT_MIN_DISTANCE_MS = 50;

/**
 * Wire all DOM events.
 *
 * @param {object} ui  - Resolved DOM reference object from resolveUI()
 * @param {object} ctx - State accessors and action callbacks:
 *   State getters/setters:
 *     getSamples, getSampleRate, getDuration,
 *     getOnsetsMs, setOnsetsMs,
 *     getSelectedOnsetIndex, setSelectedOnsetIndex,
 *     getRangeStart, setRangeStart, getRangeEnd, setRangeEnd,
 *     getCursorSec, setCursorSec,
 *     getPlayOffset, setPlayOffset,
 *     getPlaybackRate, setPlaybackRate,
 *     isPlaying, getSvgEl,
 *   Action callbacks:
 *     loadWav(file), loadJson(file), loadZip(file),
 *     syncRangeSliders(edge?), syncCursorUI(),
 *     setVisibleRange(start, end), focusOnTime(sec),
 *     stepZoom(direction),
 *     updateOnsetUI(), removeOnsetAt(index, selectNeighbor),
 *     redrawWaveform(), schedulePersist(),
 *     handleExport(), handleOpenAnalyser(),
 *     startPlayback(offset), stopPlayback(reset),
 *     setPlayLabel(playing), computePos(),
 *     setBaseName(value),
 *     renderStrategyButtons(),
 *     wireAnalysisFlyout(),
 */
export function wireOnsetTaggerEvents(ui, ctx) {
  const {
    getSamples, getDuration,
    getOnsetsMs, setOnsetsMs,
    getSelectedOnsetIndex, setSelectedOnsetIndex,
    getRangeStart, setRangeStart, getRangeEnd, setRangeEnd,
    getCursorSec, setCursorSec,
    isPlaying, getSvgEl,
    loadWav, loadJson, loadZip,
    syncRangeSliders, syncCursorUI,
    focusOnTime, stepZoom,
    updateOnsetUI, removeOnsetAt,
    schedulePersist,
    handleExport, handleOpenAnalyser,
    startPlayback, stopPlayback,
    computeAndSetBaseName,
    renderStrategyButtons,
    wireAnalysisFlyout,
  } = ctx;

  // ── Strategy buttons ───────────────────────────────────────────────────────
  renderStrategyButtons(ui);
  wireAnalysisFlyout(ui);
  wireLoadMenu(ui);

  // ── File inputs ────────────────────────────────────────────────────────────
  if (ui.wavBtn && ui.wavInput) {
    ui.wavBtn.addEventListener('click', () => { closeLoadMenu(ui); ui.wavInput.click(); });
  }
  if (ui.wavInput) {
    ui.wavInput.addEventListener('change', (e) => {
      const file = e.target.files?.[0];
      if (file) loadWav(file);
    });
  }
  if (ui.jsonBtn && ui.jsonInput) {
    ui.jsonBtn.addEventListener('click', () => { closeLoadMenu(ui); ui.jsonInput.click(); });
  }
  if (ui.jsonInput) {
    ui.jsonInput.addEventListener('change', (e) => {
      const file = e.target.files?.[0];
      if (file) loadJson(file);
    });
  }
  if (ui.zipBtn && ui.zipInput) {
    ui.zipBtn.addEventListener('click', () => { closeLoadMenu(ui); ui.zipInput.click(); });
  }
  if (ui.zipInput) {
    ui.zipInput.addEventListener('change', (e) => {
      const file = e.target.files?.[0];
      if (file) loadZip(file);
    });
  }

  // ── Range sliders ──────────────────────────────────────────────────────────
  ui.rangeStartEl?.addEventListener('input', () => syncRangeSliders('start'));
  ui.rangeEndEl?.addEventListener('input',   () => syncRangeSliders('end'));

  // ── Cursor slider ──────────────────────────────────────────────────────────
  ui.cursorEl?.addEventListener('input', () => {
    const relMs = parseFloat(ui.cursorEl.value);
    const clamped = clamp(getRangeStart() + relMs / 1000, getRangeStart(), getRangeEnd());
    setCursorSec(clamped);
    const idx = getSelectedOnsetIndex();
    if (idx >= 0) {
      const ms = Math.round(clamped * 1000);
      const moved = moveOnset(getOnsetsMs(), idx, ms);
      setOnsetsMs(moved.onsetsMs);
      setSelectedOnsetIndex(moved.index);
      schedulePersist();
    }
    if (ui.cursorDisplay) ui.cursorDisplay.textContent = `${clamped.toFixed(3)} s`;
    const svgEl = getSvgEl();
    if (svgEl) updateCursor(svgEl, clamped, getRangeStart(), getRangeEnd());
    updateOnsetUI();
  });

  // ── Add / remove onset ────────────────────────────────────────────────────
  ui.addOnsetBtn?.addEventListener('click', () => {
    const ms = Math.round(getCursorSec() * 1000);
    const result = addOnsetWithIndex(getOnsetsMs(), ms);
    setOnsetsMs(result.onsetsMs);
    setSelectedOnsetIndex(result.index);
    updateOnsetUI();
    schedulePersist();
  });
  ui.removeOnsetBtn?.addEventListener('click', () => {
    removeOnsetAt(getSelectedOnsetIndex(), true);
  });

  // ── Zoom ──────────────────────────────────────────────────────────────────
  ui.zoomInBtn?.addEventListener('click',  () => { if (getDuration() > 0) stepZoom('in'); });
  ui.zoomOutBtn?.addEventListener('click', () => { if (getDuration() > 0) stepZoom('out'); });

  // ── Waveform click ────────────────────────────────────────────────────────
  ui.waveformWrap?.addEventListener('click', (e) => {
    const svgEl = getSvgEl();
    if (!svgEl || !getSamples()) return;
    const onsetMarker = e.target.closest?.('[data-onset-index]');
    if (onsetMarker) {
      const idx = parseInt(onsetMarker.dataset.onsetIndex, 10);
      const ms = getOnsetsMs()[idx];
      if (Number.isFinite(ms)) {
        setSelectedOnsetIndex(idx);
        focusOnTime(ms / 1000);
        updateOnsetUI();
      }
      return;
    }
    const sec = clientXToTime(svgEl, e.clientX, getRangeStart(), getRangeEnd());
    const clamped = clamp(sec, getRangeStart(), getRangeEnd());
    setCursorSec(clamped);
    const result = addOnsetWithIndex(getOnsetsMs(), Math.round(clamped * 1000));
    setOnsetsMs(result.onsetsMs);
    setSelectedOnsetIndex(result.index);
    syncCursorUI();
    updateOnsetUI();
    const svgEl2 = getSvgEl();
    if (svgEl2) updateCursor(svgEl2, clamped, getRangeStart(), getRangeEnd());
    schedulePersist();
  });

  // ── Onset list clicks ─────────────────────────────────────────────────────
  ui.onsetList?.addEventListener('click', (e) => {
    const removeBtn = e.target.closest('[data-index]');
    if (removeBtn) {
      removeOnsetAt(parseInt(removeBtn.dataset.index, 10), false);
      return;
    }
    const selectBtn = e.target.closest('[data-select-index]');
    if (!selectBtn) return;
    const idx = parseInt(selectBtn.dataset.selectIndex, 10);
    setSelectedOnsetIndex(idx);
    const ms = getOnsetsMs()[idx];
    if (!Number.isFinite(ms)) return;
    focusOnTime(ms / 1000);
    updateOnsetUI();
  });

  // ── Strategy detection ────────────────────────────────────────────────────
  ui.strategyList?.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-strategy-key]');
    if (!btn || !getSamples()) return;
    const strategyKey = btn.dataset.strategyKey;
    if (ui.strategyStatus) ui.strategyStatus.textContent = 'Erkennung läuft ...';
    btn.disabled = true;
    detectOnsetsOffline(getSamples(), ctx.getSampleRate(), { strategyKey })
      .then(result => {
        const merged = mergeOnsetsWithMinDistance(
          getOnsetsMs(), result.onsetsMs, STRATEGY_IMPORT_MIN_DISTANCE_MS,
        );
        setOnsetsMs(merged.onsetsMs);
        setSelectedOnsetIndex(-1);
        updateOnsetUI();
        schedulePersist();
        if (ui.strategyStatus)
          ui.strategyStatus.textContent = `${merged.added} hinzugefügt, ${merged.skipped} übersprungen.`;
      })
      .catch(err => { if (ui.strategyStatus) ui.strategyStatus.textContent = `Fehler: ${err.message}`; })
      .finally(() => { btn.disabled = false; });
  });

  // ── Playback buttons ──────────────────────────────────────────────────────
  ui.playBtn?.addEventListener('click', () => {
    if (isPlaying()) {
      stopPlayback(false);
    } else {
      if (!getSamples()) return;
      const offset = clamp(ctx.getPlayOffset(), getRangeStart(), getRangeEnd());
      startPlayback(offset);
    }
  });

  ui.stopBtn?.addEventListener('click', () => {
    stopPlayback(true);
    if (getDuration() > 0) {
      setRangeStart(0);
      setRangeEnd(getDuration());
      ctx.setPlayOffset(0);
      ui.rangeStartEl.value = '0';
      ui.rangeEndEl.value   = getDuration().toFixed(4);
      syncRangeSliders('both');
    }
  });

  // ── Speed buttons ─────────────────────────────────────────────────────────
  ui.speedBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      ui.speedBtns.forEach(b => b.classList.remove('tagger-speed--active'));
      btn.classList.add('tagger-speed--active');
      const newRate = parseFloat(btn.dataset.speed);
      ctx.setPlaybackRate(newRate);
    });
  });

  // ── Export / open analyser ────────────────────────────────────────────────
  ui.exportBtn?.addEventListener('click',    () => handleExport());
  ui.exportTopBtn?.addEventListener('click', () => handleExport());
  ui.openAnalyserBtn?.addEventListener('click', () => void handleOpenAnalyser());

  // ── Meta form ─────────────────────────────────────────────────────────────
  if (ui.metaForm) {
    const BASENAME_FIELDS = new Set(['trainingRole', 'category', 'bpm']);
    ui.metaForm.addEventListener('change', (e) => {
      if (BASENAME_FIELDS.has(e.target?.name)) computeAndSetBaseName();
      schedulePersist();
    });
    ui.metaForm.addEventListener('input', (e) => {
      if (e.target?.tagName === 'TEXTAREA') schedulePersist();
    });
  }
}
