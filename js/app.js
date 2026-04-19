// App navigation – generic, zero hardcoded if/else chains.
// Each exercise self-registers via registerExercise().
// This module dynamically imports all exercises and wires buttons.

import './components/index.js';
import { getExercise, getAllExercises } from './exerciseRegistry.js';

// Dynamic imports – each module calls registerExercise() on load.
// The keys match the view identifiers used in index.html and hash routes.
const EXERCISE_MODULES = [
  { key: 'chordExerciseEssentia', path: './games/chordExerciseEssentia/chordExerciseEssentia.js' },
  { key: 'akkordfolgenTrainer',    path: './games/akkordfolgenTrainer/akkordfolgenTrainer.js' },
];

const views = {
  menu: document.getElementById('view-menu'),
};

let currentKey = 'menu';
const supportsHistory = typeof window !== 'undefined' && !!window.history;

function showView(key) {
  // Hide all views
  for (const el of Object.values(views)) {
    el.classList.remove('active');
  }
  // Show target
  const viewEl = key === 'menu'
    ? views.menu
    : views[getExercise(key)?.viewId];
  if (viewEl) viewEl.classList.add('active');
}

async function navigateTo(key, { fromHistory = false } = {}) {
  // Stop whatever is running
  getExercise(currentKey)?.stop();

  currentKey = key;
  showView(key);

  // Start the new exercise
  getExercise(key)?.start();

  if (!fromHistory && supportsHistory) {
    const hash = `#${key}`;
    const state = { view: key };
    if (key === 'menu') window.history.replaceState(state, '', hash);
    else window.history.pushState(state, '', hash);
  }
}

async function loadVersionInfo() {
  const versionEl = document.getElementById('app-version');
  try {
    const versionUrl = new URL('../version.txt', import.meta.url);
    const response = await fetch(versionUrl, { cache: 'no-store' });
    if (!response.ok) throw new Error('Version file not available');
    versionEl.textContent = (await response.text()).trim();
  } catch {
    versionEl.textContent = 'Version unbekannt';
  }
}

// ── Initialization ───────────────────────────────────────────────────────────

// Wait for all exercise modules to load before initializing the app
const moduleLoads = EXERCISE_MODULES.map(m => import(m.path));
await Promise.all(moduleLoads);

// Now that all modules are loaded and have registered themselves:
// 1. Build views map
for (const [, meta] of getAllExercises()) {
  const el = document.getElementById(meta.viewId);
  if (el) views[meta.viewId] = el;
}

// 2. Wire up buttons
for (const [key, meta] of getAllExercises()) {
  const startBtn = document.getElementById(meta.btnStartId);
  const backBtn  = document.getElementById(meta.btnBackId);

  if (startBtn) startBtn.addEventListener('click', () => navigateTo(key));
  if (backBtn)  backBtn.addEventListener('click', () => navigateTo('menu'));
}

// 3. Initialize history and version info
loadVersionInfo();
if (supportsHistory) {
  window.history.replaceState({ view: 'menu' }, '', '#menu');
  window.addEventListener('popstate', (event) => {
    const view = event?.state?.view;
    if (view && getExercise(view)) navigateTo(view, { fromHistory: true });
    else navigateTo('menu', { fromHistory: true });
  });
}
showView('menu');
