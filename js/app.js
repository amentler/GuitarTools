// App navigation – controls which view is visible

import { startExercise as startFretboard, stopExercise as stopFretboard } from './games/fretboardToneRecognition/fretboardExercise.js';
import { startExercise as startTuner,    stopExercise as stopTuner    } from './tools/guitarTuner/guitarTuner.js';

const views = {
  menu:      document.getElementById('view-menu'),
  fretboard: document.getElementById('view-fretboard'),
  tuner:     document.getElementById('view-tuner'),
};

let currentView = 'menu';

function showView(name) {
  for (const [key, el] of Object.entries(views)) {
    el.classList.toggle('active', key === name);
  }
}

function navigateTo(name) {
  // Stop whatever is running
  if (currentView === 'fretboard') stopFretboard();
  if (currentView === 'tuner')     stopTuner();

  currentView = name;
  showView(name);

  if (name === 'fretboard') startFretboard();
  if (name === 'tuner')     startTuner();
}

// ── Wire up buttons ──────────────────────────────────────────────────────────

document.getElementById('btn-start-fretboard').addEventListener('click', () => navigateTo('fretboard'));
document.getElementById('btn-back').addEventListener('click',             () => navigateTo('menu'));

document.getElementById('btn-start-tuner').addEventListener('click',  () => navigateTo('tuner'));
document.getElementById('btn-back-tuner').addEventListener('click',   () => navigateTo('menu'));

// ── Initial view ─────────────────────────────────────────────────────────────
showView('menu');
