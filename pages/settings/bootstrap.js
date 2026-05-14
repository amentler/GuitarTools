import '../../js/components/index.js';
import { registerServiceWorker, forceAppReload } from '../../js/shared/pwa/sw-client.js';
import { createGlobalDebugStore } from '../../js/shared/debug/index.js';
import { getSetting, setSetting, SETTING_KEYS } from '../../js/shared/globalSettings.js';
import { getSheetMusicRecognitionStrategies } from '../../js/games/sheetMusicReading/sheetMusicRecognition.js';
import { getGuitarOnsetStrategies } from '../../js/shared/audio/guitarOnsetStrategies.js';

async function loadVersionInfo() {
  const versionEl = document.getElementById('app-version');
  try {
    const versionUrl = new URL('../../version.txt', import.meta.url);
    const response = await fetch(versionUrl, { cache: 'no-store' });
    if (!response.ok) throw new Error('Version file not available');
    versionEl.textContent = (await response.text()).trim();
  } catch {
    versionEl.textContent = 'Version unbekannt';
  }
}

const debugStore = createGlobalDebugStore();

function initSettings() {
  const debugCheckbox = document.getElementById('setting-debug-mode');
  const debugCopyButton = document.getElementById('setting-debug-copy');
  const debugCopyStatus = document.getElementById('setting-debug-copy-status');

  function updateDebugCopyUi() {
    if (!debugCopyButton) return;
    debugCopyButton.disabled = !debugStore.isEnabled() || debugStore.getEntries().length === 0;
  }

  async function copyDebugData() {
    if (!debugCopyStatus) return;
    try {
      await navigator.clipboard.writeText(debugStore.serializeForClipboard());
      debugCopyStatus.textContent = 'Debug-Daten kopiert.';
    } catch {
      debugCopyStatus.textContent = 'Kopieren fehlgeschlagen.';
    }
  }

  if (debugCheckbox) {
    debugCheckbox.checked = debugStore.isEnabled();
    debugCheckbox.addEventListener('change', () => {
      debugStore.setEnabled(debugCheckbox.checked);
      if (debugCopyStatus) debugCopyStatus.textContent = '';
      updateDebugCopyUi();
    });
  }

  if (debugCopyButton) {
    debugCopyButton.addEventListener('click', copyDebugData);
  }

  updateDebugCopyUi();
  debugStore.subscribe(() => updateDebugCopyUi());

  const srsCheckbox = document.getElementById('setting-srs-enabled');
  if (srsCheckbox) {
    srsCheckbox.checked = getSetting(SETTING_KEYS.SRS_ENABLED);
    srsCheckbox.addEventListener('change', () => {
      setSetting(SETTING_KEYS.SRS_ENABLED, srsCheckbox.checked);
    });
  }

  const chordDetectionCheckbox = document.getElementById('setting-chord-detection-use-essentia');
  if (chordDetectionCheckbox) {
    chordDetectionCheckbox.checked = getSetting(SETTING_KEYS.CHORD_DETECTION_USE_ESSENTIA);
    chordDetectionCheckbox.addEventListener('change', () => {
      setSetting(SETTING_KEYS.CHORD_DETECTION_USE_ESSENTIA, chordDetectionCheckbox.checked);
    });
  }

  const sheetMusicStrategySelect = document.getElementById('setting-sheet-music-recognition-strategy');
  if (sheetMusicStrategySelect) {
    const strategies = getSheetMusicRecognitionStrategies();
    sheetMusicStrategySelect.innerHTML = strategies
      .map(strategy => `<option value="${strategy.key}">${strategy.label} – ${strategy.description}</option>`)
      .join('');
    const savedStrategy = getSetting(SETTING_KEYS.SHEET_MUSIC_RECOGNITION_STRATEGY);
    sheetMusicStrategySelect.value = strategies.some(s => s.key === savedStrategy)
      ? savedStrategy
      : strategies[0]?.key;
    sheetMusicStrategySelect.addEventListener('change', () => {
      setSetting(SETTING_KEYS.SHEET_MUSIC_RECOGNITION_STRATEGY, sheetMusicStrategySelect.value);
    });
  }

  const onsetStrategyList = document.getElementById('setting-sheet-music-onset-strategy-list');
  if (onsetStrategyList) {
    const onsetStrategies = getGuitarOnsetStrategies();
    const savedOnset = getSetting(SETTING_KEYS.SHEET_MUSIC_ONSET_STRATEGY);
    const activeKey = onsetStrategies.some(s => s.key === savedOnset) ? savedOnset : onsetStrategies[0]?.key;
    onsetStrategyList.innerHTML = onsetStrategies.map(s => `
      <label class="onset-strategy-item">
        <input type="radio" name="onset-strategy" value="${s.key}"${s.key === activeKey ? ' checked' : ''}>
        <div class="onset-strategy-item__body">
          <span class="onset-strategy-item__name">${s.label}</span>
          <span class="onset-strategy-item__desc">${s.description}</span>
        </div>
      </label>
    `).join('');
    onsetStrategyList.addEventListener('change', e => {
      if (e.target.name === 'onset-strategy') {
        setSetting(SETTING_KEYS.SHEET_MUSIC_ONSET_STRATEGY, e.target.value);
      }
    });
  }
}

loadVersionInfo();
registerServiceWorker();
initSettings();

const btnUpdate = document.getElementById('btn-update');
if (btnUpdate) {
  btnUpdate.addEventListener('click', async function () {
    this.textContent = '…';
    this.disabled = true;
    await forceAppReload();
  });
}
