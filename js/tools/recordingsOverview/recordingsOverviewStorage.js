import {
  buildDisplayName,
  sortByDate,
} from './recordingsOverviewLogic.js';
import {
  deleteSheetMusicTake,
  listSheetMusicTakes,
} from '../../shared/audioAnalyseStorage.js';
import { buildRecordingZip, buildCollectionZip, downloadBlob } from '../../shared/zip.js';

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

// ── Bulk delete ───────────────────────────────────────────────────────────────

export async function deleteAllSheetMusicRecordings() {
  const takes = await listSheetMusicTakes();
  await Promise.all(takes.map(t => deleteSheetMusicTake(t.id)));
}

export async function deleteAllChordRecordings() {
  const db = await openChordRecorderDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(CR_STORE_NAME, 'readwrite');
    tx.objectStore(CR_STORE_NAME).clear();
    tx.oncomplete = () => { db.close(); resolve(true); };
    tx.onerror = () => { db.close(); reject(tx.error); };
  });
}

export async function deleteAllRecordings() {
  await Promise.all([deleteAllSheetMusicRecordings(), deleteAllChordRecordings()]);
}

export async function deleteRecordingsByIds(pairs) {
  await Promise.all(pairs.map(({ source, id }) => deleteRecordingBySource(source, id)));
}

// ── Full data retrieval for ZIP export ────────────────────────────────────────

/**
 * @param {{ source: string, id: string, name: string }[]} recordings
 * @returns {Promise<{ baseName: string, wav: Uint8Array, json: Uint8Array }[]>}
 */
export async function getRecordingsForZip(recordings) {
  const enc = new TextEncoder();
  const results = [];

  const smIds = new Set(recordings.filter(r => r.source === 'sheet-music').map(r => r.id));
  const crIds = new Set(recordings.filter(r => r.source === 'chord-recorder').map(r => r.id));

  if (smIds.size > 0) {
    const takes = await listSheetMusicTakes();
    for (const take of takes) {
      if (!smIds.has(take.id)) continue;
      results.push({
        baseName: take.baseName ?? take.id,
        wav:  take.wav,
        json: enc.encode(JSON.stringify(take.sidecar ?? {}, null, 2)),
      });
    }
  }

  if (crIds.size > 0) {
    const db = await openChordRecorderDb();
    const entries = await new Promise((resolve, reject) => {
      const tx = db.transaction(CR_STORE_NAME, 'readonly');
      const req = tx.objectStore(CR_STORE_NAME).getAll();
      req.onsuccess = () => { db.close(); resolve(req.result); };
      req.onerror = () => { db.close(); reject(req.error); };
    });
    for (const entry of entries) {
      if (!crIds.has(entry.baseName)) continue;
      results.push({
        baseName: entry.baseName,
        wav:  new Uint8Array(await entry.wavBlob.arrayBuffer()),
        json: enc.encode(JSON.stringify(entry.sidecar ?? {}, null, 2)),
      });
    }
  }

  return results;
}

/**
 * Builds and triggers a ZIP download for the given recordings.
 * @param {{ source: string, id: string, name: string }[]} recordings
 * @param {string} zipName
 */
export async function downloadRecordingsAsZip(recordings, zipName) {
  if (recordings.length === 0) return;
  const pairs = await getRecordingsForZip(recordings);
  if (pairs.length === 0) return;
  if (pairs.length === 1) {
    const { baseName, wav, json } = pairs[0];
    downloadBlob(
      buildRecordingZip(baseName, wav, json),
      `${baseName}.zip`,
      'application/zip',
    );
  } else {
    downloadBlob(buildCollectionZip(pairs), zipName, 'application/zip');
  }
}
