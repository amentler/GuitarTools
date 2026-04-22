export function resolveSheetMusicMicUI(root = document) {
  return {
    permission: root.getElementById?.('sheet-mic-permission') ?? document.getElementById('sheet-mic-permission'),
    scoreEl: root.getElementById?.('score-value') ?? document.getElementById('score-value'),
    container: root.getElementById?.('sheet-mic-score-container') ?? document.getElementById('sheet-mic-score-container'),
    startBtn: root.getElementById?.('sheet-mic-start-btn') ?? document.getElementById('sheet-mic-start-btn'),
    stopBtn: root.getElementById?.('sheet-mic-stop-btn') ?? document.getElementById('sheet-mic-stop-btn'),
    newBarsBtn: root.getElementById?.('sheet-mic-new-bars') ?? document.getElementById('sheet-mic-new-bars'),
    feedback: root.getElementById?.('sheet-mic-feedback') ?? document.getElementById('sheet-mic-feedback'),
    currentNote: root.getElementById?.('sheet-mic-current-note') ?? document.getElementById('sheet-mic-current-note'),
    modeSelect: root.getElementById?.('sheet-mic-mode') ?? document.getElementById('sheet-mic-mode'),
    slider: root.getElementById?.('sheet-mic-fret-slider') ?? document.getElementById('sheet-mic-fret-slider'),
    sliderLabel: root.getElementById?.('sheet-mic-fret-label') ?? document.getElementById('sheet-mic-fret-label'),
    stringButtons: document.querySelectorAll('#sheet-mic-string-toggles .btn-string'),
  };
}

export function syncSheetMusicMicUI(ui, state, syncFretSlider, syncStringToggles) {
  syncFretSlider(ui.slider, ui.sliderLabel, state.settings.maxFret);
  syncStringToggles(ui.stringButtons, state.settings.activeStrings);
  ui.modeSelect.value = state.mode;
}

export function setMicListeningUI(ui, isListening) {
  ui.startBtn.style.display = isListening ? 'none' : 'inline-block';
  ui.stopBtn.style.display = isListening ? 'inline-block' : 'none';
}
