import { describe, it, expect } from 'vitest';
import {
  addRecording,
  generateRandom5,
  getAllRecordings,
  getRecordingCount,
  removeRecordingByBaseName,
  toChordKey,
  buildFileName,
  buildSidecarJson,
  clearRecordings,
} from '../../js/tools/chordRecorder/chordRecorderFiles.js';

// ── generateRandom5 ───────────────────────────────────────────────────────────

describe('generateRandom5', () => {
  it('erzeugt genau 5 Zeichen', () => {
    expect(generateRandom5()).toHaveLength(5);
  });

  it('enthält nur 0-9 und a-z (ASCII)', () => {
    for (let i = 0; i < 30; i++) {
      expect(generateRandom5()).toMatch(/^[0-9a-z]{5}$/);
    }
  });

  it('erzeugt unterschiedliche Werte (Zufälligkeit)', () => {
    const values = new Set(Array.from({ length: 30 }, generateRandom5));
    expect(values.size).toBeGreaterThan(1);
  });
});

// ── toChordKey ────────────────────────────────────────────────────────────────

describe('toChordKey', () => {
  it('G-Dur → gdur', () => expect(toChordKey('G-Dur')).toBe('gdur'));
  it('H7 → h7', () => expect(toChordKey('H7')).toBe('h7'));
  it('F-Dur (klein) → fdurklein', () => expect(toChordKey('F-Dur (klein)')).toBe('fdurklein'));
  it('G-Dur (1-Finger) → gdur1finger', () => expect(toChordKey('G-Dur (1-Finger)')).toBe('gdur1finger'));
  it('G-Dur (Rock) → gdurrock', () => expect(toChordKey('G-Dur (Rock)')).toBe('gdurrock'));
  it('Cmaj7 → cmaj7', () => expect(toChordKey('Cmaj7')).toBe('cmaj7'));
  it('Am7 → am7', () => expect(toChordKey('Am7')).toBe('am7'));
  it('Adim → adim', () => expect(toChordKey('Adim')).toBe('adim'));
  it('Asus4 → asus4', () => expect(toChordKey('Asus4')).toBe('asus4'));
  it('G7sus4 → g7sus4', () => expect(toChordKey('G7sus4')).toBe('g7sus4'));
  it('Cadd9 → cadd9', () => expect(toChordKey('Cadd9')).toBe('cadd9'));
  it('E-Moll → emoll', () => expect(toChordKey('E-Moll')).toBe('emoll'));
});

// ── buildFileName ─────────────────────────────────────────────────────────────

describe('buildFileName', () => {
  const variation = { technik: 'fingernagel', lautstaerke: 'laut', strumModus: 'single', repeatIndex: 1 };

  it('erzeugt korrektes Schema: chordKey_technik_lautstaerke_strumModus_random5', () => {
    expect(buildFileName(variation, 'gdur', 'a3f2x')).toBe('gdur_fingernagel_laut_single_a3f2x');
  });

  it('enthält keine Extension', () => {
    const name = buildFileName(variation, 'gdur', 'a3f2x');
    expect(name).not.toContain('.');
  });

  it('plektrum / leise / multi1', () => {
    const v = { technik: 'plektrum', lautstaerke: 'leise', strumModus: 'multi1', repeatIndex: 2 };
    expect(buildFileName(v, 'emoll', 'abc12')).toBe('emoll_plektrum_leise_multi1_abc12');
  });

  it('finger / laut / multi2', () => {
    const v = { technik: 'finger', lautstaerke: 'laut', strumModus: 'multi2', repeatIndex: 1 };
    expect(buildFileName(v, 'cdur', 'zzzzz')).toBe('cdur_finger_laut_multi2_zzzzz');
  });

  it('generiert random5 automatisch wenn nicht übergeben', () => {
    const name = buildFileName(variation, 'gdur');
    expect(name).toMatch(/^gdur_fingernagel_laut_single_[0-9a-z]{5}$/);
  });
});

// ── buildSidecarJson ──────────────────────────────────────────────────────────

describe('buildSidecarJson', () => {
  const variation = { technik: 'finger', lautstaerke: 'laut', strumModus: 'single', repeatIndex: 1 };
  const config    = { guitarSize: 'Vollgröße', guitarStrings: 'Steel' };
  const quality   = { passed: true, failReasons: [], warnReasons: [] };
  const meta      = { sampleRate: 44100, durationSec: 3.2, userFlags: [] };

  it('enthält alle Pflichtfelder', () => {
    const s = buildSidecarJson('G-Dur', 'gdur', variation, config, quality, meta);
    expect(s).toMatchObject({
      chord: 'G-Dur',
      chordKey: 'gdur',
      guitarSize: 'Vollgröße',
      guitarStrings: 'Steel',
      volume: 'laut',
      technique: 'finger',
      strumMode: 'single',
      repeatIndex: 1,
      sampleRate: 44100,
      durationSeconds: 3.2,
    });
  });

  it('quality-Block korrekt', () => {
    const s = buildSidecarJson('G-Dur', 'gdur', variation, config, quality, meta);
    expect(s.quality).toMatchObject({
      passed: true,
      failReasons: [],
      warnReasons: [],
      userFlags: [],
    });
  });

  it('recordedAt ist valides ISO-Datum', () => {
    const s = buildSidecarJson('G-Dur', 'gdur', variation, config, quality, meta);
    expect(s.recordedAt).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
    expect(Number.isNaN(new Date(s.recordedAt).getTime())).toBe(false);
  });

  it('userFlags werden übernommen', () => {
    const m = { ...meta, userFlags: ['buzz'] };
    const s = buildSidecarJson('G-Dur', 'gdur', variation, config, quality, m);
    expect(s.quality.userFlags).toEqual(['buzz']);
  });

  it('failed quality korrekt übernommen', () => {
    const q = { passed: false, failReasons: ['clipping', 'tooQuiet'], warnReasons: [] };
    const s = buildSidecarJson('A-Moll', 'amoll', variation, config, q, meta);
    expect(s.quality.passed).toBe(false);
    expect(s.quality.failReasons).toContain('clipping');
  });

  it('warnReasons werden übernommen', () => {
    const q = { passed: true, failReasons: [], warnReasons: ['highSilenceRatio'] };
    const s = buildSidecarJson('G-Dur', 'gdur', variation, config, q, meta);
    expect(s.quality.warnReasons).toContain('highSilenceRatio');
  });

  it('Nylon-Saiten korrekt', () => {
    const c = { guitarSize: '3/4', guitarStrings: 'Nylon' };
    const s = buildSidecarJson('C-Dur', 'cdur', variation, c, quality, meta);
    expect(s.guitarStrings).toBe('Nylon');
    expect(s.guitarSize).toBe('3/4');
  });
});

// ── in-memory store ───────────────────────────────────────────────────────────

describe('recording store', () => {
  it('adds, lists and removes recordings by base name', () => {
    clearRecordings();
    addRecording({ baseName: 'take-a', wavBlob: new Blob(['a']), sidecar: { chord: 'A-Dur' } });
    addRecording({ baseName: 'take-b', wavBlob: new Blob(['b']), sidecar: { chord: 'H-Dur' } });

    expect(getRecordingCount()).toBe(2);
    expect(getAllRecordings().map(entry => entry.baseName)).toEqual(['take-a', 'take-b']);

    const removed = removeRecordingByBaseName('take-a');

    expect(removed?.baseName).toBe('take-a');
    expect(getRecordingCount()).toBe(1);
    expect(getAllRecordings().map(entry => entry.baseName)).toEqual(['take-b']);

    clearRecordings();
  });
});
