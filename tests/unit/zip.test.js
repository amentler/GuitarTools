// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { crc32, buildZip, downloadBlob, buildRecordingZip, buildCollectionZip, readZip } from '../../js/shared/zip.js';

// ── crc32 ────────────────────────────────────────────────────────────────────

describe('crc32', () => {
  it('returns 0x00000000 for empty data', () => {
    // CRC-32 of empty input is 0x00000000
    expect(crc32(new Uint8Array([]))).toBe(0x00000000);
  });

  it('returns correct CRC for single byte 0x00', () => {
    expect(crc32(new Uint8Array([0x00]))).toBe(0xD202EF8D);
  });

  it('returns correct CRC for ASCII "123456789"', () => {
    // Well-known CRC-32 check value
    const data = new TextEncoder().encode('123456789');
    expect(crc32(data)).toBe(0xCBF43926);
  });

  it('returns an unsigned 32-bit number', () => {
    const result = crc32(new Uint8Array([0xFF, 0xFE, 0xFD]));
    expect(result).toBeGreaterThanOrEqual(0);
    expect(result).toBeLessThanOrEqual(0xFFFFFFFF);
  });
});

// ── buildZip ─────────────────────────────────────────────────────────────────

describe('buildZip', () => {
  it('returns a Uint8Array', () => {
    const result = buildZip([]);
    expect(result).toBeInstanceOf(Uint8Array);
  });

  it('produces a valid EOCD signature for empty file list', () => {
    const zip = buildZip([]);
    const view = new DataView(zip.buffer, zip.byteOffset, zip.byteLength);
    // EOCD starts at offset 0 for empty ZIP
    expect(view.getUint32(0, true)).toBe(0x06054B50);
    // 0 entries
    expect(view.getUint16(8, true)).toBe(0);
    expect(view.getUint16(10, true)).toBe(0);
  });

  it('contains correct local file header signature for one file', () => {
    const data = new TextEncoder().encode('hello');
    const zip = buildZip([{ name: 'hello.txt', data }]);
    const view = new DataView(zip.buffer, zip.byteOffset, zip.byteLength);
    expect(view.getUint32(0, true)).toBe(0x04034B50);
  });

  it('contains correct central directory signature for one file', () => {
    const data = new TextEncoder().encode('hello');
    const zip = buildZip([{ name: 'hello.txt', data }]);
    // Central directory starts after local header (30 + name + data)
    const nameLen = new TextEncoder().encode('hello.txt').length;
    const cdOffset = 30 + nameLen + data.length;
    const view = new DataView(zip.buffer, zip.byteOffset, zip.byteLength);
    expect(view.getUint32(cdOffset, true)).toBe(0x02014B50);
  });

  it('contains correct EOCD signature for one file', () => {
    const data = new TextEncoder().encode('hello');
    const zip = buildZip([{ name: 'hello.txt', data }]);
    const view = new DataView(zip.buffer, zip.byteOffset, zip.byteLength);
    // EOCD is always last 22 bytes
    const eocdOffset = zip.length - 22;
    expect(view.getUint32(eocdOffset, true)).toBe(0x06054B50);
  });

  it('reports correct entry count for multiple files', () => {
    const files = [
      { name: 'a.txt', data: new TextEncoder().encode('aaa') },
      { name: 'b.txt', data: new TextEncoder().encode('bbb') },
      { name: 'c.wav', data: new Uint8Array([0x52, 0x49, 0x46, 0x46]) },
    ];
    const zip = buildZip(files);
    const view = new DataView(zip.buffer, zip.byteOffset, zip.byteLength);
    const eocdOffset = zip.length - 22;
    expect(view.getUint16(eocdOffset + 8,  true)).toBe(3); // entries on disk
    expect(view.getUint16(eocdOffset + 10, true)).toBe(3); // total entries
  });

  it('embeds the file data uncompressed', () => {
    const payload = new TextEncoder().encode('world');
    const zip = buildZip([{ name: 'w.txt', data: payload }]);
    const nameLen = new TextEncoder().encode('w.txt').length;
    const dataStart = 30 + nameLen;
    expect(Array.from(zip.slice(dataStart, dataStart + payload.length))).toEqual(Array.from(payload));
  });

  it('sets compression method to 0 (Store)', () => {
    const zip = buildZip([{ name: 'x.txt', data: new Uint8Array([1, 2, 3]) }]);
    const view = new DataView(zip.buffer, zip.byteOffset, zip.byteLength);
    expect(view.getUint16(8, true)).toBe(0); // compression method in local header
  });

  it('stores matching CRC in local header and central directory', () => {
    const data = new TextEncoder().encode('test-data');
    const zip = buildZip([{ name: 't.txt', data }]);
    const view = new DataView(zip.buffer, zip.byteOffset, zip.byteLength);
    const nameLen = new TextEncoder().encode('t.txt').length;

    const localCrc  = view.getUint32(14, true);            // offset 14 in local header
    const cdOffset  = 30 + nameLen + data.length;
    const cdCrc     = view.getUint32(cdOffset + 16, true); // offset 16 in CD record

    expect(localCrc).toBe(cdCrc);
    expect(localCrc).toBe(crc32(data));
  });
});

