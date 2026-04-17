/**
 * chordExercise.js
 * Main exercise controller for "Akkord spielen" (chord exercise with mic recognition).
 *
 * Pattern: factory function + registerExercise(key, meta)
 */

import { registerExercise } from '../../exerciseRegistry.js';
import { getRandomChord } from '../akkordTrainer/akkordLogic.js';
import { renderChordDiagram } from '../akkordTrainer/akkordSVG.js';
import { detectChord, stopListening } from './chordDetection.js';

// ── Factory ───────────────────────────────────────────────────────────────────

export function createChordExercise() {
  // ── State ──────────────────────────────────────────────────────────────────
  let currentChord = null;           // { name, positions }
  let score = { correct: 0, total: 0 };
  let pendingTimer = null;           // auto-advance timer
  let isListeningActive = false;     // true while detectChord() is in flight

  // ── Category mapping (mirrors akkordTrainer but with ce-cat-* prefix IDs) ──
  const CATEGORIES = {
    'ce-cat-simplified': 'simplified',
    'ce-cat-standard':   'standard',
    'ce-cat-extended':   'extended',
    'ce-cat-sus-add':    'sus_add',
  };

  function getActiveCategories() {
    const active = [];
    Object.keys(CATEGORIES).forEach(id => {
      const cb = document.getElementById(id);
      if (cb && cb.checked) active.push(CATEGORIES[id]);
    });
    return active.length > 0 ? active : ['simplified'];
  }

  // ── DOM references (resolved lazily) ──────────────────────────────────────
  let ui = null;

  function resolveUI() {
    ui = {
      chordName:    document.getElementById('ce-chord-name'),
      diagramEl:    document.getElementById('ce-chord-diagram'),
      feedbackEl:   document.getElementById('ce-feedback'),
      listenBtn:    document.getElementById('btn-ce-listen'),
      scoreCorrect: document.getElementById('ce-score-correct'),
      scoreTotal:   document.getElementById('ce-score-total'),
      view:         document.getElementById('view-chord-exercise'),
    };
  }

  // ── Rendering ──────────────────────────────────────────────────────────────

  function drawChordDiagram() {
    if (!currentChord || !ui.diagramEl) return;
    // Read-only diagram: pass same positions for both user and reference,
    // feedback = null, no interaction callback.
    renderChordDiagram(
      ui.diagramEl,
      currentChord.positions,
      currentChord.positions,
      null,
      () => {},
      true,   // showFingers = true so the diagram looks instructive
    );
  }

  function updateScoreUI() {
    if (ui.scoreCorrect) ui.scoreCorrect.textContent = score.correct;
    if (ui.scoreTotal)   ui.scoreTotal.textContent   = score.total;
  }

  // ── Round management ───────────────────────────────────────────────────────

  function clearPendingTimer() {
    if (pendingTimer !== null) {
      clearTimeout(pendingTimer);
      pendingTimer = null;
    }
  }

  function nextRound() {
    clearPendingTimer();
    isListeningActive = false;

    currentChord = getRandomChord(getActiveCategories());

    if (ui.chordName)  ui.chordName.textContent  = currentChord.name;
    if (ui.feedbackEl) {
      ui.feedbackEl.textContent = '';
      ui.feedbackEl.className   = 'feedback-text';
    }
    if (ui.listenBtn) {
      ui.listenBtn.textContent = '\uD83C\uDFA4 Horen';  // 🎤 Hören (emoji literal)
      ui.listenBtn.disabled    = false;
    }

    drawChordDiagram();
  }

  // ── Listening flow ─────────────────────────────────────────────────────────

  async function handleListen() {
    if (isListeningActive || !currentChord) return;

    isListeningActive = true;

    if (ui.listenBtn) {
      ui.listenBtn.textContent = '\u23F3 Warte auf Anschlag\u2026';  // ⏳ Warte auf Anschlag…
      ui.listenBtn.disabled    = true;
    }
    if (ui.feedbackEl) {
      ui.feedbackEl.textContent = '';
      ui.feedbackEl.className   = 'feedback-text';
    }

    let result;
    try {
      result = await detectChord(currentChord.name);
    } catch {
      result = { isCorrect: false, confidence: 0, missingNotes: [], extraNotes: [] };
    }

    isListeningActive = false;

    // Guard: exercise may have been stopped while listening
    if (!ui.view || !ui.view.classList.contains('active')) return;

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
      // Enable re-listen button
      if (ui.listenBtn) {
        ui.listenBtn.textContent = '\uD83C\uDFA4 Nochmal';
        ui.listenBtn.disabled    = false;
      }
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
        if (ui.view && ui.view.classList.contains('active')) nextRound();
      }, 1500);
    } else {
      const missing = result.missingNotes.length > 0
        ? `\u274C Fehlende T\u00F6ne: ${result.missingNotes.join(', ')}`
        : '\u274C Nicht ganz richtig.';

      if (ui.feedbackEl) {
        ui.feedbackEl.textContent = missing;
        ui.feedbackEl.className   = 'feedback-text feedback-wrong';
      }

      // Enable re-listen button for wrong answers
      if (ui.listenBtn) {
        ui.listenBtn.textContent = '\uD83C\uDFA4 Nochmal';
        ui.listenBtn.disabled    = false;
      }

      pendingTimer = setTimeout(() => {
        pendingTimer = null;
        if (ui.view && ui.view.classList.contains('active')) nextRound();
      }, 3500);
    }
  }

  // ── Public API ─────────────────────────────────────────────────────────────

  function startExercise() {
    resolveUI();

    score = { correct: 0, total: 0 };
    updateScoreUI();

    // Wire listen button (idempotent – replaces listener by replacing element clone)
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
    isListeningActive = false;
    stopListening();
  }

  return { startExercise, stopExercise };
}

// ── Self-registration ─────────────────────────────────────────────────────────

const chordExerciseInstance = createChordExercise();

registerExercise('chordExercise', {
  viewId:     'view-chord-exercise',
  btnStartId: 'btn-start-chord-exercise',
  btnBackId:  'btn-back-chord-exercise',
  start:      chordExerciseInstance.startExercise,
  stop:       chordExerciseInstance.stopExercise,
});
