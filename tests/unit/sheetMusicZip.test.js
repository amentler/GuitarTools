// @vitest-environment jsdom
import { vi, describe, it, expect, beforeEach } from 'vitest';

// ── Mock zip.js before importing the module under test ────────────────────────

const buildRecordingZipMock = vi.fn(() => new Uint8Array([0x50, 0x4B, 0x03, 0x04]));
const buildCollectionZipMock = vi.fn(() => new Uint8Array([0x50, 0x4B, 0x03, 0x04]));
const downloadBlobMock = vi.fn();

vi.mock('../../js/shared/zip.js', () => ({
  buildZip:           vi.fn(() => new Uint8Array([0])),
  buildRecordingZip:  buildRecordingZipMock,
  buildCollectionZip: buildCollectionZipMock,
  downloadBlob:       downloadBlobMock,
}));

const saveSheetMusicTakeMock = vi.fn().mockResolvedValue(undefined);
vi.mock('../../js/shared/audioAnalyseStorage.js', () => ({
  saveSheetMusicTake: saveSheetMusicTakeMock,
}));

const collectBrowserEnvironmentMock = vi.fn().mockResolvedValue({ browser: 'test' });
vi.mock('../../js/shared/browserEnvironment.js', () => ({
  collectBrowserEnvironment: collectBrowserEnvironmentMock,
}));

const { createRecordingUI } = await import(
  '../../js/games/sheetMusicReading/sheetMusicReadingRecordingUI.js'
);

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeRecorder(wav = new Uint8Array([1, 2, 3])) {
  let _recording = false;
  let _mimeType = '';
  return {
    get isRecording() { return _recording; },
    get mimeType() { return _mimeType; },
    start: vi.fn().mockImplementation(async () => { _recording = true; _mimeType = 'audio/wav'; }),
    stop:  vi.fn().mockResolvedValue(wav),
    cancel: vi.fn().mockImplementation(() => { _recording = false; }),
  };
}

function makeState(bars = [[{ name: 'E', octave: 4 }]]) {
  return { bars, bpm: 80, timeSig: '4/4' };
}

// ── single recording → buildRecordingZip ─────────────────────────────────────

describe('downloadRecordings – Einzelaufnahme', () => {
  beforeEach(() => {
    buildRecordingZipMock.mockClear();
    buildCollectionZipMock.mockClear();
    downloadBlobMock.mockClear();
  });

  it('ruft buildRecordingZip auf und nicht buildCollectionZip', async () => {
    let saved = [];
    const recorder = makeRecorder(new Uint8Array([0xAA]));
    const ui = createRecordingUI({
      recorder,
      getSaved: () => saved,
      setSaved: (s) => { saved = s; },
      getAudioSession: () => ({ stream: null }),
      getUI: () => ({ recordBtn: null, recordStopBtn: null, recordCancelBtn: null, downloadBtn: null, analyseBtn: null, recordingsBtn: null }),
    });

    await ui.startRecording();
    await ui.stopRecording(makeState());

    // Suppress confirm dialog
    vi.stubGlobal('confirm', () => false);
    ui.downloadRecordings();
    vi.unstubAllGlobals();

    expect(buildRecordingZipMock).toHaveBeenCalledOnce();
    expect(buildCollectionZipMock).not.toHaveBeenCalled();
  });

  it('übergibt baseName, WAV-Bytes und JSON-Bytes an buildRecordingZip', async () => {
    const wav = new Uint8Array([0x52, 0x49, 0x46, 0x46]);
    let saved = [];
    const recorder = makeRecorder(wav);
    const ui = createRecordingUI({
      recorder,
      getSaved: () => saved,
      setSaved: (s) => { saved = s; },
      getAudioSession: () => ({ stream: null }),
      getUI: () => ({ recordBtn: null, recordStopBtn: null, recordCancelBtn: null, downloadBtn: null, analyseBtn: null, recordingsBtn: null }),
    });

    await ui.startRecording();
    await ui.stopRecording(makeState());

    vi.stubGlobal('confirm', () => false);
    ui.downloadRecordings();
    vi.unstubAllGlobals();

    const [baseName, wavArg, jsonArg] = buildRecordingZipMock.mock.calls[0];
    expect(baseName).toMatch(/^notenlesen_4-4_80bpm_E_[0-9a-z]{5}$/);
    expect(Array.from(wavArg)).toEqual([0x52, 0x49, 0x46, 0x46]);
    const manifest = JSON.parse(new TextDecoder().decode(jsonArg));
    expect(manifest.category).toBe('sheet-music-reading');
  });

  it('lädt ZIP mit baseName.zip herunter', async () => {
    let saved = [];
    const recorder = makeRecorder();
    const ui = createRecordingUI({
      recorder,
      getSaved: () => saved,
      setSaved: (s) => { saved = s; },
      getAudioSession: () => ({ stream: null }),
      getUI: () => ({ recordBtn: null, recordStopBtn: null, recordCancelBtn: null, downloadBtn: null, analyseBtn: null, recordingsBtn: null }),
    });

    await ui.startRecording();
    await ui.stopRecording(makeState());

    vi.stubGlobal('confirm', () => false);
    ui.downloadRecordings();
    vi.unstubAllGlobals();

    expect(downloadBlobMock).toHaveBeenCalledWith(
      expect.any(Uint8Array),
      expect.stringMatching(/^notenlesen_4-4_80bpm_E_[0-9a-z]{5}\.zip$/),
      'application/zip',
    );
  });
});

