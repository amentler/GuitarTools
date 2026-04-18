/**
 * chordExerciseEssentia.js
 * Exercise controller for "Akkord spielen (Essentia)" –
 * same flow as chordExercise.js but uses HPCP-based recognition.
 */

import { registerExercise } from '../../exerciseRegistry.js';
import { getRandomChord } from '../akkordTrainer/akkordLogic.js';
import { renderChordDiagram } from '../akkordTrainer/akkordSVG.js';
import { detectChordEssentia, stopListeningEssentia } from './essentiaChordDetection.js';
import { getEssentia } from './essentiaLoader.js';

// ── Factory ───────────────────────────────────────────────────────────────────

export function createChordExerciseEssentia() {
  let currentChord    = null;
  let score           = { correct: 0, total: 0 };
  let pendingTimer    = null;
  let isListening     = false;

  const CATEGORIES = {
    'ece-cat-simplified': 'simplified',
    'ece-cat-standard':   'standard',
    'ece-cat-extended':   'extended',
    'ece-cat-sus-add':    'sus_add',
  };

  function getActiveCategories() {
    const active = [];
    for (const id of Object.keys(CATEGORIES)) {
      const cb = document.getElementById(id);
      if (cb?.checked) active.push(CATEGORIES[id]);
    }
    return active.length ? active : ['simplified'];
  }

  // ── DOM references ─────────────────────────────────────────────────────────

  let ui = null;

  function resolveUI() {
    ui = {
      chordName:    document.getElementById('ece-chord-name'),
      diagramEl:    document.getElementById('ece-chord-diagram'),
      feedbackEl:   document.getElementById('ece-feedback'),
      statusEl:     document.getElementById('ece-essentia-status'),
      listenBtn:    document.getElementById('btn-ece-listen'),
      scoreCorrect: document.getElementById('ece-score-correct'),
      scoreTotal:   document.getElementById('ece-score-total'),
      view:         document.getElementById('view-chord-exercise-essentia'),
    };
  }

  // ── Rendering ──────────────────────────────────────────────────────────────

  function drawChordDiagram() {
    if (!currentChord || !ui.diagramEl) return;
    renderChordDiagram(ui.diagramEl, currentChord.positions, currentChord.positions, null, () => {}, true);
  }

  function updateScoreUI() {
    if (ui.scoreCorrect) ui.scoreCorrect.textContent = score.correct;
    if (ui.scoreTotal)   ui.scoreTotal.textContent   = score.total;
  }

  function setStatus(text, isError = false) {
    if (!ui.statusEl) return;
    ui.statusEl.textContent = text;
    ui.statusEl.className   = isError ? 'ece-status ece-status-error' : 'ece-status';
  }

  // ── Round management ───────────────────────────────────────────────────────

  function clearPendingTimer() {
    if (pendingTimer !== null) { clearTimeout(pendingTimer); pendingTimer = null; }
  }

  function nextRound() {
    clearPendingTimer();
    isListening   = false;
    currentChord  = getRandomChord(getActiveCategories());

    if (ui.chordName)  ui.chordName.textContent = currentChord.name;
    if (ui.feedbackEl) { ui.feedbackEl.textContent = ''; ui.feedbackEl.className = 'feedback-text'; }
    if (ui.listenBtn)  { ui.listenBtn.textContent = '\uD83C\uDFA4 H\u00F6ren'; ui.listenBtn.disabled = false; }

    drawChordDiagram();
  }

  // ── Listening flow ─────────────────────────────────────────────────────────

  async function handleListen() {
    if (isListening || !currentChord) return;
    isListening = true;

    if (ui.listenBtn) { ui.listenBtn.textContent = '\u23F3 Warte auf Anschlag\u2026'; ui.listenBtn.disabled = true; }
    if (ui.feedbackEl) { ui.feedbackEl.textContent = ''; ui.feedbackEl.className = 'feedback-text'; }

    let result;
    try {
      result = await detectChordEssentia(currentChord.name);
    } catch {
      result = { isCorrect: false, confidence: 0, bestMatch: null };
    }

    isListening = false;
    if (!ui.view?.classList.contains('active')) return;

    showFeedback(result);
  }

  function showFeedback(result) {
    score.total++;
    updateScoreUI();

    if (result.timedOut) {
      if (ui.feedbackEl) {
        ui.feedbackEl.textContent = 'Kein Anschlag erkannt. Versuche es nochmal.';
        ui.feedbackEl.className   = 'feedback-text feedback-wrong';
      }
      if (ui.listenBtn) { ui.listenBtn.textContent = '\uD83C\uDFA4 Nochmal'; ui.listenBtn.disabled = false; }
      return;
    }

    if (result.isCorrect) {
      score.correct++;
      updateScoreUI();
      if (ui.feedbackEl) {
        ui.feedbackEl.textContent = '\u2705 Richtig!';
        ui.feedbackEl.className   = 'feedback-text feedback-correct';
      }
      pendingTimer = setTimeout(() => {
        pendingTimer = null;
        if (ui.view?.classList.contains('active')) nextRound();
      }, 1500);
    } else {
      const pct = Math.round((result.confidence ?? 0) * 100);
      const hint = result.bestMatch && result.bestMatch !== currentChord.name
        ? ` (erkannt: ${result.bestMatch})`
        : '';
      if (ui.feedbackEl) {
        ui.feedbackEl.textContent = `\u274C Nicht erkannt – \u00DCbereinstimmung: ${pct}%${hint}`;
        ui.feedbackEl.className   = 'feedback-text feedback-wrong';
      }
      if (ui.listenBtn) { ui.listenBtn.textContent = '\uD83C\uDFA4 Nochmal'; ui.listenBtn.disabled = false; }
      pendingTimer = setTimeout(() => {
        pendingTimer = null;
        if (ui.view?.classList.contains('active')) nextRound();
      }, 3500);
    }
  }

  // ── Public API ─────────────────────────────────────────────────────────────

  function startExercise() {
    resolveUI();
    score = { correct: 0, total: 0 };
    updateScoreUI();

    // Pre-warm essentia WASM in background
    setStatus('Lade Essentia\u2026');
    getEssentia()
      .then(() => { if (ui.view?.classList.contains('active')) setStatus(''); })
      .catch(() => { if (ui.view?.classList.contains('active')) setStatus('Essentia konnte nicht geladen werden.', true); });

    if (ui.listenBtn) {
      const fresh = ui.listenBtn.cloneNode(true);
      ui.listenBtn.replaceWith(fresh);
      ui.listenBtn = fresh;
      ui.listenBtn.addEventListener('click', handleListen);
    }

    nextRound();
  }

  function stopExercise() {
    clearPendingTimer();
    isListening = false;
    stopListeningEssentia();
  }

  return { startExercise, stopExercise };
}

// ── Self-registration ─────────────────────────────────────────────────────────

const instance = createChordExerciseEssentia();

registerExercise('chordExerciseEssentia', {
  viewId:     'view-chord-exercise-essentia',
  btnStartId: 'btn-start-chord-exercise-essentia',
  btnBackId:  'btn-back-chord-exercise-essentia',
  start:      instance.startExercise,
  stop:       instance.stopExercise,
});
