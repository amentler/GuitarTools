import { describe, it, expect } from 'vitest';
import {
  evaluateRound,
  getAllPositions,
  getNotePool,
  NATURAL_NOTES,
  positionKey,
} from '../../js/games/tonFinder/tonFinderLogic.js';

describe('getNotePool', () => {
  it('returns natural notes in natural mode', () => {
    expect(getNotePool('natural')).toEqual(NATURAL_NOTES);
  });

  it('returns all notes in all mode', () => {
    const pool = getNotePool('all');
    expect(pool).toContain('C#');
    expect(pool).toContain('F');
    expect(pool).toHaveLength(12);
  });
});

describe('getAllPositions', () => {
  it('finds all positions for a note in range and active strings', () => {
    const positions = getAllPositions('E', 3, [0, 1, 5]);
    expect(positions).toEqual([
      { string: 0, fret: 0 },
      { string: 5, fret: 0 },
    ]);
  });

  it('returns empty when note not present in the selected narrow range', () => {
    const positions = getAllPositions('C#', 0, [0]);
    expect(positions).toEqual([]);
  });
});

describe('evaluateRound', () => {
  it('counts correct, wrong and missed selections', () => {
    const selected = new Set(['0:0', '0:1', '5:0']);
    const correctPositions = [{ string: 0, fret: 0 }, { string: 5, fret: 2 }];
    expect(evaluateRound(selected, correctPositions)).toEqual({
      correct: 1,
      wrong: 2,
      missed: 1,
    });
  });

  it('counts all positions as missed for empty selection', () => {
    const selected = new Set();
    const correctPositions = [{ string: 1, fret: 2 }, { string: 4, fret: 0 }];

    expect(evaluateRound(selected, correctPositions)).toEqual({
      correct: 0,
      wrong: 0,
      missed: 2,
    });
  });

  it('counts only correct selections when all selected are correct', () => {
    const selected = new Set(['2:1', '3:3']);
    const correctPositions = [{ string: 2, fret: 1 }, { string: 3, fret: 3 }];

    expect(evaluateRound(selected, correctPositions)).toEqual({
      correct: 2,
      wrong: 0,
      missed: 0,
    });
  });

  it('counts only wrong selections when no selected position is correct', () => {
    const selected = new Set(['0:1', '5:3']);
    const correctPositions = [{ string: 1, fret: 0 }];

    expect(evaluateRound(selected, correctPositions)).toEqual({
      correct: 0,
      wrong: 2,
      missed: 1,
    });
  });
});

describe('positionKey', () => {
  it('formats keys as "stringIndex:fret"', () => {
    expect(positionKey(3, 7)).toBe('3:7');
    expect(positionKey(0, 0)).toBe('0:0');
  });
});
