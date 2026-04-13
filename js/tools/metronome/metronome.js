/**
 * Main controller for the metronome tool.
 * Handles DOM events, state management, and persistence.
 */

import { registerExercise } from '../../exerciseRegistry.js';
import { MetronomeLogic } from './metronomeLogic.js';
import { MetronomeSVG } from './metronomeSVG.js';

export function createMetronomeExercise() {
  let logic = null;
  let svg = null;

  // DOM Elements
  let bpmDisplay = null;
  let bpmSlider = null;
  let startStopBtn = null;
  let beatsSelector = null;

  function startExercise() {
    if (!logic) {
      logic = new MetronomeLogic();
      svg = new MetronomeSVG('metronome-display');

      // Initialize logic on first user interaction
      logic.init();

      // Cache DOM elements
      bpmDisplay = document.getElementById('metronome-bpm-value');
      bpmSlider = document.getElementById('metronome-bpm-slider');
      startStopBtn = document.getElementById('btn-metronome-toggle');
      beatsSelector = document.getElementById('metronome-beats-select');

      // Restore state from localStorage
      const savedBpm = localStorage.getItem('metronome_bpm');
      if (savedBpm) {
        logic.setBpm(parseInt(savedBpm));
        bpmSlider.value = savedBpm;
        bpmDisplay.textContent = savedBpm;
      }

      const savedBeats = localStorage.getItem('metronome_beats');
      if (savedBeats) {
        logic.setBeatsPerMeasure(parseInt(savedBeats));
        beatsSelector.value = savedBeats;
      }

      // Set up callbacks
      logic.onBeat = (beatNumber) => {
        svg.highlightBeat(beatNumber);
      };

      // Event Listeners
      setupEventListeners();
    }

    svg.render(logic.beatsPerMeasure);
  }

  function stopExercise() {
    if (logic && logic.isPlaying) {
      toggleMetronome();
    }
  }

  function setupEventListeners() {
    // BPM Slider
    bpmSlider.addEventListener('input', (e) => {
      const bpm = parseInt(e.target.value);
      updateBpm(bpm);
    });

    // BPM Buttons
    document.getElementById('btn-metronome-minus-5').addEventListener('click', () => adjustBpm(-5));
    document.getElementById('btn-metronome-minus-1').addEventListener('click', () => adjustBpm(-1));
    document.getElementById('btn-metronome-plus-1').addEventListener('click', () => adjustBpm(1));
    document.getElementById('btn-metronome-plus-5').addEventListener('click', () => adjustBpm(5));

    // Start/Stop
    startStopBtn.addEventListener('click', () => toggleMetronome());

    // Beats per Measure
    beatsSelector.addEventListener('change', (e) => {
      const beats = parseInt(e.target.value);
      logic.setBeatsPerMeasure(beats);
      svg.render(beats);
      localStorage.setItem('metronome_beats', beats);
    });
  }

  function updateBpm(bpm) {
    logic.setBpm(bpm);
    bpmDisplay.textContent = bpm;
    bpmSlider.value = bpm;
    localStorage.setItem('metronome_bpm', bpm);
  }

  function adjustBpm(delta) {
    const newBpm = logic.bpm + delta;
    updateBpm(newBpm);
  }

  function toggleMetronome() {
    if (logic.isPlaying) {
      logic.stop();
      startStopBtn.textContent = 'Start';
      startStopBtn.classList.remove('playing');
    } else {
      logic.start();
      startStopBtn.textContent = 'Stop';
      startStopBtn.classList.add('playing');
    }
  }

  return { startExercise, stopExercise };
}

// ── Self-registration ─────────────────────────────────────────────────────────
const metronomeExercise = createMetronomeExercise();
registerExercise('metronome', {
  viewId: 'view-metronome',
  btnStartId: 'btn-start-metronome',
  btnBackId: 'btn-back-metronome',
  start: metronomeExercise.startExercise,
  stop: metronomeExercise.stopExercise,
});
