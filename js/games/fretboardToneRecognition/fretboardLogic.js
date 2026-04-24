export * from '../../domain/fretboard/fretboardLogic.js';

/**
 * Initializes the game state.
 */
export function initGameState(settings) {
  return {
    chancesLeft: 3,
    score: { correct: 0, total: 0 },
    wrongAnswers: [],
    isDisabled: false,
    feedbackState: null,
    selectedNote: null,
    correctNote: null,
    settings: { ...settings }
  };
}

/**
 * Evaluates a given answer against the correct note.
 * Returns { isCorrect, newState }
 */
export function evaluateAnswer(state, selectedNote, correctNote) {
  const isCorrect = selectedNote === correctNote;
  const newState = { ...state, wrongAnswers: [...state.wrongAnswers] };

  if (isCorrect) {
    newState.isCorrect = true;
    newState.isDisabled = true;
    newState.feedbackState = 'correct';
    newState.score.correct += 1;
    newState.score.total += 1;
    return { isCorrect: true, newState };
  } else {
    newState.wrongAnswers.push(selectedNote);
    newState.chancesLeft -= 1;

    if (newState.chancesLeft > 0) {
      newState.feedbackState = 'wrong';
      return { isCorrect: false, newState };
    } else {
      newState.isDisabled = true;
      newState.feedbackState = 'wrong';
      newState.score.total += 1;
      return { isCorrect: false, newState };
    }
  }
}
