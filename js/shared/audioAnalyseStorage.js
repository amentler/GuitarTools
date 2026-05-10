/**
 * audioAnalyseStorage.js
 *
 * IndexedDB-basierter Speicherdienst für die Audio-Analyse.
 * Speichert immer nur die zuletzt erstellte Aufnahme unter dem festen Schlüssel 'last'.
 *
 * Datenbank : gt-audio-analyse-db
 * Object Store: recordings
 */

const DB_NAME = 'gt-audio-analyse-db';
const DB_VERSION = 1;
const STORE_NAME = 'recordings';
const LAST_KEY = 'last';

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
 * Speichert die letzte Aufnahme in IndexedDB (überschreibt immer den gleichen Slot).
 * @param {Uint8Array} wav
 * @param {object|null} manifest
 * @returns {Promise<void>}
 */
export async function saveLastRecording(wav, manifest = null) {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    tx.objectStore(STORE_NAME).put(
      { wav, manifest, savedAt: new Date().toISOString() },
      LAST_KEY,
    );
    tx.oncomplete = () => { db.close(); resolve(); };
    tx.onerror = () => { db.close(); reject(tx.error); };
  });
}

/**
 * Lädt die zuletzt gespeicherte Aufnahme aus IndexedDB.
 * @returns {Promise<{ wav: Uint8Array, manifest: object|null, savedAt: string }|null>}
 */
export async function loadLastRecording() {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const req = tx.objectStore(STORE_NAME).get(LAST_KEY);
    req.onsuccess = () => { db.close(); resolve(req.result ?? null); };
    req.onerror = () => { db.close(); reject(req.error); };
  });
}

/**
 * Löscht die gespeicherte Aufnahme aus IndexedDB.
 * @returns {Promise<void>}
 */
export async function clearLastRecording() {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    tx.objectStore(STORE_NAME).delete(LAST_KEY);
    tx.oncomplete = () => { db.close(); resolve(); };
    tx.onerror = () => { db.close(); reject(tx.error); };
  });
}
