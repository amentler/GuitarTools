export function resolveSheetMusicMicUI(root = document) {
  return {
    view: root.getElementById?.('view-sheet-mic') ?? document.getElementById('view-sheet-mic'),
    permission: root.getElementById?.('sheet-mic-permission') ?? document.getElementById('sheet-mic-permission'),
    scoreEl: root.getElementById?.('score-value') ?? document.getElementById('score-value'),
    container: root.getElementById?.('sheet-mic-score-container') ?? document.getElementById('sheet-mic-score-container'),
    newBarsBtn: root.getElementById?.('sheet-mic-new-bars') ?? document.getElementById('sheet-mic-new-bars'),
    endlessBtn: root.getElementById?.('sheet-mic-endless-mode') ?? document.getElementById('sheet-mic-endless-mode'),
    feedback: root.getElementById?.('sheet-mic-feedback') ?? document.getElementById('sheet-mic-feedback'),
    currentNote: root.getElementById?.('sheet-mic-current-note') ?? document.getElementById('sheet-mic-current-note'),
    debugPanel: root.getElementById?.('sheet-mic-debug') ?? document.getElementById('sheet-mic-debug'),
    debugOutput: root.getElementById?.('sheet-mic-debug-output') ?? document.getElementById('sheet-mic-debug-output'),
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
  if (ui.endlessBtn) ui.endlessBtn.classList.toggle('active', state.endless);
}
