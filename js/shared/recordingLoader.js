import { loadLatestSheetMusicTake, loadSheetMusicTake } from './audioAnalyseStorage.js';

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

/**
 * Loads WAV bytes + manifest from any recording source.
 * @param {'sheet-music'|'chord-recorder'} source
 * @param {string} id  take id for sheet-music, baseName for chord-recorder
 * @returns {Promise<{wav: Uint8Array, manifest: object|null}|null>}
 */
export async function loadRecordingFromSource(source, id) {
  if (source === 'sheet-music') {
    const entry = id ? await loadSheetMusicTake(id) : await loadLatestSheetMusicTake();
    if (!entry) return null;
    return { wav: entry.wav, manifest: entry.sidecar, sidecar: entry.sidecar, savedAt: entry.savedAt, id: entry.id };
  }
  if (source === 'chord-recorder') {
    const entry = await loadChordRecordingById(id);
    if (!entry) return null;
    const wav = new Uint8Array(await entry.wavBlob.arrayBuffer());
    return { wav, manifest: entry.sidecar };
  }
  return null;
}
