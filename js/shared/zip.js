/**
 * zip.js — Shared Store-mode ZIP encoder (no compression, no external deps).
 *
 * Implements Local File Headers, Central Directory Records, and
 * End of Central Directory (EOCD). Includes correct CRC-32 calculation.
 */

// ── CRC-32 ──────────────────────────────────────────────────────────────────

/** Pre-computed CRC-32 table (polynomial 0xEDB88320). */
const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let j = 0; j < 8; j++) {
      c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
    }
    table[i] = c;
  }
  return table;
})();

/**
 * Computes the CRC-32 checksum of a Uint8Array.
 * @param {Uint8Array} data
 * @returns {number} unsigned 32-bit CRC
 */
export function crc32(data) {
  let crc = 0xFFFFFFFF;
  for (let i = 0; i < data.length; i++) {
    crc = CRC_TABLE[(crc ^ data[i]) & 0xFF] ^ (crc >>> 8);
  }
  return (crc ^ 0xFFFFFFFF) >>> 0;
}

// ── Little-endian write helpers ──────────────────────────────────────────────

function writeU16(view, offset, v) { view.setUint16(offset, v, true); }
function writeU32(view, offset, v) { view.setUint32(offset, v, true); }

// ── ZIP builder ──────────────────────────────────────────────────────────────

/**
 * Builds an uncompressed (Store) ZIP archive.
 *
 * @param {Array<{ name: string, data: Uint8Array }>} files
 * @returns {Uint8Array} valid ZIP binary
 */
export function buildZip(files) {
  const encoder = new TextEncoder();

  /** @type {{ localOffset: number, nameBytes: Uint8Array, crc: number, size: number }[]} */
  const entries = [];

  // ── Pass 1: local file records ────────────────────────────────────────────
  const localParts = [];
  let localOffset = 0;

  for (const { name, data } of files) {
    const nameBytes = encoder.encode(name);
    const crc = crc32(data);
    const size = data.length;

    const headerSize = 30 + nameBytes.length;
    const localBuf = new ArrayBuffer(headerSize);
    const lv = new DataView(localBuf);

    writeU32(lv, 0,  0x04034B50); // local file header signature
    writeU16(lv, 4,  20);          // version needed (2.0)
    writeU16(lv, 6,  0);           // general purpose bit flag
    writeU16(lv, 8,  0);           // compression method: Store
    writeU16(lv, 10, 0);           // last mod time
    writeU16(lv, 12, 0);           // last mod date
    writeU32(lv, 14, crc);         // crc-32
    writeU32(lv, 18, size);        // compressed size
    writeU32(lv, 22, size);        // uncompressed size
    writeU16(lv, 26, nameBytes.length); // file name length
    writeU16(lv, 28, 0);           // extra field length
    new Uint8Array(localBuf, 30).set(nameBytes);

    entries.push({ localOffset, nameBytes, crc, size });
    localParts.push(new Uint8Array(localBuf), data);
    localOffset += headerSize + size;
  }

  // ── Pass 2: central directory records ────────────────────────────────────
  const centralParts = [];
  let centralSize = 0;

  for (const { localOffset: lOff, nameBytes, crc, size } of entries) {
    const cdSize = 46 + nameBytes.length;
    const cdBuf = new ArrayBuffer(cdSize);
    const cv = new DataView(cdBuf);

    writeU32(cv, 0,  0x02014B50); // central directory signature
    writeU16(cv, 4,  20);          // version made by
    writeU16(cv, 6,  20);          // version needed
    writeU16(cv, 8,  0);           // general purpose bit flag
    writeU16(cv, 10, 0);           // compression method: Store
    writeU16(cv, 12, 0);           // last mod time
    writeU16(cv, 14, 0);           // last mod date
    writeU32(cv, 16, crc);         // crc-32
    writeU32(cv, 20, size);        // compressed size
    writeU32(cv, 24, size);        // uncompressed size
    writeU16(cv, 28, nameBytes.length); // file name length
    writeU16(cv, 30, 0);           // extra field length
    writeU16(cv, 32, 0);           // file comment length
    writeU16(cv, 34, 0);           // disk number start
    writeU16(cv, 36, 0);           // internal file attributes
    writeU32(cv, 38, 0);           // external file attributes
    writeU32(cv, 42, lOff);        // relative offset of local header
    new Uint8Array(cdBuf, 46).set(nameBytes);

    centralParts.push(new Uint8Array(cdBuf));
    centralSize += cdSize;
  }

  // ── Pass 3: end of central directory (EOCD) ───────────────────────────────
  const eocdBuf = new ArrayBuffer(22);
  const ev = new DataView(eocdBuf);

  writeU32(ev, 0,  0x06054B50);          // EOCD signature
  writeU16(ev, 4,  0);                    // disk number
  writeU16(ev, 6,  0);                    // disk with CD start
  writeU16(ev, 8,  entries.length);       // entries on this disk
  writeU16(ev, 10, entries.length);       // total entries
  writeU32(ev, 12, centralSize);          // size of central directory
  writeU32(ev, 16, localOffset);          // offset of central directory
  writeU16(ev, 20, 0);                    // comment length

  // ── Concatenate all parts ─────────────────────────────────────────────────
  const allParts = [...localParts, ...centralParts, new Uint8Array(eocdBuf)];
  const totalSize = allParts.reduce((s, p) => s + p.length, 0);
  const result = new Uint8Array(totalSize);
  let pos = 0;
  for (const part of allParts) {
    result.set(part, pos);
    pos += part.length;
  }
  return result;
}

// ── Download helper ──────────────────────────────────────────────────────────

/**
 * Triggers a browser file download for the given binary data.
 *
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
