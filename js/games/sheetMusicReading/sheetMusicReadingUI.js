export function resolveSheetMusicUI(root = document) {
  return {
    view: root.getElementById?.('view-sheet-music') ?? document.getElementById('view-sheet-music'),
    container: root.getElementById?.('score-container') ?? document.getElementById('score-container'),
    poolWarning: root.getElementById?.('sheet-music-pool-warning') ?? document.getElementById('sheet-music-pool-warning'),
    permission: root.getElementById?.('sheet-music-permission') ?? document.getElementById('sheet-music-permission'),
    status: root.getElementById?.('sheet-music-status') ?? document.getElementById('sheet-music-status'),
    currentNote: root.getElementById?.('sheet-music-current-note') ?? document.getElementById('sheet-music-current-note'),
    feedback: root.getElementById?.('sheet-music-feedback') ?? document.getElementById('sheet-music-feedback'),
    activeBtn: root.getElementById?.('btn-sheet-active-mode') ?? document.getElementById('btn-sheet-active-mode'),
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
    recordBtn:       root.getElementById?.('btn-record') ?? document.getElementById('btn-record'),
    recordStopBtn:   root.getElementById?.('btn-record-stop') ?? document.getElementById('btn-record-stop'),
    recordCancelBtn: root.getElementById?.('btn-record-cancel') ?? document.getElementById('btn-record-cancel'),
    downloadBtn:     root.getElementById?.('btn-download-recordings') ?? document.getElementById('btn-download-recordings'),
  };
}

export function syncSheetMusicUI(ui, state, syncFretSlider, syncStringToggles, updatePoolWarning) {
  syncFretSlider(ui.fretSlider, ui.fretLabel, state.settings.maxFret);
  syncStringToggles(ui.stringButtons, state.settings.activeStrings);

  if (ui.bpmSlider) ui.bpmSlider.value = String(state.bpm);
  if (ui.bpmLabel) ui.bpmLabel.textContent = String(state.bpm);
  if (ui.timeSigSelect) ui.timeSigSelect.value = state.timeSig;
  if (ui.activeBtn) ui.activeBtn.classList.toggle('active', Boolean(state.active));
  if (ui.showTabBtn) ui.showTabBtn.classList.toggle('active', state.showTab);
  if (ui.endlessBtn) ui.endlessBtn.classList.toggle('active', state.endless);

  updatePoolWarning();
}

export function setPlaybackButtonState(button, isPlaying) {
  if (!button) return;
  button.textContent = isPlaying ? '⏹ Stop' : '▶ Play';
  button.classList.toggle('active', isPlaying);
}
