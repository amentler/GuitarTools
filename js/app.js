// App - Main Menu Controller
import './components/index.js';
import { registerServiceWorker, forceAppReload } from './shared/pwa/sw-client.js';
import { createGlobalDebugStore } from './shared/debug/index.js';
import { getSetting, setSetting, SETTING_KEYS } from './shared/globalSettings.js';

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
