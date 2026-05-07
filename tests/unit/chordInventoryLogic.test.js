import { describe, it, expect } from 'vitest';
import {
  buildInventoryEntry,
  countMatchingRecordings,
  isChordSufficient,
} from '../../js/tools/chordRecorder/chordInventoryLogic.js';

const FULL_SIDECAR = {
  chord: 'A-Dur',
  chordKey: 'adur',
  guitarSize: 'Vollgröße',
  guitarStrings: 'Nylon',
  volume: 'laut',
  technique: 'finger',
  strumMode: 'single',
  repeatIndex: 1,
  quality: { passed: true, failReasons: [], warnReasons: [], userFlags: [] },
  recordedAt: '2026-05-07T10:00:00.000Z',
  sampleRate: 44100,
  durationSeconds: 3.2,
};

// ── buildInventoryEntry ───────────────────────────────────────────────────────

describe('buildInventoryEntry', () => {
  it('extrahiert nur relevante Felder', () => {
    const entry = buildInventoryEntry(FULL_SIDECAR);
    expect(entry).toEqual({
      chord: 'A-Dur',
      chordKey: 'adur',
      guitarSize: 'Vollgröße',
      guitarStrings: 'Nylon',
      technique: 'finger',
      strumMode: 'single',
      volume: 'laut',
    });
  });

  it('enthält keine quality oder repeatIndex', () => {
    const entry = buildInventoryEntry(FULL_SIDECAR);
    expect(entry).not.toHaveProperty('quality');
    expect(entry).not.toHaveProperty('repeatIndex');
    expect(entry).not.toHaveProperty('recordedAt');
    expect(entry).not.toHaveProperty('sampleRate');
  });

  it('überträgt guitarStrings korrekt', () => {
    const entry = buildInventoryEntry({ ...FULL_SIDECAR, guitarStrings: 'Steel' });
    expect(entry.guitarStrings).toBe('Steel');
  });
});

// ── countMatchingRecordings ───────────────────────────────────────────────────

function makeEntry(overrides = {}) {
  return {
    chord: 'A-Dur',
    chordKey: 'adur',
    guitarSize: 'Vollgröße',
    guitarStrings: 'Nylon',
    technique: 'finger',
    strumMode: 'single',
    volume: 'laut',
    ...overrides,
  };
}

