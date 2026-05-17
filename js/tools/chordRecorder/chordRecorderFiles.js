import { buildRecordingZip, buildCollectionZip, downloadBlob as downloadBlobShared } from '../../shared/zip.js';

// ── Pure functions ────────────────────────────────────────────────────────────

export function generateRandom5() {
  const chars = '0123456789abcdefghijklmnopqrstuvwxyz';
  return Array.from({ length: 5 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
}

export function toChordKey(chordName) {
  return chordName.toLowerCase().replace(/[^a-z0-9]/g, '');
}

export function buildFileName(variation, chordKey, random5 = generateRandom5()) {
  const { technik, lautstaerke, strumModus } = variation;
  return `${chordKey}_${technik}_${lautstaerke}_${strumModus}_${random5}`;
}

export function buildSidecarJson(chordName, chordKey, variation, config, quality, meta) {
  return {
    chord: chordName,
    chordKey,
    guitarSize: config.guitarSize,
    guitarStrings: config.guitarStrings,
    volume: variation.lautstaerke,
    technique: variation.technik,
    strumMode: variation.strumModus,
    repeatIndex: variation.repeatIndex,
    quality: {
      passed: quality.passed,
      failReasons: quality.failReasons,
      warnReasons: quality.warnReasons,
      userFlags: meta.userFlags ?? [],
    },
    recordedAt: new Date().toISOString(),
    sampleRate: meta.sampleRate,
    durationSeconds: meta.durationSec,
  };
}

// ── IndexedDB persistence ─────────────────────────────────────────────────────

const DB_NAME = 'chord-recorder';
const STORE_NAME = 'recordings';
const DB_VERSION = 1;
let _dbPromise = null;

function openDb() {
  if (_dbPromise) return _dbPromise;
  _dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = e => {
      e.target.result.createObjectStore(STORE_NAME, { keyPath: 'baseName' });
    };
    req.onsuccess = e => resolve(e.target.result);
    req.onerror = e => { _dbPromise = null; reject(e.target.error); };
  });
  return _dbPromise;
}

async function dbPut(entry) {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    tx.objectStore(STORE_NAME).put(entry);
    tx.oncomplete = resolve;
    tx.onerror = e => reject(e.target.error);
  });
}

async function dbDelete(baseName) {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    tx.objectStore(STORE_NAME).delete(baseName);
    tx.oncomplete = resolve;
    tx.onerror = e => reject(e.target.error);
  });
}

async function dbClear() {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    tx.objectStore(STORE_NAME).clear();
    tx.oncomplete = resolve;
    tx.onerror = e => reject(e.target.error);
  });
}

async function dbGetAll() {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const req = tx.objectStore(STORE_NAME).getAll();
    req.onsuccess = e => resolve(e.target.result);
    req.onerror = e => reject(e.target.error);
  });
}

// ── In-memory store ───────────────────────────────────────────────────────────

const _store = [];

export async function initStore() {
  try {
    const entries = await dbGetAll();
    entries.sort((a, b) => new Date(a.sidecar.recordedAt) - new Date(b.sidecar.recordedAt));
    _store.length = 0;
    for (const entry of entries) _store.push(entry);
  } catch {
    // IndexedDB unavailable (e.g. private browsing) — continue with empty store
  }
}

export function addRecording(entry) {
  _store.push(entry);
  void dbPut(entry).catch(() => {});
}

export function getAllRecordings() {
  return [..._store];
}

export function removeRecordingByBaseName(baseName) {
  const index = _store.findIndex(entry => entry.baseName === baseName);
  if (index < 0) return null;
  const [removed] = _store.splice(index, 1);
  void dbDelete(baseName).catch(() => {});
  return removed;
}

export function updateRecording(baseName, updater) {
  const index = _store.findIndex(entry => entry.baseName === baseName);
  if (index < 0) return null;
  const current = _store[index];
  const updated = updater(current);
  if (!updated) return null;
  _store[index] = updated;
  void dbPut(updated).catch(() => {});
  return updated;
}

export function clearRecordings() {
  _store.length = 0;
  void dbClear().catch(() => {});
}

export function getRecordingCount() {
  return _store.length;
}

// ── Download utilities ────────────────────────────────────────────────────────

export function downloadJson(obj, filename) {
  const data = new TextEncoder().encode(JSON.stringify(obj, null, 2));
  downloadBlobShared(data, filename, 'application/json');
}

export async function downloadAllAsZip(basename = 'chord-recordings') {
  const recordings = getAllRecordings();
  if (recordings.length === 0) return;
  const enc = new TextEncoder();
  if (recordings.length === 1) {
    const { baseName, wavBlob, sidecar } = recordings[0];
    const wav  = new Uint8Array(await wavBlob.arrayBuffer());
    const json = enc.encode(JSON.stringify(sidecar, null, 2));
    downloadBlobShared(buildRecordingZip(baseName, wav, json), `${baseName}.zip`, 'application/zip');
  } else {
    const recs = [];
    for (const { baseName, wavBlob, sidecar } of recordings) {
      recs.push({
        baseName,
        wav:  new Uint8Array(await wavBlob.arrayBuffer()),
        json: enc.encode(JSON.stringify(sidecar, null, 2)),
      });
    }
    downloadBlobShared(buildCollectionZip(recs), `${basename}.zip`, 'application/zip');
  }
}
