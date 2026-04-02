// Fretboard exercise – state management & DOM interaction

import { CHROMATIC_NOTES, getNoteAtPosition, getRandomPosition } from './fretboardLogic.js';
import { renderFretboard } from './fretboardSVG.js';

// ── Module-level flags ────────────────────────────────────────────────────────
let settingsWired = false;

// ── Constants ─────────────────────────────────────────────────────────────────
const RESHUFFLE_INTERVAL = 5;

// ── State ─────────────────────────────────────────────────────────────────────
let state = {
  targetPosition: null,
  feedbackState:  null,
  score: { correct: 0, total: 0 },
  feedbackTimeout: null,
  isDisabled: false,
  settings: {
    maxFret: 4,
    activeStrings: [0, 1, 2, 3, 4, 5],
    shuffleNotes: false,
  },
  chancesLeft:  3,
  wrongAnswers: [],
  selectedNote: null,
  correctNote:  null,
  noteOrder: [...CHROMATIC_NOTES],
  exercisesAnswered: 0,
  noteOrderDirty: false,
};

// ── DOM refs (resolved when exercise starts) ──────────────────────────────────
let svgContainer, noteButtonsEl, feedbackTextEl, scoreCorrectEl, scoreTotalEl, chancesDisplayEl;

// ── Utilities ─────────────────────────────────────────────────────────────────

