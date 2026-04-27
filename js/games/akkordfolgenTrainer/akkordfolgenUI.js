export function resolveAkkordfolgenUI() {
  return {
    view: document.getElementById('view-akkordfolgen-trainer'),
    setup: document.getElementById('aft-setup'),
    active: document.getElementById('aft-active'),
    summary: document.getElementById('aft-summary'),

    keySelect: document.getElementById('aft-key-select'),
    progressionList: document.getElementById('aft-progression-list'),
    randomBtn: document.getElementById('aft-random-btn'),
    bpmSlider: document.getElementById('aft-bpm-slider'),
    bpmLabel: document.getElementById('aft-bpm-label'),
    bpmMinus5: document.getElementById('aft-bpm-minus5'),
    bpmMinus1: document.getElementById('aft-bpm-minus1'),
    bpmPlus1: document.getElementById('aft-bpm-plus1'),
    bpmPlus5: document.getElementById('aft-bpm-plus5'),
    beatsSelect: document.getElementById('aft-beats-select'),
    startBtn: document.getElementById('aft-start-btn'),

    progressionDisplay: document.getElementById('aft-progression-display'),
    currentChordName: document.getElementById('aft-current-chord-name'),
    currentNumeral: document.getElementById('aft-current-numeral'),
    chordDiagram: document.getElementById('aft-chord-fretboard'),
    beatDots: document.getElementById('aft-beat-dots'),
    feedback: document.getElementById('aft-feedback'),
    stopBtn: document.getElementById('aft-stop-btn'),

    summaryTime: document.getElementById('aft-summary-time'),
    summaryPlayed: document.getElementById('aft-summary-played'),
    summaryMissed: document.getElementById('aft-summary-missed'),
    summaryRounds: document.getElementById('aft-summary-rounds'),
    againBtn: document.getElementById('aft-again-btn'),
    newBtn: document.getElementById('aft-new-btn'),

    permission: document.getElementById('aft-permission'),
  };
}

export function showAkkordfolgenSetup(ui) {
  ui.setup.classList.remove('u-hidden');
  ui.active.classList.add('u-hidden');
  ui.summary.classList.add('u-hidden');
}

export function showAkkordfolgenActive(ui) {
  ui.setup.classList.add('u-hidden');
  ui.active.classList.remove('u-hidden');
  ui.summary.classList.add('u-hidden');
}

export function showAkkordfolgenSummary(ui) {
  ui.setup.classList.add('u-hidden');
  ui.active.classList.add('u-hidden');
  ui.summary.classList.remove('u-hidden');
}

export function setAkkordfolgenFeedback(ui, text, kind) {
  if (!ui.feedback) return;
  ui.feedback.textContent = text;
  ui.feedback.className = 'feedback-text';
  if (kind === 'correct') ui.feedback.classList.add('feedback-correct');
  else if (kind === 'wrong') ui.feedback.classList.add('feedback-wrong');
}
