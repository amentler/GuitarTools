// App - Main Menu Controller
import './components/index.js';
import { registerServiceWorker, forceAppReload } from './shared/pwa/sw-client.js';
import { createGlobalDebugStore } from './shared/debug/index.js';
import { getSetting, setSetting, SETTING_KEYS } from './shared/globalSettings.js';
import { getSheetMusicRecognitionStrategies } from './games/sheetMusicReading/sheetMusicRecognition.js';

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

// ── Settings ─────────────────────────────────────────────────────────────────

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
      if (debugCopyStatus) {
        debugCopyStatus.textContent = '';
      }
      updateDebugCopyUi();
    });
  }

  if (debugCopyButton) {
    debugCopyButton.addEventListener('click', copyDebugData);
  }

  updateDebugCopyUi();
  debugStore.subscribe(() => {
    updateDebugCopyUi();
  });

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
    sheetMusicStrategySelect.value = strategies.some(strategy => strategy.key === savedStrategy)
      ? savedStrategy
      : strategies[0]?.key;
    sheetMusicStrategySelect.addEventListener('change', () => {
      setSetting(SETTING_KEYS.SHEET_MUSIC_RECOGNITION_STRATEGY, sheetMusicStrategySelect.value);
    });
  }
}

// ── Initialization ───────────────────────────────────────────────────────────

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

// Ensure menu is visible
const menuView = document.getElementById('view-menu');
if (menuView) {
  menuView.classList.add('active');
}