// ── buildRecordingZip ────────────────────────────────────────────────────────

describe('buildRecordingZip', () => {
  const enc = new TextEncoder();

  it('returns a Uint8Array with local file header signature', () => {
    const zip = buildRecordingZip('foo', new Uint8Array([1, 2]), enc.encode('{}'));
    const view = new DataView(zip.buffer, zip.byteOffset, zip.byteLength);
    expect(view.getUint32(0, true)).toBe(0x04034B50);
  });

  it('contains exactly 2 entries', () => {
    const zip = buildRecordingZip('foo', new Uint8Array([1, 2]), enc.encode('{}'));
    const view = new DataView(zip.buffer, zip.byteOffset, zip.byteLength);
    const eocdOffset = zip.length - 22;
    expect(view.getUint16(eocdOffset + 8, true)).toBe(2);
  });

  it('first entry is named baseName.wav', () => {
    const zip = buildRecordingZip('myRec', new Uint8Array([0]), enc.encode('{}'));
    const nameLen = zip[26] | (zip[27] << 8);
    const name = new TextDecoder().decode(zip.slice(30, 30 + nameLen));
    expect(name).toBe('myRec.wav');
  });

  it('second entry is named baseName.json', () => {
    const wavData  = new Uint8Array([0x52, 0x49, 0x46, 0x46]);
    const jsonData = enc.encode('{"x":1}');
    const zip = buildRecordingZip('track', wavData, jsonData);
    const firstNameLen  = zip[26] | (zip[27] << 8);
    const firstEntryEnd = 30 + firstNameLen + wavData.length;
    const secondNameLen = zip[firstEntryEnd + 26] | (zip[firstEntryEnd + 27] << 8);
    const secondName = new TextDecoder().decode(zip.slice(firstEntryEnd + 30, firstEntryEnd + 30 + secondNameLen));
    expect(secondName).toBe('track.json');
  });

  it('embeds wav data uncompressed in first entry', () => {
    const wavData  = new Uint8Array([0xAA, 0xBB, 0xCC]);
    const jsonData = enc.encode('{}');
    const zip = buildRecordingZip('r', wavData, jsonData);
    const nameLen  = zip[26] | (zip[27] << 8);
    const dataStart = 30 + nameLen;
    expect(Array.from(zip.slice(dataStart, dataStart + wavData.length))).toEqual([0xAA, 0xBB, 0xCC]);
  });
});

// ── buildCollectionZip ───────────────────────────────────────────────────────

describe('buildCollectionZip', () => {
  const enc = new TextEncoder();
  const makeRec = (baseName) => ({ baseName, wav: new Uint8Array([1, 2, 3]), json: enc.encode('{}') });

  it('empty list → 0-entry ZIP', () => {
    const zip = buildCollectionZip([]);
    const view = new DataView(zip.buffer, zip.byteOffset, zip.byteLength);
    const eocdOffset = zip.length - 22;
    expect(view.getUint16(eocdOffset + 8, true)).toBe(0);
  });

  it('N recordings → N entries in outer ZIP, each ending with .zip', () => {
    const zip = buildCollectionZip([makeRec('a'), makeRec('b'), makeRec('c')]);
    const view = new DataView(zip.buffer, zip.byteOffset, zip.byteLength);
    const eocdOffset = zip.length - 22;
    expect(view.getUint16(eocdOffset + 8, true)).toBe(3);
    const nameLen = zip[26] | (zip[27] << 8);
    const name = new TextDecoder().decode(zip.slice(30, 30 + nameLen));
    expect(name).toBe('a.zip');
  });

  it('each inner entry starts with a valid local file header (PK\\x03\\x04)', () => {
    const zip = buildCollectionZip([makeRec('x'), makeRec('y')]);
    const entries = readZip(zip);
    expect(entries).toHaveLength(2);
    for (const entry of entries) {
      const innerView = new DataView(entry.data.buffer, entry.data.byteOffset, entry.data.byteLength);
      expect(innerView.getUint32(0, true)).toBe(0x04034B50);
    }
  });

  it('inner ZIP round-trip: contains baseName.wav and baseName.json', () => {
    const wavData  = new Uint8Array([0x11, 0x22]);
    const jsonData = enc.encode('{"chord":"A"}');
    const zip = buildCollectionZip([{ baseName: 'demo', wav: wavData, json: jsonData }]);
    const outer = readZip(zip);
    expect(outer).toHaveLength(1);
    expect(outer[0].name).toBe('demo.zip');
    const inner = readZip(outer[0].data);
    const names = inner.map(e => e.name);
    expect(names).toContain('demo.wav');
    expect(names).toContain('demo.json');
    const wavEntry  = inner.find(e => e.name === 'demo.wav');
    const jsonEntry = inner.find(e => e.name === 'demo.json');
    expect(Array.from(wavEntry.data)).toEqual([0x11, 0x22]);
    expect(new TextDecoder().decode(jsonEntry.data)).toBe('{"chord":"A"}');
  });
});

