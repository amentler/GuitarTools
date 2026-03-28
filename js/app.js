// App navigation – controls which view is visible

import { startExercise, stopExercise } from './fretboardExercise.js';

const views = {
  menu:       document.getElementById('view-menu'),
  fretboard:  document.getElementById('view-fretboard'),
};

function showView(name) {
  for (const [key, el] of Object.entries(views)) {
    el.classList.toggle('active', key === name);
  }
}

function navigateTo(name) {
  if (name === 'fretboard') {
    showView('fretboard');
    startExercise();
  } else {
    stopExercise();
    showView('menu');
  }
}

// ── Wire up buttons ──────────────────────────────────────────────────────────

document.getElementById('btn-start-fretboard').addEventListener('click', () => {
  navigateTo('fretboard');
});

document.getElementById('btn-back').addEventListener('click', () => {
  navigateTo('menu');
});

// ── Initial view ─────────────────────────────────────────────────────────────
showView('menu');
