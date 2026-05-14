import { getSetting, SETTING_KEYS } from '../../shared/globalSettings.js';

export function updateStrategyStatus() {
  const pitchKey = getSetting(SETTING_KEYS.SHEET_MUSIC_RECOGNITION_STRATEGY);
  const onsetKey = getSetting(SETTING_KEYS.SHEET_MUSIC_ONSET_STRATEGY);
  const pitchLabel = pitchKey ?? '—';
  const onsetLabel = onsetKey ?? '—';
  const pitchEl = document.getElementById('sheet-music-strategy-pitch');
  const onsetEl = document.getElementById('sheet-music-strategy-onset');
  if (pitchEl) pitchEl.textContent = pitchLabel;
  if (onsetEl) onsetEl.textContent = onsetLabel;
}

export function updateCurrentNoteDisplay(ui, state, note) {
  if (!ui?.currentNote) return;
  if (!state.active) {
    ui.currentNote.textContent = '–';
    return;
  }
  if (note) {
    ui.currentNote.textContent = `${note.name}${note.octave}`;
  } else if (state.currentBarIndex === -1) {
    ui.currentNote.textContent = '✓';
  } else {
    ui.currentNote.textContent = '–';
  }
}

export function updateFeedback(ui, state, kind = null, text = '') {
  if (!ui?.feedback) return;
  ui.feedback.className = 'feedback-text';
  if (!state.active) {
    ui.feedback.textContent = '';
    return;
  }
  if (kind === 'correct') {
    ui.feedback.textContent = text || 'Richtig! ✓';
    ui.feedback.classList.add('correct');
    return;
  }
  if (kind === 'wrong') {
    ui.feedback.textContent = text || 'Falsch!';
    ui.feedback.classList.add('wrong');
    return;
  }
  ui.feedback.textContent = text;
}

export function syncActiveUiVisibility(ui, state) {
  if (!ui?.status || !ui?.permission) return;
  ui.status.classList.toggle('u-hidden', !state.active);
  if (!state.active) {
    ui.permission.classList.add('u-hidden');
  }
}

export function getBeatCount(timeSig) {
  return parseInt(timeSig.split('/')[0], 10) || 4;
}

export function renderBeatDots(ui, timeSig) {
  const container = ui?.beatIndicator;
  if (!container) return;
  const count = getBeatCount(timeSig);
  container.innerHTML = '';
  for (let i = 0; i < count; i++) {
    const dot = document.createElement('span');
    dot.className = 'beat-dot';
    container.appendChild(dot);
  }
}

export function updateBeatDot(ui, beatIndex) {
  const container = ui?.beatIndicator;
  if (!container) return;
  const dots = container.querySelectorAll('.beat-dot');
  dots.forEach((dot, i) => {
    dot.classList.toggle('beat-dot--active', i === beatIndex);
  });
}

export function clearBeatDots(ui) {
  const container = ui?.beatIndicator;
  if (!container) return;
  container.querySelectorAll('.beat-dot').forEach(dot => dot.classList.remove('beat-dot--active'));
}

export async function enumerateAndShowMics(ui) {
  if (!globalThis.navigator?.mediaDevices?.enumerateDevices) return;
  try {
    const devices = await globalThis.navigator.mediaDevices.enumerateDevices();
    const mics = devices.filter(d => d.kind === 'audioinput');
    if (mics.length <= 1) return;
    const { micPanel, micSelect } = ui ?? {};
    if (!micPanel || !micSelect) return;
    const prevValue = micSelect.value;
    micSelect.innerHTML = '';
    for (let i = 0; i < mics.length; i++) {
      const opt = document.createElement('option');
      opt.value = mics[i].deviceId;
      opt.textContent = mics[i].label || `Mikrofon ${i + 1}`;
      micSelect.appendChild(opt);
    }
    if (prevValue) micSelect.value = prevValue;
    micPanel.classList.remove('u-hidden');
  } catch { /* permission denied or API unavailable */ }
}

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
    analyseBtn:      root.getElementById?.('btn-analyse-recording') ?? document.getElementById('btn-analyse-recording'),
    recordingsBtn:   root.getElementById?.('btn-open-recordings') ?? document.getElementById('btn-open-recordings'),
    micPanel:        root.getElementById?.('mic-select-panel') ?? document.getElementById('mic-select-panel'),
    micSelect:       root.getElementById?.('sheet-music-mic-select') ?? document.getElementById('sheet-music-mic-select'),
    beatIndicator:   root.getElementById?.('beat-indicator') ?? document.getElementById('beat-indicator'),
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
