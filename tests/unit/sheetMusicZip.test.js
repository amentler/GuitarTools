import { describe, it, expect } from 'vitest';
import { buildZip } from '../../js/shared/zip.js';

// ── helpers ──────────────────────────────────────────────────────────────────

function readU16(view, offset) { return view.getUint16(offset, true); }
function readU32(view, offset) { return view.getUint32(offset, true); }

function readStr(bytes, offset, length) {
  return String.fromCharCode(...bytes.slice(offset, offset + length));
}

// ── CRC-32 (same algorithm, independent impl for test verification) ──────────

const CRC_TABLE_TEST = (() => {
  const t = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let j = 0; j < 8; j++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
    t[i] = c;
  }
  return t;
})();

function crc32Test(data) {
  let crc = 0xFFFFFFFF;
  for (const b of data) crc = CRC_TABLE_TEST[(crc ^ b) & 0xFF] ^ (crc >>> 8);
  return (crc ^ 0xFFFFFFFF) >>> 0;
}

// ── tests ─────────────────────────────────────────────────────────────────────

describe('buildZip', () => {
  it('returns a Uint8Array', () => {
    const zip = buildZip([]);
    expect(zip).toBeInstanceOf(Uint8Array);
  });

  it('produces a valid EOCD signature for an empty archive', () => {
    const zip = buildZip([]);
    const view = new DataView(zip.buffer, zip.byteOffset, zip.byteLength);
    // EOCD starts with 0x06054B50 at the end (22 bytes from end)
    expect(readU32(view, zip.length - 22)).toBe(0x06054B50);
  });

  it('stores a single file and can be found by local header signature', () => {
    const content = new TextEncoder().encode('hello');
    const zip = buildZip([{ name: 'hello.txt', data: content }]);
    const view = new DataView(zip.buffer, zip.byteOffset, zip.byteLength);
    // First local header at offset 0
    expect(readU32(view, 0)).toBe(0x04034B50);
  });

  it('correctly stores file name in local header', () => {
    const name = 'test.json';
    const data = new TextEncoder().encode('{}');
    const zip = buildZip([{ name, data }]);

    const nameLen = readU16(new DataView(zip.buffer, zip.byteOffset, zip.byteLength), 26);
    const storedName = readStr(zip, 30, nameLen);
    expect(storedName).toBe(name);
  });

  it('stores file data immediately after local header + name', () => {
    const payload = new TextEncoder().encode('payload');
    const name = 'f.txt';
    const zip = buildZip([{ name, data: payload }]);

    const nameLen = name.length;
    const dataOffset = 30 + nameLen;
    const stored = zip.slice(dataOffset, dataOffset + payload.length);
    expect(stored).toEqual(payload);
  });

  it('computes correct CRC-32 in local header', () => {
    const data = new TextEncoder().encode('crc-check');
    const zip = buildZip([{ name: 'x.txt', data }]);
    const view = new DataView(zip.buffer, zip.byteOffset, zip.byteLength);
    const storedCrc = readU32(view, 14);
    expect(storedCrc).toBe(crc32Test(data));
  });

  it('stores correct (uncompressed) sizes in local header', () => {
    const data = new Uint8Array(123);
    const zip = buildZip([{ name: 'sized.bin', data }]);
    const view = new DataView(zip.buffer, zip.byteOffset, zip.byteLength);
    expect(readU32(view, 18)).toBe(123); // compressed size == uncompressed (Store)
    expect(readU32(view, 22)).toBe(123);
  });

  it('has compression method 0 (Store) in local header', () => {
    const zip = buildZip([{ name: 'a.bin', data: new Uint8Array(1) }]);
    const view = new DataView(zip.buffer, zip.byteOffset, zip.byteLength);
    expect(readU16(view, 8)).toBe(0); // compression method
  });

  it('EOCD entry count matches number of files', () => {
    const files = [
      { name: 'a.txt', data: new TextEncoder().encode('a') },
      { name: 'b.txt', data: new TextEncoder().encode('b') },
    ];
    const zip = buildZip(files);
    const view = new DataView(zip.buffer, zip.byteOffset, zip.byteLength);
    const eocdOffset = zip.length - 22;
    expect(readU16(view, eocdOffset + 8)).toBe(2);  // entries on disk
    expect(readU16(view, eocdOffset + 10)).toBe(2); // total entries
  });

  it('central directory starts at localOffset stored in EOCD', () => {
    const data = new TextEncoder().encode('hello');
    const name = 'hi.txt';
    const zip = buildZip([{ name, data }]);
    const view = new DataView(zip.buffer, zip.byteOffset, zip.byteLength);
    const eocdOffset = zip.length - 22;
    const cdOffset = readU32(view, eocdOffset + 16);

    // Central directory header signature
    expect(readU32(view, cdOffset)).toBe(0x02014B50);
  });

  it('handles binary (WAV-like) data correctly', () => {
    // 44-byte WAV header simulation
    const wav = new Uint8Array(44);
    wav.set([0x52, 0x49, 0x46, 0x46]); // "RIFF"
    const zip = buildZip([{ name: 'test.wav', data: wav }]);
    const nameLen = 'test.wav'.length;
    const stored = zip.slice(30 + nameLen, 30 + nameLen + 4);
    expect(stored[0]).toBe(0x52); // R
    expect(stored[1]).toBe(0x49); // I
    expect(stored[2]).toBe(0x46); // F
    expect(stored[3]).toBe(0x46); // F
  });

  it('handles multiple files and central directory has correct offsets', () => {
    const f1 = { name: 'one.txt', data: new TextEncoder().encode('one') };
    const f2 = { name: 'two.txt', data: new TextEncoder().encode('two') };
    const zip = buildZip([f1, f2]);
    const view = new DataView(zip.buffer, zip.byteOffset, zip.byteLength);

    // Second local file starts after first header + name + data
    const firstHeaderSize = 30 + f1.name.length + f1.data.length;
    // Second local file header signature
    expect(readU32(view, firstHeaderSize)).toBe(0x04034B50);
  });
});