// ── multiple recordings → buildCollectionZip ─────────────────────────────────

describe('downloadRecordings – mehrere Aufnahmen', () => {
  beforeEach(() => {
    buildRecordingZipMock.mockClear();
    buildCollectionZipMock.mockClear();
    downloadBlobMock.mockClear();
  });

  it('ruft buildCollectionZip auf wenn 2 Aufnahmen vorhanden sind', async () => {
    let saved = [];
    const recorder = makeRecorder();
    const ui = createRecordingUI({
      recorder,
      getSaved: () => saved,
      setSaved: (s) => { saved = s; },
      getAudioSession: () => ({ stream: null }),
      getUI: () => ({ recordBtn: null, recordStopBtn: null, recordCancelBtn: null, downloadBtn: null, analyseBtn: null, recordingsBtn: null }),
    });

    await ui.startRecording();
    await ui.stopRecording(makeState());
    await ui.startRecording();
    await ui.stopRecording(makeState([[{ name: 'B', octave: 3 }]]));

    vi.stubGlobal('confirm', () => false);
    ui.downloadRecordings();
    vi.unstubAllGlobals();

    expect(buildCollectionZipMock).toHaveBeenCalledOnce();
    expect(buildRecordingZipMock).not.toHaveBeenCalled();
  });

  it('übergibt alle Recordings an buildCollectionZip', async () => {
    let saved = [];
    const recorder = makeRecorder();
    const ui = createRecordingUI({
      recorder,
      getSaved: () => saved,
      setSaved: (s) => { saved = s; },
      getAudioSession: () => ({ stream: null }),
      getUI: () => ({ recordBtn: null, recordStopBtn: null, recordCancelBtn: null, downloadBtn: null, analyseBtn: null, recordingsBtn: null }),
    });

    await ui.startRecording();
    await ui.stopRecording(makeState([[{ name: 'E', octave: 4 }]]));
    await ui.startRecording();
    await ui.stopRecording(makeState([[{ name: 'A', octave: 3 }]]));

    vi.stubGlobal('confirm', () => false);
    ui.downloadRecordings();
    vi.unstubAllGlobals();

    const [recordings] = buildCollectionZipMock.mock.calls[0];
    expect(recordings).toHaveLength(2);
    expect(recordings[0].baseName).toMatch(/^notenlesen_4-4_80bpm_/);
    expect(recordings[1].baseName).toMatch(/^notenlesen_4-4_80bpm_/);
    expect(recordings[0].baseName).not.toBe(recordings[1].baseName);
  });

  it('lädt Container-ZIP mit Zeitstempel im Namen herunter', async () => {
    let saved = [];
    const recorder = makeRecorder();
    const ui = createRecordingUI({
      recorder,
      getSaved: () => saved,
      setSaved: (s) => { saved = s; },
      getAudioSession: () => ({ stream: null }),
      getUI: () => ({ recordBtn: null, recordStopBtn: null, recordCancelBtn: null, downloadBtn: null, analyseBtn: null, recordingsBtn: null }),
    });

    await ui.startRecording();
    await ui.stopRecording(makeState());
    await ui.startRecording();
    await ui.stopRecording(makeState([[{ name: 'B', octave: 3 }]]));

    vi.stubGlobal('confirm', () => false);
    ui.downloadRecordings();
    vi.unstubAllGlobals();

    expect(downloadBlobMock).toHaveBeenCalledWith(
      expect.any(Uint8Array),
      expect.stringMatching(/^noten-lesen-aufnahmen-\d+\.zip$/),
      'application/zip',
    );
  });
});
