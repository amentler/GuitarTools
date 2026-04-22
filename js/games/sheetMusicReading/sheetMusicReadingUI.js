export function resolveSheetMusicUI(root = document) {
  return {
    view: root.getElementById?.('view-sheet-music') ?? document.getElementById('view-sheet-music'),
    container: root.getElementById?.('score-container') ?? document.getElementById('score-container'),
    poolWarning: root.getElementById?.('sheet-music-pool-warning') ?? document.getElementById('sheet-music-pool-warning'),
    newBarsBtn: root.getElementById?.('btn-new-bars') ?? document.getElementById('btn-new-bars'),
    showTabBtn: root.getElementById?.('btn-show-tab') ?? document.getElementById('btn-show-tab'),
    endlessBtn: root.getElementById?.('btn-endless-mode') ?? document.getElementById('btn-endless-mode'),
    playBtn: root.getElementById?.('btn-sheet-play') ?? document.getElementById('btn-sheet-play'),
    bpmSlider: root.getElementById?.('sheet-music-bpm-slider') ?? document.getElementById('sheet-music-bpm-slider'),
    bpmLabel: root.getElementById?.('sheet-music-bpm-label') ?? document.getElementById('sheet-music-bpm-label'),
    timeSigSelect: root.getElementById?.('sheet-music-time-sig') ?? document.getElementById('sheet-music-time-sig'),
    fretSlider: root.getElementById?.('sheet-music-fret-range-slider') ?? document.getElementById('sheet-music-fret-range-slider'),
    fretLabel: root.getElementById?.('sheet-music-fret-range-label') ?? document.getElementById('sheet-music-fret-range-label'),
    stringButtons: document.querySelectorAll('#sheet-music-string-toggles .btn-string'),
  };
}

export function syncSheetMusicUI(ui, state, syncFretSlider, syncStringToggles, updatePoolWarning) {
  syncFretSlider(ui.fretSlider, ui.fretLabel, state.settings.maxFret);
  syncStringToggles(ui.stringButtons, state.settings.activeStrings);

  if (ui.bpmSlider) ui.bpmSlider.value = String(state.bpm);
  if (ui.bpmLabel) ui.bpmLabel.textContent = String(state.bpm);
  if (ui.timeSigSelect) ui.timeSigSelect.value = state.timeSig;
  if (ui.showTabBtn) ui.showTabBtn.classList.toggle('active', state.showTab);
  if (ui.endlessBtn) ui.endlessBtn.classList.toggle('active', state.endless);

  updatePoolWarning();
}

export function setPlaybackButtonState(button, isPlaying) {
  if (!button) return;
  button.textContent = isPlaying ? '⏹ Stop' : '▶ Play';
  button.classList.toggle('active', isPlaying);
}
