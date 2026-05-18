/**
 * audioAnalyseStorage.js
 *
 * IndexedDB-basierter Speicherdienst für Notenlesen-Aufnahmen.
 * Neue Aufnahmen werden als vollständige WAV+JSON-Takes unter eindeutiger ID gespeichert.
 * Der alte Schlüssel 'last' bleibt lesbar, wenn er WAV und Manifest enthält.
 *
 * Datenbank : gt-audio-analyse-db
 * Object Store: recordings
 */

const DB_NAME = 'gt-audio-analyse-db';
const DB_VERSION = 1;
const STORE_NAME = 'recordings';
const LAST_KEY = 'last';

function hasWav(wav) {
  return wav instanceof Uint8Array && wav.byteLength > 0;
}

function hasSidecar(sidecar) {
  return sidecar && typeof sidecar === 'object';
}

function makeTakeId(baseName = '') {
  const safeBaseName = String(baseName).trim();
  if (safeBaseName && safeBaseName !== LAST_KEY) return safeBaseName;
  const rand = Math.random().toString(36).slice(2, 8);
  return `sheet-music-${Date.now()}-${rand}`;
}

function normalizeTake(raw, key = raw?.id ?? raw?.baseName ?? '') {
  if (!raw) return null;
  const wav = raw.wav;
  const sidecar = raw.sidecar ?? raw.manifest ?? null;
  if (!hasWav(wav) || !hasSidecar(sidecar)) return null;

  const id = String(raw.id ?? raw.baseName ?? key);
  if (!id) return null;
  const savedAt = raw.savedAt ?? sidecar.savedAt ?? sidecar.recordedAt ?? null;
  return {
    ...raw,
    id,
    baseName: raw.baseName ?? id,
    wav,
    sidecar,
    manifest: sidecar,
    savedAt,
  };
}

function dateValue(entry) {
  const value = new Date(entry?.savedAt ?? entry?.sidecar?.recordedAt ?? 0).getTime();
  return Number.isFinite(value) ? value : 0;
}

function openDb() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = (e) => {
      e.target.result.createObjectStore(STORE_NAME);
    };
    req.onsuccess = (e) => resolve(e.target.result);
    req.onerror = () => reject(req.error);
  });
}

/**
 * Speichert einen vollständigen Notenlesen-Take in IndexedDB.
 * @param {Uint8Array} wav
 * @param {object} sidecar
 * @param {{baseName?: string, id?: string}} options
 * @returns {Promise<{id: string, baseName: string, wav: Uint8Array, sidecar: object, manifest: object, savedAt: string}|null>}
 */
export async function saveSheetMusicTake(wav, sidecar, options = {}) {
  if (!hasWav(wav) || !hasSidecar(sidecar)) return null;
  const id = makeTakeId(options.id ?? options.baseName);
  const savedAt = sidecar.savedAt ?? sidecar.recordedAt ?? new Date().toISOString();
  const entry = {
    id,
    baseName: id,
    wav,
    sidecar,
    manifest: sidecar,
    savedAt,
  };
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    tx.objectStore(STORE_NAME).put(entry, id);
    tx.oncomplete = () => { db.close(); resolve(entry); };
    tx.onerror = () => { db.close(); reject(tx.error); };
  });
}

/**
 * Legacy-Alias. Neue Aufrufer sollten saveSheetMusicTake verwenden.
 */
export async function saveLastRecording(wav, manifest = null) {
  return saveSheetMusicTake(wav, manifest);
}

/**
 * Lädt einen bestimmten Notenlesen-Take. Der Legacy-Schlüssel 'last' wird weiterhin unterstützt.
 * @returns {Promise<{id: string, baseName: string, wav: Uint8Array, sidecar: object, manifest: object, savedAt: string}|null>}
 */
export async function loadSheetMusicTake(id) {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const req = tx.objectStore(STORE_NAME).get(id);
    req.onsuccess = () => { db.close(); resolve(normalizeTake(req.result, id)); };
    req.onerror = () => { db.close(); reject(req.error); };
  });
}

/**
 * Listet alle vollständigen Notenlesen-Takes, inklusive gültigem Legacy-'last'-Eintrag.
 */
export async function listSheetMusicTakes() {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const store = tx.objectStore(STORE_NAME);
    const valuesReq = store.getAll();
    const keysReq = store.getAllKeys();
    let values = null;
    let keys = null;

    function maybeResolve() {
      if (!values || !keys) return;
      db.close();
      const takes = values
        .map((entry, index) => normalizeTake(entry, keys[index]))
        .filter(Boolean)
        .sort((a, b) => dateValue(b) - dateValue(a));
      resolve(takes);
    }

    valuesReq.onsuccess = () => {
      values = valuesReq.result ?? [];
      maybeResolve();
    };
    keysReq.onsuccess = () => {
      keys = keysReq.result ?? [];
      maybeResolve();
    };
    tx.onerror = () => { db.close(); reject(tx.error); };
  });
}

/**
 * Lädt den neuesten vollständigen Notenlesen-Take.
 */
export async function loadLatestSheetMusicTake() {
  const takes = await listSheetMusicTakes();
  return takes[0] ?? null;
}

/**
 * Legacy-Alias für den neuesten vollständigen Take.
 */
export async function loadLastRecording() {
  return loadLatestSheetMusicTake();
}

/**
 * Löscht einen Notenlesen-Take.
 */
export async function deleteSheetMusicTake(id) {
  if (!id) return false;
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    tx.objectStore(STORE_NAME).delete(id);
    tx.oncomplete = () => { db.close(); resolve(true); };
    tx.onerror = () => { db.close(); reject(tx.error); };
  });
}

/**
 * Saves an updated sheet-music take and optionally removes a previous key.
 * This is used by tools that edit a recording's sidecar or baseName after the
 * original take was created.
 * @param {string} previousId
 * @param {{ wav: Uint8Array, sidecar?: object, manifest?: object, savedAt?: string }} entry
 * @param {{ baseName: string }} options
 * @returns {Promise<{id: string, baseName: string, wav: Uint8Array, sidecar: object, manifest: object, savedAt: string}|null>}
 */
export async function replaceSheetMusicTake(previousId, entry, options) {
  const sidecar = entry?.sidecar ?? entry?.manifest ?? null;
  const next = await saveSheetMusicTake(entry?.wav, sidecar, { baseName: options?.baseName });
  if (next && previousId && previousId !== next.id) {
    await deleteSheetMusicTake(previousId);
  }
  return next;
}

/**
 * Löscht die gespeicherte Legacy-Aufnahme aus IndexedDB.
 * @returns {Promise<boolean>}
 */
export async function clearLastRecording() {
  return deleteSheetMusicTake(LAST_KEY);
}