// ── readZip ───────────────────────────────────────────────────────────────────

describe('readZip', () => {
  const enc = new TextEncoder();

  it('empty ZIP → empty array', () => {
    const zip = buildZip([]);
    expect(readZip(zip)).toEqual([]);
  });

  it('round-trips a single file through buildZip', () => {
    const data = new Uint8Array([0x01, 0x02, 0x03]);
    const zip = buildZip([{ name: 'a.wav', data }]);
    const entries = readZip(zip);
    expect(entries).toHaveLength(1);
    expect(entries[0].name).toBe('a.wav');
    expect(Array.from(entries[0].data)).toEqual([0x01, 0x02, 0x03]);
  });

  it('round-trips multiple files', () => {
    const files = [
      { name: 'x.wav',  data: new Uint8Array([0xAA]) },
      { name: 'x.json', data: enc.encode('{"k":1}') },
    ];
    const zip = buildZip(files);
    const entries = readZip(zip);
    expect(entries).toHaveLength(2);
    expect(entries[0].name).toBe('x.wav');
    expect(entries[1].name).toBe('x.json');
    expect(Array.from(entries[1].data)).toEqual(Array.from(enc.encode('{"k":1}')));
  });

  it('reads buildRecordingZip output correctly', () => {
    const wavData  = new Uint8Array([0xFF, 0xFE]);
    const jsonData = enc.encode('{"t":true}');
    const zip = buildRecordingZip('rec', wavData, jsonData);
    const entries = readZip(zip);
    expect(entries).toHaveLength(2);
    expect(entries[0].name).toBe('rec.wav');
    expect(entries[1].name).toBe('rec.json');
    expect(Array.from(entries[0].data)).toEqual([0xFF, 0xFE]);
    expect(new TextDecoder().decode(entries[1].data)).toBe('{"t":true}');
  });

  it('stops at Central Directory (does not produce spurious entries)', () => {
    const zip = buildZip([
      { name: 'a.txt', data: enc.encode('hello') },
      { name: 'b.txt', data: enc.encode('world') },
    ]);
    const entries = readZip(zip);
    expect(entries).toHaveLength(2);
  });
});

// ── downloadBlob ─────────────────────────────────────────────────────────────

describe('downloadBlob', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('creates an anchor element and triggers a click', () => {
    const mockUrl = 'blob:mock-url';
    const mockAnchor = { href: '', download: '', style: {}, click: vi.fn() };

    vi.spyOn(URL, 'createObjectURL').mockReturnValue(mockUrl);
    vi.spyOn(URL, 'revokeObjectURL').mockReturnValue(undefined);
    vi.spyOn(document, 'createElement').mockReturnValue(mockAnchor);
    vi.spyOn(document.body, 'appendChild').mockReturnValue(undefined);
    vi.spyOn(document.body, 'removeChild').mockReturnValue(undefined);

    downloadBlob(new Uint8Array([1, 2, 3]), 'test.zip', 'application/zip');

    expect(mockAnchor.href).toBe(mockUrl);
    expect(mockAnchor.download).toBe('test.zip');
    expect(mockAnchor.click).toHaveBeenCalledOnce();
    expect(URL.revokeObjectURL).toHaveBeenCalledWith(mockUrl);
  });
});
