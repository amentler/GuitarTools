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

// ── ZIP writer (no dependencies, store-format / no compression) ───────────────

export function crc32(data) {
  let crc = 0xFFFFFFFF;
  for (let i = 0; i < data.length; i++) {
    crc ^= data[i];
    for (let j = 0; j < 8; j++) {
      crc = (crc >>> 1) ^ (crc & 1 ? 0xEDB88320 : 0);
    }
  }
  return (~crc) >>> 0;
}

export function buildZip(files) {
  const enc = new TextEncoder();
  const entries = [];
  let dataOffset = 0;

  for (const { name, data } of files) {
    const nameBytes = enc.encode(name);
    const checksum = crc32(data);
    const lh = new Uint8Array(30 + nameBytes.length);
    const v = new DataView(lh.buffer);
    v.setUint32(0, 0x04034b50, true);
    v.setUint16(4, 20, true);
    v.setUint16(6, 0, true);
    v.setUint16(8, 0, true);
    v.setUint16(10, 0, true);
    v.setUint16(12, 0, true);
    v.setUint32(14, checksum, true);
    v.setUint32(18, data.length, true);
    v.setUint32(22, data.length, true);
    v.setUint16(26, nameBytes.length, true);
    v.setUint16(28, 0, true);
    lh.set(nameBytes, 30);
    entries.push({ nameBytes, data, lh, checksum, offset: dataOffset });
    dataOffset += lh.length + data.length;
  }

  const cdParts = [];
  for (const { nameBytes, data, checksum, offset } of entries) {
    const cd = new Uint8Array(46 + nameBytes.length);
    const v = new DataView(cd.buffer);
    v.setUint32(0, 0x02014b50, true);
    v.setUint16(4, 20, true);
    v.setUint16(6, 20, true);
    v.setUint16(8, 0, true);
    v.setUint16(10, 0, true);
    v.setUint16(12, 0, true);
    v.setUint16(14, 0, true);
    v.setUint32(16, checksum, true);
    v.setUint32(20, data.length, true);
    v.setUint32(24, data.length, true);
    v.setUint16(28, nameBytes.length, true);
    v.setUint16(30, 0, true);
    v.setUint16(32, 0, true);
    v.setUint16(34, 0, true);
    v.setUint16(36, 0, true);
    v.setUint32(38, 0, true);
    v.setUint32(42, offset, true);
    cd.set(nameBytes, 46);
    cdParts.push(cd);
  }

  const cdSize = cdParts.reduce((s, c) => s + c.length, 0);
  const eocd = new Uint8Array(22);
  const ev = new DataView(eocd.buffer);
  ev.setUint32(0, 0x06054b50, true);
  ev.setUint16(4, 0, true);
  ev.setUint16(6, 0, true);
  ev.setUint16(8, entries.length, true);
  ev.setUint16(10, entries.length, true);
  ev.setUint32(12, cdSize, true);
  ev.setUint32(16, dataOffset, true);
  ev.setUint16(20, 0, true);

  const total = dataOffset + cdSize + eocd.length;
  const out = new Uint8Array(total);
  let pos = 0;
  for (const { lh, data } of entries) {
    out.set(lh, pos);  pos += lh.length;
    out.set(data, pos); pos += data.length;
  }
  for (const cd of cdParts) { out.set(cd, pos); pos += cd.length; }
  out.set(eocd, pos);
  return out;
}

// ── In-memory store ───────────────────────────────────────────────────────────

const _store = [];

export function addRecording(entry) {
  _store.push(entry);
}

export function getAllRecordings() {
  return [..._store];
}

export function clearRecordings() {
  _store.length = 0;
}

export function getRecordingCount() {
  return _store.length;
}

// ── Download utilities ────────────────────────────────────────────────────────

export function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = Object.assign(document.createElement('a'), { href: url, download: filename });
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}

export function downloadJson(obj, filename) {
  const blob = new Blob([JSON.stringify(obj, null, 2)], { type: 'application/json' });
  downloadBlob(blob, filename);
}

export async function downloadAllAsZip(basename = 'chord-recordings') {
  const recordings = getAllRecordings();
  if (recordings.length === 0) return;
  const enc = new TextEncoder();
  const files = [];
  for (const { baseName, wavBlob, sidecar } of recordings) {
    files.push({ name: `${baseName}.wav`, data: new Uint8Array(await wavBlob.arrayBuffer()) });
    files.push({ name: `${baseName}.json`, data: enc.encode(JSON.stringify(sidecar, null, 2)) });
  }
  const blob = new Blob([buildZip(files)], { type: 'application/zip' });
  downloadBlob(blob, `${basename}.zip`);
}
