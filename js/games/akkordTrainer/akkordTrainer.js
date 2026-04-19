/**
 * akkordTrainer.js
 * Main controller for the Chord Trainer game.
 */

import { registerExercise } from '../../exerciseRegistry.js';
import { getRandomChord, validateChord } from './akkordLogic.js';
import { renderChordDiagram } from './akkordSVG.js';

export function createAkkordExercise() {
  // State (per-instance)
  let currentChord = null;
  let userPositions = []; // Array<{string, fret, muted}>
  let feedback = null;
  let score = { correct: 0, total: 0 };
  
  // Category mapping
  const CATEGORIES = {
    'check-cat-simplified': 'simplified',
    'check-cat-standard': 'standard',
    'check-cat-extended': 'extended',
    'check-cat-sus-add': 'sus_add'
  };

  function getActiveCategories() {
    const active = [];
    Object.keys(CATEGORIES).forEach(id => {
      const cb = document.getElementById(id);
      if (cb && cb.checked) {
        active.push(CATEGORIES[id]);
      }
    });
    return active.length > 0 ? active : ['simplified'];
  }

  function getDefaultStringPositions() {
    return Array.from({ length: 6 }, (_, idx) => ({
      string: idx + 1,
      fret: 0,
      muted: false
    }));
  }

  // DOM Elements
  const view = document.getElementById('view-akkord-trainer');
  const chordNameDisplay = document.getElementById('chord-name-display');
  const diagramContainer = document.getElementById('chord-diagram-container');
  const btnCheck = document.getElementById('btn-chord-check');
  const scoreCorrect = document.getElementById('score-correct');
  const scoreTotal = document.getElementById('score-total');
  const feedbackText = document.getElementById('feedback-text');

  function nextRound() {
    currentChord = getRandomChord(getActiveCategories());
    userPositions = getDefaultStringPositions();
    feedback = null;

    // UI Update
    chordNameDisplay.textContent = currentChord.name;
    feedbackText.textContent = 'Trage den Akkord ein...';
    feedbackText.className = 'feedback-text';
    btnCheck.disabled = false;

    draw();
  }

  function draw() {
    renderChordDiagram(
      diagramContainer,
      userPositions,
      currentChord ? currentChord.positions : null,
      feedback,
      handleTogglePosition
    );
  }

  /**
   * Handles clicking on the diagram to place/remove markers.
   */
  function handleTogglePosition(string, fret, isMuteToggle) {
    if (feedback) return; // Disable interaction during feedback phase

    const existingIdx = userPositions.findIndex(p => p.string === string);
    if (existingIdx < 0) return;

    if (isMuteToggle) {
      const pos = userPositions[existingIdx];
      if (pos.muted) {
        // Switch from Muted to Open
        userPositions[existingIdx] = { string, fret: 0, muted: false };
      } else {
        // Switch from Open/Fretted to Muted
        userPositions[existingIdx] = { string, muted: true };
      }
    } else {
      // Fret click (1-5)
      const pos = userPositions[existingIdx];
      if (!pos.muted && pos.fret === fret) {
        // Switch from fretted back to open
        userPositions[existingIdx] = { string, fret: 0, muted: false };
      } else {
        // Set to new fret
        userPositions[existingIdx] = { string, fret, muted: false };
      }
    }

    draw();
  }

  function handleCheck() {
    if (feedback || !currentChord) return;

    const isCorrect = validateChord(currentChord.name, userPositions);
    feedback = isCorrect ? 'correct' : 'wrong';
    btnCheck.disabled = true;

    score.total++;
    if (isCorrect) {
      score.correct++;
      feedbackText.textContent = 'Richtig! Gut gemacht.';
      feedbackText.className = 'feedback-text feedback-correct';
    } else {
      feedbackText.textContent = 'Nicht ganz richtig. Schau dir die Lösung an.';
      feedbackText.className = 'feedback-text feedback-wrong';
    }

    updateScoreUI();
    draw();

    // Wait before next round
    setTimeout(() => {
      if (view.classList.contains('active')) {
        nextRound();
      }
    }, isCorrect ? 1500 : 3000);
  }

  function updateScoreUI() {
    if (scoreCorrect) scoreCorrect.textContent = score.correct;
    if (scoreTotal) scoreTotal.textContent = score.total;
  }

  function startExercise() {
    score = { correct: 0, total: 0 };
    updateScoreUI();
    nextRound();
  }

  function stopExercise() {
    currentChord = null;
    userPositions = [];
    feedback = null;
  }

  // Wire events
  if (btnCheck) {
    btnCheck.addEventListener('click', handleCheck);
  }

  return { startExercise, stopExercise };
}

// ── Self-registration ─────────────────────────────────────────────────────────
const akkordExercise = createAkkordExercise();
registerExercise('akkord', {
  viewId: 'view-akkord-trainer',
  btnStartId: 'btn-start-akkord-trainer',
  btnBackId: 'btn-back-akkord-trainer',
  start: akkordExercise.startExercise,
  stop: akkordExercise.stopExercise,
});
