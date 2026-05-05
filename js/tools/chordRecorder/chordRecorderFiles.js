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
