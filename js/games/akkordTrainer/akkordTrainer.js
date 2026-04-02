/**
 * akkordTrainer.js
 * Main controller for the Chord Trainer game.
 */

import { getRandomChord, validateChord } from './akkordLogic.js';
import { renderChordDiagram } from './akkordSVG.js';

// ── State ───────────────────────────────────────────────────────────────────
let currentChord = null;
let userPositions = []; // Array<{string, fret, muted}>
let feedback = null;
let score = { correct: 0, total: 0 };
let level = 1;

// ── DOM Elements ────────────────────────────────────────────────────────────
const view = document.getElementById('view-akkord-trainer');
const chordNameDisplay = document.getElementById('chord-name-display');
const diagramContainer = document.getElementById('chord-diagram-container');
const btnCheck = document.getElementById('btn-chord-check');
const scoreCorrect = document.getElementById('chord-score-correct');
const scoreTotal = document.getElementById('chord-score-total');
const feedbackText = document.getElementById('chord-feedback-text');

/**
 * Initializes the game and renders the first chord.
 */
export function startExercise() {
  score = { correct: 0, total: 0 };
  updateScoreUI();
  nextRound();
}

/**
 * Cleans up when leaving the exercise.
 */
export function stopExercise() {
  currentChord = null;
  userPositions = [];
  feedback = null;
}

function nextRound() {
  currentChord = getRandomChord(level);
  userPositions = [];
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
  
  if (isMuteToggle) {
    if (existingIdx >= 0) {
      const pos = userPositions[existingIdx];
      if (pos.muted) {
        // Switch from Muted to Open
        userPositions[existingIdx] = { string, fret: 0, muted: false };
      } else if (pos.fret === 0) {
        // Switch from Open to None
        userPositions.splice(existingIdx, 1);
      } else {
        // Switch from Fretted to Muted
        userPositions[existingIdx] = { string, muted: true };
      }
    } else {
      // New: Muted
      userPositions.push({ string, muted: true });
    }
  } else {
    // Fret click (1-5)
    if (existingIdx >= 0) {
      const pos = userPositions[existingIdx];
      if (!pos.muted && pos.fret === fret) {
        // Remove if same fret clicked
        userPositions.splice(existingIdx, 1);
      } else {
        // Set to new fret
        userPositions[existingIdx] = { string, fret, muted: false };
      }
    } else {
      // Add new fret marker
      userPositions.push({ string, fret, muted: false });
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

// Wire events
if (btnCheck) {
  btnCheck.addEventListener('click', handleCheck);
}