describe('countMatchingRecordings', () => {
  it('gibt 0 zurück bei leerer Liste', () => {
    expect(countMatchingRecordings([], 'adur', {})).toBe(0);
  });

  it('gibt 0 wenn chordKey nicht übereinstimmt', () => {
    const recs = [makeEntry(), makeEntry(), makeEntry()];
    expect(countMatchingRecordings(recs, 'gdur', {})).toBe(0);
  });

  it('zählt alle passenden Einträge mit leerem Filter', () => {
    const recs = [makeEntry(), makeEntry(), makeEntry()];
    expect(countMatchingRecordings(recs, 'adur', {})).toBe(3);
  });

  it('filtert nach guitarSize', () => {
    const recs = [makeEntry(), makeEntry({ guitarSize: '3/4' })];
    expect(countMatchingRecordings(recs, 'adur', { guitarSize: 'Vollgröße' })).toBe(1);
  });

  it('gibt 0 wenn guitarSize nicht stimmt', () => {
    const recs = [makeEntry()];
    expect(countMatchingRecordings(recs, 'adur', { guitarSize: '3/4' })).toBe(0);
  });

  it('filtert nach guitarStrings', () => {
    const recs = [makeEntry(), makeEntry({ guitarStrings: 'Steel' })];
    expect(countMatchingRecordings(recs, 'adur', { guitarStrings: 'Nylon' })).toBe(1);
  });

  it('gibt 0 wenn guitarStrings nicht stimmt', () => {
    const recs = [makeEntry()];
    expect(countMatchingRecordings(recs, 'adur', { guitarStrings: 'Steel' })).toBe(0);
  });

  it('filtert nach techniken — technique nicht in Liste', () => {
    const recs = [makeEntry({ technique: 'plektrum' })];
    expect(countMatchingRecordings(recs, 'adur', { techniken: ['finger'] })).toBe(0);
  });

  it('filtert nach techniken — technique in Liste', () => {
    const recs = [makeEntry({ technique: 'finger' }), makeEntry({ technique: 'plektrum' })];
    expect(countMatchingRecordings(recs, 'adur', { techniken: ['finger'] })).toBe(1);
  });

  it('leere techniken-Array bedeutet keine Einschränkung', () => {
    const recs = [makeEntry({ technique: 'finger' }), makeEntry({ technique: 'plektrum' })];
    expect(countMatchingRecordings(recs, 'adur', { techniken: [] })).toBe(2);
  });

  it('zählt Einträge mit beiden Techniken wenn beide im Filter', () => {
    const recs = [makeEntry({ technique: 'finger' }), makeEntry({ technique: 'plektrum' })];
    expect(countMatchingRecordings(recs, 'adur', { techniken: ['finger', 'plektrum'] })).toBe(2);
  });

  it('filtert nach strumModi — strumMode nicht in Liste', () => {
    const recs = [makeEntry({ strumMode: 'multi1' })];
    expect(countMatchingRecordings(recs, 'adur', { strumModi: ['single'] })).toBe(0);
  });

  it('filtert nach strumModi — strumMode in Liste', () => {
    const recs = [makeEntry({ strumMode: 'single' }), makeEntry({ strumMode: 'multi1' })];
    expect(countMatchingRecordings(recs, 'adur', { strumModi: ['single'] })).toBe(1);
  });

  it('leere strumModi-Array bedeutet keine Einschränkung', () => {
    const recs = [makeEntry({ strumMode: 'single' }), makeEntry({ strumMode: 'multi1' })];
    expect(countMatchingRecordings(recs, 'adur', { strumModi: [] })).toBe(2);
  });

  it('kombiniert mehrere Filter gleichzeitig', () => {
    const recs = [
      makeEntry({ technique: 'finger', strumMode: 'single', guitarSize: 'Vollgröße' }),
      makeEntry({ technique: 'plektrum', strumMode: 'single', guitarSize: 'Vollgröße' }),
      makeEntry({ technique: 'finger', strumMode: 'multi1', guitarSize: 'Vollgröße' }),
      makeEntry({ technique: 'finger', strumMode: 'single', guitarSize: '3/4' }),
    ];
    const filter = { guitarSize: 'Vollgröße', techniken: ['finger'], strumModi: ['single'] };
    expect(countMatchingRecordings(recs, 'adur', filter)).toBe(1);
  });
});

// ── isChordSufficient ─────────────────────────────────────────────────────────

describe('isChordSufficient', () => {
  it('false bei 0 Treffern', () => {
    expect(isChordSufficient([], 'adur', {})).toBe(false);
  });

  it('false bei 2 Treffern (target=3)', () => {
    const recs = [makeEntry(), makeEntry()];
    expect(isChordSufficient(recs, 'adur', {})).toBe(false);
  });

  it('true bei genau 3 Treffern', () => {
    const recs = [makeEntry(), makeEntry(), makeEntry()];
    expect(isChordSufficient(recs, 'adur', {})).toBe(true);
  });

  it('true bei 5 Treffern', () => {
    const recs = [makeEntry(), makeEntry(), makeEntry(), makeEntry(), makeEntry()];
    expect(isChordSufficient(recs, 'adur', {})).toBe(true);
  });

  it('respektiert custom target', () => {
    const recs = [makeEntry(), makeEntry()];
    expect(isChordSufficient(recs, 'adur', {}, 2)).toBe(true);
    expect(isChordSufficient(recs, 'adur', {}, 3)).toBe(false);
  });
});
