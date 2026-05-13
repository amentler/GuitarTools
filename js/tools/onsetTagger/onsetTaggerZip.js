/**
 * onsetTaggerZip.js
 *
 * Local copy of the Store-mode ZIP encoder for the Onset Tagger.
 * Keeps the tool self-contained without importing from js/games/.
 */

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let j = 0; j < 8; j++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
    table[i] = c;
  }
  return table;
})();

function crc32(data) {
  let crc = 0xFFFFFFFF;
  for (let i = 0; i < data.length; i++) crc = CRC_TABLE[(crc ^ data[i]) & 0xFF] ^ (crc >>> 8);
  return (crc ^ 0xFFFFFFFF) >>> 0;
}

function writeU16(view, offset, v) { view.setUint16(offset, v, true); }
function writeU32(view, offset, v) { view.setUint32(offset, v, true); }

/**
 * Builds an uncompressed (Store) ZIP archive.
 * @param {Array<{ name: string, data: Uint8Array }>} files
 * @returns {Uint8Array}
 */
export function buildZip(files) {
  const encoder = new TextEncoder();
  const entries = [];
  const localParts = [];
  let localOffset = 0;

  for (const { name, data } of files) {
    const nameBytes = encoder.encode(name);
    const crc = crc32(data);
    const size = data.length;
    const headerSize = 30 + nameBytes.length;
    const localBuf = new ArrayBuffer(headerSize);
    const lv = new DataView(localBuf);

    writeU32(lv, 0,  0x04034B50);
    writeU16(lv, 4,  20);
    writeU16(lv, 6,  0);
    writeU16(lv, 8,  0);
    writeU16(lv, 10, 0);
    writeU16(lv, 12, 0);
    writeU32(lv, 14, crc);
    writeU32(lv, 18, size);
    writeU32(lv, 22, size);
    writeU16(lv, 26, nameBytes.length);
    writeU16(lv, 28, 0);
    new Uint8Array(localBuf, 30).set(nameBytes);

    entries.push({ localOffset, nameBytes, crc, size });
    localParts.push(new Uint8Array(localBuf), data);
    localOffset += headerSize + size;
  }

  const centralParts = [];
  let centralSize = 0;

  for (const { localOffset: lOff, nameBytes, crc, size } of entries) {
    const cdSize = 46 + nameBytes.length;
    const cdBuf = new ArrayBuffer(cdSize);
    const cv = new DataView(cdBuf);

    writeU32(cv, 0,  0x02014B50);
    writeU16(cv, 4,  20);
    writeU16(cv, 6,  20);
    writeU16(cv, 8,  0);
    writeU16(cv, 10, 0);
    writeU16(cv, 12, 0);
    writeU16(cv, 14, 0);
    writeU32(cv, 16, crc);
    writeU32(cv, 20, size);
    writeU32(cv, 24, size);
    writeU16(cv, 28, nameBytes.length);
    writeU16(cv, 30, 0);
    writeU16(cv, 32, 0);
    writeU16(cv, 34, 0);
    writeU16(cv, 36, 0);
    writeU32(cv, 38, 0);
    writeU32(cv, 42, lOff);
    new Uint8Array(cdBuf, 46).set(nameBytes);

    centralParts.push(new Uint8Array(cdBuf));
    centralSize += cdSize;
  }

  const eocdBuf = new ArrayBuffer(22);
  const ev = new DataView(eocdBuf);
  writeU32(ev, 0,  0x06054B50);
  writeU16(ev, 4,  0);
  writeU16(ev, 6,  0);
  writeU16(ev, 8,  entries.length);
  writeU16(ev, 10, entries.length);
  writeU32(ev, 12, centralSize);
  writeU32(ev, 16, localOffset);
  writeU16(ev, 20, 0);

  const allParts = [...localParts, ...centralParts, new Uint8Array(eocdBuf)];
  const totalSize = allParts.reduce((s, p) => s + p.length, 0);
  const result = new Uint8Array(totalSize);
  let pos = 0;
  for (const part of allParts) { result.set(part, pos); pos += part.length; }
  return result;
}

/**
 * Triggers a browser file download.
 * @param {Uint8Array} data
 * @param {string} filename
 * @param {string} mimeType
 */
export function downloadBlob(data, filename, mimeType) {
  const blob = new Blob([data], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.style.display = 'none';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
