// Guitar Tuner – main controller
// Exports startExercise() and stopExercise() to match the app navigation contract.

import { detectPitch, frequencyToNote, isStandardTuningNote, pushAndMedian } from './tunerLogic.js';
import { initTunerSVG, updateTunerDisplay } from './tunerSVG.js';

// ── Module-level audio resources ──────────────────────────────────────────────
let audioCtx  = null;
let analyser  = null;
let stream    = null;
let intervalId = null;
let modeWired = false;

const freqHistory = [];

let state = {
  mode:    'standard', // 'standard' | 'chromatic'
  note:    null,
  octave:  null,
  cents:   0,
  isActive: false,
};

// ── Public lifecycle ──────────────────────────────────────────────────────────

export async function startExercise() {
  // Resolve DOM
  const display    = document.getElementById('tuner-display');
  const permission = document.getElementById('tuner-permission');

  // Build SVG gauge (idempotent – clears container first)
  initTunerSVG(display);

  // Reset state (preserve mode)
  freqHistory.length = 0;
  state.note    = null;
  state.octave  = null;
  state.cents   = 0;
  state.isActive = false;

  updateTunerDisplay({ cents: 0, note: null, octave: null, isActive: false, isInTune: false, isStandardNote: false });

  // Wire mode buttons once
  if (!modeWired) {
    const btnStandard   = document.getElementById('btn-mode-standard');
    const btnChromatic  = document.getElementById('btn-mode-chromatic');

    btnStandard.addEventListener('click', () => {
      state.mode = 'standard';
      btnStandard.classList.add('active');
      btnChromatic.classList.remove('active');
    });

    btnChromatic.addEventListener('click', () => {
      state.mode = 'chromatic';
      btnChromatic.classList.add('active');
      btnStandard.classList.remove('active');
    });

    modeWired = true;
  }

  // Sync mode button UI to current state
  document.getElementById('btn-mode-standard').classList.toggle('active', state.mode === 'standard');
  document.getElementById('btn-mode-chromatic').classList.toggle('active', state.mode === 'chromatic');

  // Request microphone
  permission.style.display = 'block';
  permission.textContent = 'Mikrofon-Zugriff wird benötigt…';

  try {
    stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
  } catch {
    permission.textContent = 'Mikrofon nicht verfügbar. Bitte Zugriff erlauben.';
    return;
  }

  permission.style.display = 'none';

  audioCtx = new AudioContext();
  analyser = audioCtx.createAnalyser();
  analyser.fftSize = 2048;
  audioCtx.createMediaStreamSource(stream).connect(analyser);

  state.isActive = true;
  intervalId = setInterval(analyzeFrame, 100);
}

export function stopExercise() {
  clearInterval(intervalId);
  intervalId = null;

  if (stream) {
    stream.getTracks().forEach(t => t.stop());
    stream = null;
  }

  if (audioCtx) {
    audioCtx.close();
    audioCtx = null;
    analyser = null;
  }

  state.isActive = false;
  freqHistory.length = 0;

  updateTunerDisplay({ cents: 0, note: null, octave: null, isActive: false, isInTune: false, isStandardNote: false });
}

// ── Pitch analysis frame ──────────────────────────────────────────────────────

function analyzeFrame() {
  if (!analyser) return;

  const buffer = new Float32Array(analyser.fftSize);
  analyser.getFloatTimeDomainData(buffer);

  const hz = detectPitch(buffer, audioCtx.sampleRate);

  if (hz === null) {
    // Silence: clear display but keep needle centred
    updateTunerDisplay({ cents: 0, note: null, octave: null, isActive: true, isInTune: false, isStandardNote: false });
    return;
  }

  const medianHz = pushAndMedian(freqHistory, hz);
  const { note, octave, cents } = frequencyToNote(medianHz);

  const isInTune    = Math.abs(cents) <= 8;
  const isStdNote   = isStandardTuningNote(note, octave);
  const isStandardNote = state.mode === 'standard' ? isStdNote : true;

  updateTunerDisplay({ cents, note, octave, isActive: true, isInTune, isStandardNote });
}
