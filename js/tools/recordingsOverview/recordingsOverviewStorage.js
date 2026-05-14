import {
  buildDisplayName,
  sortByDate,
} from './recordingsOverviewLogic.js';
import {
  deleteSheetMusicTake,
  listSheetMusicTakes,
} from '../../shared/audioAnalyseStorage.js';

// ── Sheet Music DB ────────────────────────────────────────────────────────────

export async function getSheetMusicRecordingsMeta() {
  try {
    const entries = await listSheetMusicTakes();
    return entries.map(entry => ({
      id: entry.id,
      source: 'sheet-music',
      name: buildDisplayName('sheet-music', entry.id, entry),
      sizeBytes: entry.wav?.byteLength ?? 0,
      date: new Date(entry.savedAt ?? 0),
      metadata: entry.sidecar,
    }));
  } catch {
    return [];
  }
}

export async function deleteSheetMusicRecording(id) {
  return deleteSheetMusicTake(id);
}

// ── Chord Recorder DB ─────────────────────────────────────────────────────────

const CR_DB_NAME    = 'chord-recorder';
const CR_STORE_NAME = 'recordings';

function openChordRecorderDb() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(CR_DB_NAME, 1);
    req.onupgradeneeded = e => {
      e.target.result.createObjectStore(CR_STORE_NAME, { keyPath: 'baseName' });
    };
    req.onsuccess = e => resolve(e.target.result);
    req.onerror   = () => reject(req.error);
  });
}

export async function getChordRecordingsMeta() {
  try {
    const db = await openChordRecorderDb();
    const entries = await new Promise((resolve, reject) => {
      const tx  = db.transaction(CR_STORE_NAME, 'readonly');
      const req = tx.objectStore(CR_STORE_NAME).getAll();
      req.onsuccess = () => { db.close(); resolve(req.result); };
      req.onerror   = () => { db.close(); reject(req.error); };
    });
    return entries.map(entry => ({
      id: entry.baseName,
      source: 'chord-recorder',
      name: buildDisplayName('chord-recorder', entry.baseName, entry.sidecar),
      sizeBytes: entry.wavBlob?.size ?? 0,
      date: new Date(entry.sidecar?.recordedAt ?? 0),
      metadata: entry.sidecar,
    }));
  } catch {
    return [];
  }
}

export async function deleteChordRecording(id) {
  if (!id) return false;
  const db = await openChordRecorderDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(CR_STORE_NAME, 'readwrite');
    tx.objectStore(CR_STORE_NAME).delete(id);
    tx.oncomplete = () => { db.close(); resolve(true); };
    tx.onerror = () => { db.close(); reject(tx.error); };
  });
}

// ── Combined ──────────────────────────────────────────────────────────────────

export async function getAllRecordingsMeta() {
  const [smEntries, crEntries] = await Promise.all([
    getSheetMusicRecordingsMeta(),
    getChordRecordingsMeta(),
  ]);
  const all = [...smEntries, ...crEntries];
  return sortByDate(all);
}

export async function deleteRecordingBySource(source, id) {
  if (source === 'sheet-music') return deleteSheetMusicRecording(id);
  if (source === 'chord-recorder') return deleteChordRecording(id);
  return false;
}
