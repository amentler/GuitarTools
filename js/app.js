// App - Main Menu Controller
import './components/index.js';

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

// Ensure menu is visible
const menuView = document.getElementById('view-menu');
if (menuView) {
  menuView.classList.add('active');
}
