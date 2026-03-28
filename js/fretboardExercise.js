// Fretboard exercise – state management & DOM interaction

import { CHROMATIC_NOTES, getNoteAtPosition, getRandomPosition } from './fretboardLogic.js';
import { renderFretboard } from './fretboardSVG.js';

// ── State ─────────────────────────────────────────────────────────────────────
let state = {
  targetPosition: null,   // { string, fret }
  feedbackState: null,    // null | 'correct' | 'wrong'
  score: { correct: 0, total: 0 },
  feedbackTimeout: null,
  isDisabled: false,
};

// ── DOM refs (resolved when exercise starts) ──────────────────────────────────
let svgContainer, noteButtonsEl, feedbackTextEl, scoreCorrectEl, scoreTotalEl;

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Initialize and start the exercise.
 * Call this each time the user navigates to the fretboard view.
 */
export function startExercise() {
  svgContainer    = document.getElementById('fretboard-svg');
  noteButtonsEl   = document.getElementById('note-buttons');
  feedbackTextEl  = document.getElementById('feedback-text');
  scoreCorrectEl  = document.getElementById('score-correct');
  scoreTotalEl    = document.getElementById('score-total');

  // Reset state on every start
  if (state.feedbackTimeout) clearTimeout(state.feedbackTimeout);
  state = {
    targetPosition: getRandomPosition(),
    feedbackState: null,
    score: { correct: 0, total: 0 },
    feedbackTimeout: null,
    isDisabled: false,
  };

  buildNoteButtons();
  updateScore();
  render();
}

/**
 * Clean up timeouts when leaving the exercise.
 */
export function stopExercise() {
  if (state.feedbackTimeout) {
    clearTimeout(state.feedbackTimeout);
    state.feedbackTimeout = null;
  }
}

// ── Internal ──────────────────────────────────────────────────────────────────

function render() {
  renderFretboard(svgContainer, state.targetPosition.string, state.targetPosition.fret, state.feedbackState);
  updateNoteButtons();
  updateFeedbackText();
}

function buildNoteButtons() {
  noteButtonsEl.innerHTML = '';
  for (const note of CHROMATIC_NOTES) {
    const btn = document.createElement('button');
    btn.className = 'btn-note';
    btn.textContent = note;
    btn.dataset.note = note;
    btn.addEventListener('click', () => handleAnswer(note));
    noteButtonsEl.appendChild(btn);
  }
}

function handleAnswer(note) {
  if (state.isDisabled) return;

  const correctNote = getNoteAtPosition(state.targetPosition.string, state.targetPosition.fret);
  const isCorrect = note === correctNote;

  state.isDisabled = true;
  state.feedbackState = isCorrect ? 'correct' : 'wrong';
  state.score.total += 1;
  if (isCorrect) state.score.correct += 1;

  // Store which note was selected so we can highlight it
  state.selectedNote = note;
  state.correctNote = correctNote;

  updateScore();
  render();

  state.feedbackTimeout = setTimeout(() => {
    state.targetPosition = getRandomPosition(state.targetPosition);
    state.feedbackState = null;
    state.selectedNote = null;
    state.correctNote = null;
    state.isDisabled = false;
    render();
  }, 1200);
}

function updateNoteButtons() {
  const buttons = noteButtonsEl.querySelectorAll('.btn-note');
  buttons.forEach(btn => {
    const note = btn.dataset.note;
    btn.classList.remove('correct', 'wrong');
    btn.disabled = state.isDisabled;

    if (state.feedbackState) {
      if (note === state.correctNote) {
        btn.classList.add('correct');
      } else if (note === state.selectedNote && note !== state.correctNote) {
        btn.classList.add('wrong');
      }
    }
  });
}

function updateFeedbackText() {
  feedbackTextEl.className = 'feedback-text';

  if (state.feedbackState === 'correct') {
    feedbackTextEl.textContent = 'Richtig! ✓';
    feedbackTextEl.classList.add('correct');
  } else if (state.feedbackState === 'wrong') {
    feedbackTextEl.textContent = `Falsch! Der richtige Ton war ${state.correctNote}`;
    feedbackTextEl.classList.add('wrong');
  } else {
    feedbackTextEl.textContent = '';
  }
}

function updateScore() {
  scoreCorrectEl.textContent = state.score.correct;
  scoreTotalEl.textContent = state.score.total;
}
