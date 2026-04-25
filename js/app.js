// App - Main Menu Controller
import './components/index.js';
import { registerServiceWorker, forceAppReload } from './shared/pwa/sw-client.js';

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

// ── Initialization ───────────────────────────────────────────────────────────

loadVersionInfo();
registerServiceWorker();

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
