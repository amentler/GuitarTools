import { CHROMATIC_NOTES, getNoteAtPosition } from '../fretboardToneRecognition/fretboardLogic.js';

export const NATURAL_NOTES = ['C', 'D', 'E', 'F', 'G', 'A', 'B'];

export function getNotePool(difficulty = 'all') {
  return difficulty === 'natural' ? [...NATURAL_NOTES] : [...CHROMATIC_NOTES];
}

export function getAllPositions(noteName, maxFret, activeStrings) {
  const positions = [];

  for (const stringIndex of activeStrings) {
    for (let fret = 0; fret <= maxFret; fret++) {
      if (getNoteAtPosition(stringIndex, fret) === noteName) {
        positions.push({ string: stringIndex, fret });
      }
    }
  }

  return positions;
}

export function positionKey(stringIndex, fret) {
  return `${stringIndex}:${fret}`;
}

export function evaluateRound(selectedKeys, correctPositions) {
  const correctKeys = new Set(correctPositions.map(pos => positionKey(pos.string, pos.fret)));

  let correct = 0;
  let wrong = 0;
  let missed = 0;

  for (const key of selectedKeys) {
    if (correctKeys.has(key)) correct += 1;
    else wrong += 1;
  }

  for (const key of correctKeys) {
    if (!selectedKeys.has(key)) missed += 1;
  }

  return { correct, wrong, missed };
}
