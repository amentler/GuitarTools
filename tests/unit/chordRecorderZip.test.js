import { describe, it, expect } from 'vitest';
import { crc32, buildZip } from '../../js/shared/zip.js';

const enc = new TextEncoder();

// ── crc32 ─────────────────────────────────────────────────────────────────────

describe('crc32', () => {
  it('leerer Buffer → 0', () => {
    expect(crc32(new Uint8Array(0))).toBe(0x00000000);
  });

  it('bekannter Wert: "hello" → 0x3610A686', () => {
    expect(crc32(enc.encode('hello'))).toBe(0x3610A686);
  });

  it('bekannter Wert: "123456789" → 0xCBF43926', () => {
    expect(crc32(enc.encode('123456789'))).toBe(0xCBF43926);
  });

  it('einzelnes Byte 0x00 → 0xD202EF8D', () => {
    expect(crc32(new Uint8Array([0x00]))).toBe(0xD202EF8D);
  });
});

// ── buildZip ──────────────────────────────────────────────────────────────────

describe('buildZip', () => {
  it('leere Dateiliste → 22 Byte EOCD-Only-ZIP', () => {
    const zip = buildZip([]);
    expect(zip.length).toBe(22);
  });

  it('beginnt mit Local-File-Header-Signatur PK\\x03\\x04', () => {
    const zip = buildZip([{ name: 'a.txt', data: enc.encode('x') }]);
    expect(zip[0]).toBe(0x50); // P
    expect(zip[1]).toBe(0x4B); // K
    expect(zip[2]).toBe(0x03);
    expect(zip[3]).toBe(0x04);
  });

  it('endet mit EOCD-Signatur PK\\x05\\x06', () => {
    const zip = buildZip([{ name: 'a.txt', data: enc.encode('hello') }]);
    const last = zip.slice(zip.length - 22);
    expect(last[0]).toBe(0x50);
    expect(last[1]).toBe(0x4B);
    expect(last[2]).toBe(0x05);
    expect(last[3]).toBe(0x06);
  });

  it('EOCD enthält korrekte Datei-Anzahl (1 Datei)', () => {
    const zip = buildZip([{ name: 'f.txt', data: enc.encode('data') }]);
    const eocd = new DataView(zip.buffer, zip.length - 22, 22);
    expect(eocd.getUint16(8, true)).toBe(1);  // entries on disk
    expect(eocd.getUint16(10, true)).toBe(1); // total entries
  });

  it('EOCD enthält korrekte Datei-Anzahl (3 Dateien)', () => {
    const files = [
      { name: 'a.wav', data: new Uint8Array([1, 2, 3]) },
      { name: 'a.json', data: enc.encode('{}') },
      { name: 'b.wav', data: new Uint8Array([4, 5]) },
    ];
    const zip = buildZip(files);
    const eocd = new DataView(zip.buffer, zip.length - 22, 22);
    expect(eocd.getUint16(8, true)).toBe(3);
  });

  it('Dateiname im Local-Header enthalten', () => {
    const zip = buildZip([{ name: 'test.wav', data: new Uint8Array([0]) }]);
    const text = new TextDecoder().decode(zip.slice(30, 38));
    expect(text).toBe('test.wav');
  });

  it('Dateiinhalt nach Local-Header direkt lesbar', () => {
    const data = enc.encode('hello world');
    const name = 'hello.txt';
    const zip = buildZip([{ name, data }]);
    const dataStart = 30 + name.length;
    const extracted = zip.slice(dataStart, dataStart + data.length);
    expect(extracted).toEqual(data);
  });
});
