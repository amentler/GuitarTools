// App navigation – controls which view is visible

import './components/index.js';
import { startExercise as startFretboard,   stopExercise as stopFretboard   } from './games/fretboardToneRecognition/fretboardExercise.js';
import { startExercise as startTuner,       stopExercise as stopTuner       } from './tools/guitarTuner/guitarTuner.js';
import { startExercise as startSheetMusic,  stopExercise as stopSheetMusic  } from './games/sheetMusicReading/sheetMusicReading.js';
import { startExercise as startMetronome,   stopExercise as stopMetronome   } from './tools/metronome/metronome.js';
import { startExercise as startAkkord,      stopExercise as stopAkkord      } from './games/akkordTrainer/akkordTrainer.js';
import { startExercise as startTonFinder,   stopExercise as stopTonFinder   } from './games/tonFinder/tonFinder.js';
import { startExercise as startNotePlaying, stopExercise as stopNotePlaying } from './games/notePlayingExercise/notePlayingExercise.js';

const views = {
  menu:        document.getElementById('view-menu'),
  fretboard:   document.getElementById('view-fretboard'),
  tuner:       document.getElementById('view-tuner'),
  sheetMusic:  document.getElementById('view-sheet-music'),
  metronome:   document.getElementById('view-metronome'),
  akkord:      document.getElementById('view-akkord-trainer'),
  tonFinder:   document.getElementById('view-ton-finder'),
  notePlaying: document.getElementById('view-note-play'),
};

let currentView = 'menu';

function showView(name) {
  for (const [key, el] of Object.entries(views)) {
    el.classList.toggle('active', key === name);
  }
}

function navigateTo(name) {
  // Stop whatever is running
  if (currentView === 'fretboard')   stopFretboard();
  if (currentView === 'tuner')       stopTuner();
  if (currentView === 'sheetMusic')  stopSheetMusic();
  if (currentView === 'metronome')   stopMetronome();
  if (currentView === 'akkord')      stopAkkord();
  if (currentView === 'tonFinder')   stopTonFinder();
  if (currentView === 'notePlaying') stopNotePlaying();

  currentView = name;
  showView(name);

  if (name === 'fretboard')   startFretboard();
  if (name === 'tuner')       startTuner();
  if (name === 'sheetMusic')  startSheetMusic();
  if (name === 'metronome')   startMetronome();
  if (name === 'akkord')      startAkkord();
  if (name === 'tonFinder')   startTonFinder();
  if (name === 'notePlaying') startNotePlaying();
}

// ── Wire up buttons ──────────────────────────────────────────────────────────

document.getElementById('btn-start-fretboard').addEventListener('click', () => navigateTo('fretboard'));
document.getElementById('btn-back').addEventListener('click',             () => navigateTo('menu'));

document.getElementById('btn-start-tuner').addEventListener('click',       () => navigateTo('tuner'));
document.getElementById('btn-back-tuner').addEventListener('click',        () => navigateTo('menu'));

document.getElementById('btn-start-sheet-music').addEventListener('click', () => navigateTo('sheetMusic'));
document.getElementById('btn-back-sheet-music').addEventListener('click',  () => navigateTo('menu'));

document.getElementById('btn-start-metronome').addEventListener('click',   () => navigateTo('metronome'));
document.getElementById('btn-back-metronome').addEventListener('click',    () => navigateTo('menu'));

document.getElementById('btn-start-akkord-trainer').addEventListener('click', () => navigateTo('akkord'));
document.getElementById('btn-back-akkord-trainer').addEventListener('click',  () => navigateTo('menu'));

document.getElementById('btn-start-ton-finder').addEventListener('click', () => navigateTo('tonFinder'));
document.getElementById('btn-back-ton-finder').addEventListener('click',  () => navigateTo('menu'));

document.getElementById('btn-start-note-play').addEventListener('click', () => navigateTo('notePlaying'));
document.getElementById('btn-back-note-play').addEventListener('click',  () => navigateTo('menu'));

// ── Initial view ─────────────────────────────────────────────────────────────
async function loadVersionInfo() {
  const versionEl = document.getElementById('app-version');
  try {
    const response = await fetch('./version.txt', { cache: 'no-store' });
    if (!response.ok) throw new Error('Version file not available');
    versionEl.textContent = (await response.text()).trim();
  } catch {
    versionEl.textContent = 'Version unbekannt';
  }
}

loadVersionInfo();
showView('menu');
