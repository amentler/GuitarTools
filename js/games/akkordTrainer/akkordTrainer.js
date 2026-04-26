/**
 * akkordTrainer.js
 * Main controller for the Chord Trainer game.
 * Uses <gt-fretboard> component.
 */

import { getRandomChord, validateChord } from './akkordLogic.js';

export function createAkkordTrainerFeature() {
  // State (per-instance)
  let currentChord = null;
  let userPositions = []; // Array<{string, fret, muted}>
  let feedback = null;
  let score = { correct: 0, total: 0 };
  let rootElement = null;
  
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
      const cb = rootElement?.querySelector(`#${id}`);
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

  function query(selector) {
    return rootElement?.querySelector(selector) ?? null;
  }

  function nextRound() {
    currentChord = getRandomChord(getActiveCategories());
    userPositions = getDefaultStringPositions();
    feedback = null;

    // UI Update
    query('#chord-name-display').textContent = currentChord.name;
    query('#chord-feedback-text').textContent = 'Trage den Akkord ein...';
    query('#chord-feedback-text').className = 'feedback-text';
    query('#btn-chord-check').disabled = false;

    draw();
  }

  function draw() {
    const fretboard = query('#chord-fretboard');
    if (!fretboard) return;

    const positions = [];
    
    // Convert user positions to component format
    userPositions.forEach(pos => {
      const state = feedback || 'selected';
      positions.push({
        stringIndex: pos.string - 1,
        fret: pos.muted ? 0 : pos.fret,
        state: pos.muted ? 'muted' : state
      });
    });

    // If wrong, overlay reference positions as "missed" if they aren't in userPositions
    if (feedback === 'wrong' && currentChord) {
      currentChord.positions.forEach(ref => {
        const alreadyShown = userPositions.some(up => 
          up.string === ref.string && 
          up.fret === ref.fret && 
          up.muted === ref.muted
        );
        if (!alreadyShown) {
          positions.push({
            stringIndex: ref.string - 1,
            fret: ref.muted ? 0 : ref.fret,
            state: ref.muted ? 'muted' : 'missed'
          });
        }
      });
    }

    fretboard.positions = positions;
  }

  /**
   * Handles clicking on the diagram to place/remove markers.
   */
  function handleTogglePosition(stringIndex, fret) {
    if (feedback) return; // Disable interaction during feedback phase
    
    const string = stringIndex + 1;
    const existingIdx = userPositions.findIndex(p => p.string === string);
    if (existingIdx < 0) return;

    if (fret === 0) {
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
    query('#btn-chord-check').disabled = true;

    score.total++;
    if (isCorrect) {
      score.correct++;
      query('#chord-feedback-text').textContent = 'Richtig! Gut gemacht.';
      query('#chord-feedback-text').className = 'feedback-text feedback-correct';
    } else {
      query('#chord-feedback-text').textContent = 'Nicht ganz richtig. Schau dir die Lösung an.';
      query('#chord-feedback-text').className = 'feedback-text feedback-wrong';
    }

    updateScoreUI();
    draw();

    // Wait before next round
    setTimeout(() => {
      if (rootElement?.classList.contains('active')) {
        nextRound();
      }
    }, isCorrect ? 1500 : 3000);
  }

  function updateScoreUI() {
    const scoreCorrect = query('#score-correct');
    const scoreTotal = query('#score-total');
    if (scoreCorrect) scoreCorrect.textContent = score.correct;
    if (scoreTotal) scoreTotal.textContent = score.total;
  }

  function mount(root = document) {
    rootElement = root;
    score = { correct: 0, total: 0 };
    updateScoreUI();
    
    const fretboard = query('#chord-fretboard');
    if (fretboard && !fretboard.dataset.gtBound) {
      fretboard.addEventListener('fret-select', (e) => {
        handleTogglePosition(e.detail.stringIndex, e.detail.fret);
      });
      fretboard.dataset.gtBound = 'true';
    }

    const btnCheck = query('#btn-chord-check');
    if (btnCheck && !btnCheck.dataset.gtBound) {
      btnCheck.addEventListener('click', handleCheck);
      btnCheck.dataset.gtBound = 'true';
    }

    nextRound();
  }

  function unmount() {
    currentChord = null;
    userPositions = [];
    feedback = null;
    rootElement = null;
  }

  return {
    mount,
    unmount,
    startExercise: mount,
    stopExercise: unmount,
  };
}

export const createAkkordExercise = createAkkordTrainerFeature;
