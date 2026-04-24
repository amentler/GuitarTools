import { describe, it, expect } from 'vitest';
import { evaluateAnswer, initGameState } from '../../js/games/fretboardToneRecognition/fretboardLogic.js';

describe('fretboardToneRecognitionLogic', () => {
  describe('initGameState', () => {
    it('should initialize with 3 chances and zero score', () => {
      const settings = { maxFret: 4, activeStrings: [0, 1, 2, 3, 4, 5] };
      const state = initGameState(settings);
      expect(state.chancesLeft).toBe(3);
      expect(state.score.correct).toBe(0);
      expect(state.score.total).toBe(0);
      expect(state.wrongAnswers).toEqual([]);
      expect(state.isDisabled).toBe(false);
    });
  });

  describe('evaluateAnswer', () => {
    const correctNote = 'C';

    it('should handle correct answer on first try', () => {
      const state = {
        chancesLeft: 3,
        score: { correct: 0, total: 0 },
        wrongAnswers: [],
        isDisabled: false
      };

      const result = evaluateAnswer(state, 'C', correctNote);

      expect(result.isCorrect).toBe(true);
      expect(result.newState.score.correct).toBe(1);
      expect(result.newState.score.total).toBe(1);
      expect(result.newState.isDisabled).toBe(true);
      expect(result.newState.feedbackState).toBe('correct');
    });

    it('should handle wrong answer with chances left', () => {
      const state = {
        chancesLeft: 3,
        score: { correct: 0, total: 0 },
        wrongAnswers: [],
        isDisabled: false
      };

      const result = evaluateAnswer(state, 'D', correctNote);

      expect(result.isCorrect).toBe(false);
      expect(result.newState.chancesLeft).toBe(2);
      expect(result.newState.wrongAnswers).toContain('D');
      expect(result.newState.isDisabled).toBe(false);
      expect(result.newState.feedbackState).toBe('wrong');
    });

    it('should handle last wrong answer and reveal result', () => {
      const state = {
        chancesLeft: 1,
        score: { correct: 0, total: 0 },
        wrongAnswers: ['E', 'F'],
        isDisabled: false
      };

      const result = evaluateAnswer(state, 'G', correctNote);

      expect(result.isCorrect).toBe(false);
      expect(result.newState.chancesLeft).toBe(0);
      expect(result.newState.score.total).toBe(1);
      expect(result.newState.isDisabled).toBe(true);
      expect(result.newState.feedbackState).toBe('wrong');
    });
  });
});
