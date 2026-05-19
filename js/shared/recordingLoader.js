import {
  loadLatestSheetMusicTake,
  loadSheetMusicTake,
  replaceSheetMusicTake,
  saveSheetMusicTake,
} from './audioAnalyseStorage.js';
import {
  getTrainingReviewEntry,
  normalizeTrainingDataSidecar,
} from './trainingDataReviewCatalog.js';
import { readZip } from './zip.js';

const CHORD_DB_NAME = 'chord-recorder';
const CHORD_STORE   = 'recordings';

function openChordDb() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(CHORD_DB_NAME, 1);
    req.onupgradeneeded = e => {
      e.target.result.createObjectStore(CHORD_STORE, { keyPath: 'baseName' });
    };
    req.onsuccess = e => resolve(e.target.result);
    req.onerror  = () => reject(req.error);
  });
}

async function loadChordRecordingById(id) {
  const db = await openChordDb();
  return new Promise((resolve, reject) => {
    const tx  = db.transaction(CHORD_STORE, 'readonly');
    const req = tx.objectStore(CHORD_STORE).get(id);
    req.onsuccess = () => { db.close(); resolve(req.result ?? null); };
    req.onerror   = () => { db.close(); reject(req.error); };
  });
}

async function saveChordRecording(previousId, entry, nextBaseName) {
  if (!previousId || !entry?.wav || !entry?.sidecar || !nextBaseName) return null;
  const existing = await loadChordRecordingById(previousId);
  const wavBlob = entry.wavBlob ?? existing?.wavBlob ?? new Blob([entry.wav], { type: 'audio/wav' });
  const nextEntry = {
    ...(existing ?? {}),
    baseName: nextBaseName,
    wavBlob,
    sidecar: entry.sidecar,
  };
  const db = await openChordDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(CHORD_STORE, 'readwrite');
    const store = tx.objectStore(CHORD_STORE);
    store.put(nextEntry);
    if (previousId !== nextBaseName) store.delete(previousId);
    tx.oncomplete = () => { db.close(); resolve({ ...nextEntry, id: nextBaseName, baseName: nextBaseName }); };
    tx.onerror = () => { db.close(); reject(tx.error); };
  });
}

function lastPathSegment(url) {
  return String(url ?? '').split('/').pop() || '';
}

async function fetchBytes(url) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`HTTP ${response.status}: ${url}`);
  return new Uint8Array(await response.arrayBuffer());
}

async function fetchJson(url) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`HTTP ${response.status}: ${url}`);
  return response.json();
}

function findZipEntry(entries, extension) {
  const suffix = extension.toLowerCase();
  return entries.find(entry => entry.name.toLowerCase().endsWith(suffix)) ?? null;
}

async function loadTrainingDataReviewEntry(id) {
  const entry = await getTrainingReviewEntry(id);
  if (!entry?.url) return null;

  if (entry.kind === 'zip') {
    const zipBytes = await fetchBytes(entry.url);
    const entries = readZip(zipBytes);
    const wavEntry = findZipEntry(entries, '.wav');
    if (!wavEntry) return null;
    const jsonEntry = findZipEntry(entries, '.json');
    const sidecar = jsonEntry
      ? normalizeTrainingDataSidecar(JSON.parse(new TextDecoder().decode(jsonEntry.data)))
      : null;
    return {
      wav: wavEntry.data,
      manifest: sidecar,
      sidecar,
      id: entry.id,
      baseName: entry.baseName ?? entry.name ?? lastPathSegment(entry.url).replace(/\.zip$/i, ''),
      readOnly: true,
    };
  }

  if (entry.kind === 'wav') {
    const wav = await fetchBytes(entry.url);
    const sidecar = entry.jsonUrl
      ? normalizeTrainingDataSidecar(await fetchJson(entry.jsonUrl))
      : null;
    return {
      wav,
      manifest: sidecar,
      sidecar,
      id: entry.id,
      baseName: entry.baseName ?? entry.name ?? lastPathSegment(entry.url).replace(/\.wav$/i, ''),
      readOnly: true,
    };
  }

  return null;
}

/**
 * Loads WAV bytes + manifest from any recording source.
 * @param {'sheet-music'|'chord-recorder'} source
 * @param {string} id  take id for sheet-music, baseName for chord-recorder
 * @returns {Promise<{wav: Uint8Array, manifest: object|null}|null>}
 */
export async function loadRecordingFromSource(source, id) {
  if (source === 'training-data') {
    return loadTrainingDataReviewEntry(id);
  }
  if (source === 'sheet-music') {
    const entry = id ? await loadSheetMusicTake(id) : await loadLatestSheetMusicTake();
    if (!entry) return null;
    return {
      wav: entry.wav,
      manifest: entry.sidecar,
      sidecar: entry.sidecar,
      savedAt: entry.savedAt,
      id: entry.id,
      baseName: entry.baseName ?? entry.id,
    };
  }
  if (source === 'chord-recorder') {
    const entry = await loadChordRecordingById(id);
    if (!entry) return null;
    const wav = new Uint8Array(await entry.wavBlob.arrayBuffer());
    return { wav, manifest: entry.sidecar, sidecar: entry.sidecar, id: entry.baseName, baseName: entry.baseName };
  }
  return null;
}

/**
 * Persists an edited recording sidecar/baseName for either storage source.
 * Local handoff recordings are stored as sheet-music takes.
 * @param {'sheet-music'|'chord-recorder'} source
 * @param {string} id
 * @param {{ wav: Uint8Array, sidecar: object, baseName: string }} entry
 * @returns {Promise<{ source: string, id: string, baseName: string }|null>}
 */
export async function saveRecordingToSource(source, id, entry) {
  if (!entry?.wav || !entry?.sidecar || !entry?.baseName) return null;
  if (source === 'training-data') {
    const saved = await saveSheetMusicTake(entry.wav, entry.sidecar, { baseName: entry.baseName });
    return saved ? { source: 'sheet-music', id: saved.id, baseName: saved.baseName } : null;
  }
  if (source === 'chord-recorder') {
    const saved = await saveChordRecording(id, entry, entry.baseName);
    return saved ? { source, id: saved.baseName, baseName: saved.baseName } : null;
  }
  const saved = id
    ? await replaceSheetMusicTake(id, entry, { baseName: entry.baseName })
    : await saveSheetMusicTake(entry.wav, entry.sidecar, { baseName: entry.baseName });
  return saved ? { source: 'sheet-music', id: saved.id, baseName: saved.baseName } : null;
}