function shuffleArray(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function makeNoteOrder(shuffleNotes) {
  return shuffleNotes ? shuffleArray([...CHROMATIC_NOTES]) : [...CHROMATIC_NOTES];
}

// ── Public API ────────────────────────────────────────────────────────────────

export function startExercise() {
  svgContainer      = document.getElementById('fretboard-svg');
  noteButtonsEl     = document.getElementById('note-buttons');
  feedbackTextEl    = document.getElementById('feedback-text');
  scoreCorrectEl    = document.getElementById('score-correct');
  scoreTotalEl      = document.getElementById('score-total');
  chancesDisplayEl  = document.getElementById('chances-display');

  if (state.feedbackTimeout) clearTimeout(state.feedbackTimeout);

  // Preserve settings across restarts, reset everything else
  state = {
    targetPosition: getRandomPosition(null, state.settings),
    feedbackState:  null,
    score: { correct: 0, total: 0 },
    feedbackTimeout: null,
    isDisabled: false,
    settings: state.settings,
    chancesLeft:  3,
    wrongAnswers: [],
    selectedNote: null,
    correctNote:  null,
    noteOrder: makeNoteOrder(state.settings.shuffleNotes),
    exercisesAnswered: 0,
    noteOrderDirty: false,
  };

  buildNoteButtons();
  updateScore();
  updateChancesDisplay();
  render();

  if (!settingsWired) {
    wireSettings();
    settingsWired = true;
  }
  // Sync settings UI to current state (after wiring so elements are original)
  syncSettingsUI();
}

export function stopExercise() {
  if (state.feedbackTimeout) {
    clearTimeout(state.feedbackTimeout);
    state.feedbackTimeout = null;
  }
}

// ── Settings wiring ───────────────────────────────────────────────────────────

function wireSettings() {
  const slider     = document.getElementById('fret-range-slider');
  const rangeLabel = document.getElementById('fret-range-label');

  slider.addEventListener('input', () => {
    state.settings.maxFret = parseInt(slider.value, 10);
    rangeLabel.textContent = `0 – ${state.settings.maxFret}`;
    resetAndAdvance();
  });

  document.querySelectorAll('.btn-string').forEach(btn => {
    btn.addEventListener('click', () => {
      const idx    = parseInt(btn.dataset.string, 10);
      const active = state.settings.activeStrings;

      if (active.includes(idx)) {
        if (active.length > 1) {
          active.splice(active.indexOf(idx), 1);
          btn.classList.remove('active');
        }
      } else {
        active.push(idx);
        active.sort((a, b) => a - b);
        btn.classList.add('active');
      }

      resetAndAdvance();
    });
  });

  const shuffleCheckbox = document.getElementById('shuffle-notes-checkbox');
  shuffleCheckbox.addEventListener('change', () => {
    state.settings.shuffleNotes = shuffleCheckbox.checked;
    state.noteOrder = makeNoteOrder(state.settings.shuffleNotes);
    state.exercisesAnswered = 0;
    buildNoteButtons();
    resetAndAdvance();
  });
}

function syncSettingsUI() {
  const slider     = document.getElementById('fret-range-slider');
  const rangeLabel = document.getElementById('fret-range-label');
  slider.value = state.settings.maxFret;
  rangeLabel.textContent = `0 – ${state.settings.maxFret}`;

  document.querySelectorAll('.btn-string').forEach(btn => {
    const idx = parseInt(btn.dataset.string, 10);
    btn.classList.toggle('active', state.settings.activeStrings.includes(idx));
  });

  document.getElementById('shuffle-notes-checkbox').checked = state.settings.shuffleNotes;
}

// ── Core rendering ────────────────────────────────────────────────────────────

function render() {
  renderFretboard(
    svgContainer,
    state.targetPosition.string,
    state.targetPosition.fret,
    state.feedbackState,
    state.settings.maxFret
  );
  updateNoteButtons();
  updateFeedbackText();
}

function buildNoteButtons() {
  noteButtonsEl.innerHTML = '';
  for (const note of state.noteOrder) {
    const btn = document.createElement('button');
    btn.className   = 'btn-note';
    btn.textContent = note;
    btn.dataset.note = note;
    btn.addEventListener('click', () => handleAnswer(note));
    noteButtonsEl.appendChild(btn);
  }
}

// ── Answer handling ───────────────────────────────────────────────────────────

function handleAnswer(note) {
  if (state.isDisabled) return;
  if (state.wrongAnswers.includes(note)) return;

  const correctNote = getNoteAtPosition(state.targetPosition.string, state.targetPosition.fret);
  const isCorrect   = note === correctNote;

  state.selectedNote = note;
  state.correctNote  = correctNote;

  if (isCorrect) {
    state.isDisabled  = true;
    state.feedbackState = 'correct';
    state.score.correct += 1;
    state.score.total   += 1;
    updateScore();
    render();
    state.exercisesAnswered += 1;
    if (state.settings.shuffleNotes && state.exercisesAnswered % RESHUFFLE_INTERVAL === 0) {
      state.noteOrder = shuffleArray([...CHROMATIC_NOTES]);
      state.noteOrderDirty = true;
    }
    state.feedbackTimeout = setTimeout(advanceToNextPosition, 1200);

  } else {
    state.wrongAnswers.push(note);
    state.chancesLeft -= 1;

    if (state.chancesLeft > 0) {
      // Partial feedback – keep other buttons active
      state.feedbackState = 'wrong';
      updateNoteButtons();
      updateChancesDisplay();
      updateFeedbackText();

    } else {
      // No chances left – reveal answer and advance
      state.isDisabled    = true;
      state.feedbackState = 'wrong';
      state.score.total  += 1;
      updateScore();
      render();
      updateChancesDisplay();
      state.exercisesAnswered += 1;
      if (state.settings.shuffleNotes && state.exercisesAnswered % RESHUFFLE_INTERVAL === 0) {
        state.noteOrder = shuffleArray([...CHROMATIC_NOTES]);
        state.noteOrderDirty = true;
      }
      state.feedbackTimeout = setTimeout(advanceToNextPosition, 1200);
    }
  }
}

function advanceToNextPosition() {
  state.targetPosition = getRandomPosition(state.targetPosition, state.settings);
  state.feedbackState  = null;
  state.selectedNote   = null;
  state.correctNote    = null;
  state.isDisabled     = false;
  state.chancesLeft    = 3;
  state.wrongAnswers   = [];

  // Rebuild buttons if noteOrder was changed by a reshuffle
  if (state.noteOrderDirty) {
    state.noteOrderDirty = false;
    buildNoteButtons();
  }

  render();
  updateChancesDisplay();
}

function resetAndAdvance() {
  if (state.feedbackTimeout) clearTimeout(state.feedbackTimeout);
  advanceToNextPosition();
}

// ── DOM update helpers ────────────────────────────────────────────────────────

function updateNoteButtons() {
  const buttons = noteButtonsEl.querySelectorAll('.btn-note');
  buttons.forEach(btn => {
    const note = btn.dataset.note;
    btn.classList.remove('correct', 'wrong');

    // Disable: globally (terminal state) OR individually (already guessed wrong)
    btn.disabled = state.isDisabled || state.wrongAnswers.includes(note);

    // Keep all previously guessed wrong buttons red
    if (state.wrongAnswers.includes(note)) {
      btn.classList.add('wrong');
    }

    // Show correct note green on correct answer OR on final wrong (all chances used)
    if (state.correctNote && note === state.correctNote &&
        (state.feedbackState === 'correct' || (state.isDisabled && state.feedbackState === 'wrong'))) {
      btn.classList.add('correct');
    }
  });
}

function updateFeedbackText() {
  feedbackTextEl.className = 'feedback-text';

  if (state.feedbackState === 'correct') {
    feedbackTextEl.textContent = 'Richtig! ✓';
    feedbackTextEl.classList.add('correct');
  } else if (state.feedbackState === 'wrong') {
    if (state.chancesLeft > 0) {
      const v = state.chancesLeft === 1 ? 'Versuch' : 'Versuche';
      feedbackTextEl.textContent = `Falsch – noch ${state.chancesLeft} ${v}`;
      feedbackTextEl.classList.add('wrong');
    } else {
      feedbackTextEl.textContent = `Falsch! Der richtige Ton war ${state.correctNote}`;
      feedbackTextEl.classList.add('wrong');
    }
  } else {
    feedbackTextEl.textContent = '';
  }
}

function updateScore() {
  scoreCorrectEl.textContent = state.score.correct;
  scoreTotalEl.textContent   = state.score.total;
}

function updateChancesDisplay() {
  const icons = chancesDisplayEl.querySelectorAll('.chance-icon');
  const used  = 3 - state.chancesLeft;
  icons.forEach((icon, i) => {
    icon.classList.toggle('used', i < used);
  });
}
