// @vitest-environment jsdom
import { vi, describe, it, expect, beforeEach } from 'vitest';

const buildRecordingZipMock = vi.fn(() => new Uint8Array([0x50, 0x4B, 0x03, 0x04]));
const buildCollectionZipMock = vi.fn(() => new Uint8Array([0x50, 0x4B, 0x03, 0x04]));
const downloadBlobMock = vi.fn();

vi.mock('../../js/shared/zip.js', () => ({
  buildZip:          vi.fn(() => new Uint8Array([0])),
  buildRecordingZip: buildRecordingZipMock,
  buildCollectionZip: buildCollectionZipMock,
  downloadBlob:      downloadBlobMock,
}));

const { downloadAllAsZip, addRecording, clearRecordings } = await import(
  '../../js/tools/chordRecorder/chordRecorderFiles.js'
);

// ── helpers ───────────────────────────────────────────────────────────────────

function makeBlob(bytes = [0x52, 0x49, 0x46, 0x46]) {
  return new Blob([new Uint8Array(bytes)], { type: 'audio/wav' });
}

// ── downloadAllAsZip – single recording ───────────────────────────────────────

describe('downloadAllAsZip – Einzelaufnahme', () => {
  beforeEach(() => {
    clearRecordings();
    buildRecordingZipMock.mockClear();
    buildCollectionZipMock.mockClear();
    downloadBlobMock.mockClear();
  });

  it('ruft buildRecordingZip auf (nicht buildCollectionZip)', async () => {
    addRecording({ baseName: 'gdur_finger_laut_single_a1b2c', wavBlob: makeBlob(), sidecar: { chord: 'G-Dur' } });
    await downloadAllAsZip('chord-recordings');
    expect(buildRecordingZipMock).toHaveBeenCalledOnce();
    expect(buildCollectionZipMock).not.toHaveBeenCalled();
  });

  it('übergibt baseName, WAV-Bytes und JSON-Bytes an buildRecordingZip', async () => {
    addRecording({ baseName: 'amoll_finger_laut_single_zzzzz', wavBlob: makeBlob([1, 2, 3]), sidecar: { chord: 'A-Moll' } });
    await downloadAllAsZip();
    const [baseName, wavArg, jsonArg] = buildRecordingZipMock.mock.calls[0];
    expect(baseName).toBe('amoll_finger_laut_single_zzzzz');
    expect(wavArg).toBeInstanceOf(Uint8Array);
    expect(Array.from(wavArg)).toEqual([1, 2, 3]);
    const sidecar = JSON.parse(new TextDecoder().decode(jsonArg));
    expect(sidecar.chord).toBe('A-Moll');
  });

  it('lädt das ZIP mit baseName.zip herunter', async () => {
    addRecording({ baseName: 'cdur_plektrum_mittel_multi1_xxxxx', wavBlob: makeBlob(), sidecar: { chord: 'C-Dur' } });
    await downloadAllAsZip();
    expect(downloadBlobMock).toHaveBeenCalledWith(
      expect.any(Uint8Array),
      'cdur_plektrum_mittel_multi1_xxxxx.zip',
      'application/zip',
    );
  });
});

// ── downloadAllAsZip – mehrere Aufnahmen ──────────────────────────────────────

describe('downloadAllAsZip – mehrere Aufnahmen', () => {
  beforeEach(() => {
    clearRecordings();
    buildRecordingZipMock.mockClear();
    buildCollectionZipMock.mockClear();
    downloadBlobMock.mockClear();
  });

  it('ruft buildCollectionZip auf (nicht buildRecordingZip direkt)', async () => {
    addRecording({ baseName: 'gdur_a', wavBlob: makeBlob([1]), sidecar: { chord: 'G-Dur' } });
    addRecording({ baseName: 'amoll_b', wavBlob: makeBlob([2]), sidecar: { chord: 'A-Moll' } });
    await downloadAllAsZip('meine-aufnahmen');
    expect(buildCollectionZipMock).toHaveBeenCalledOnce();
    expect(buildRecordingZipMock).not.toHaveBeenCalled();
  });

  it('übergibt alle Recordings korrekt an buildCollectionZip', async () => {
    addRecording({ baseName: 'rec1', wavBlob: makeBlob([0xAA]), sidecar: { chord: 'G-Dur' } });
    addRecording({ baseName: 'rec2', wavBlob: makeBlob([0xBB]), sidecar: { chord: 'A-Moll' } });
    await downloadAllAsZip();
    const [recordings] = buildCollectionZipMock.mock.calls[0];
    expect(recordings).toHaveLength(2);
    expect(recordings[0].baseName).toBe('rec1');
    expect(recordings[1].baseName).toBe('rec2');
    expect(Array.from(recordings[0].wav)).toEqual([0xAA]);
    expect(Array.from(recordings[1].wav)).toEqual([0xBB]);
    const s1 = JSON.parse(new TextDecoder().decode(recordings[0].json));
    expect(s1.chord).toBe('G-Dur');
  });

  it('lädt das äußere ZIP mit dem basename-Argument herunter', async () => {
    addRecording({ baseName: 'x', wavBlob: makeBlob(), sidecar: {} });
    addRecording({ baseName: 'y', wavBlob: makeBlob(), sidecar: {} });
    await downloadAllAsZip('meine-sammlung');
    expect(downloadBlobMock).toHaveBeenCalledWith(
      expect.any(Uint8Array),
      'meine-sammlung.zip',
      'application/zip',
    );
  });
});

// ── downloadAllAsZip – leer ───────────────────────────────────────────────────

describe('downloadAllAsZip – keine Aufnahmen', () => {
  beforeEach(() => {
    clearRecordings();
    buildRecordingZipMock.mockClear();
    buildCollectionZipMock.mockClear();
    downloadBlobMock.mockClear();
  });

  it('macht nichts wenn der Store leer ist', async () => {
    await downloadAllAsZip();
    expect(buildRecordingZipMock).not.toHaveBeenCalled();
    expect(buildCollectionZipMock).not.toHaveBeenCalled();
    expect(downloadBlobMock).not.toHaveBeenCalled();
  });
});
