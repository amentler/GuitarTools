import { describe, it, expect } from 'vitest';
import {
  formatFileSize,
  formatDate,
  safeDateIso,
  buildDisplayName,
  buildAudioAnalyseUrl,
  buildOnsetTaggerUrl,
  buildTrainingDataOnsetTaggerUrl,
  sortByDate,
  sortTrainingReviewEntries,
  getTrainingReviewIssueCount,
  buildZipEntryName,
} from '../../js/tools/recordingsOverview/recordingsOverviewLogic.js';

describe('formatFileSize', () => {
  it('returns "0 B" for 0', () => {
    expect(formatFileSize(0)).toBe('0 B');
  });
  it('returns bytes for values below 1024', () => {
    expect(formatFileSize(1023)).toBe('1023 B');
  });
  it('returns KB for exactly 1024', () => {
    expect(formatFileSize(1024)).toBe('1.0 KB');
  });
  it('returns KB with one decimal for 1536', () => {
    expect(formatFileSize(1536)).toBe('1.5 KB');
  });
  it('returns MB for exactly 1048576', () => {
    expect(formatFileSize(1048576)).toBe('1.0 MB');
  });
  it('returns MB with one decimal for 2100000', () => {
    expect(formatFileSize(2100000)).toBe('2.0 MB');
  });
});

describe('formatDate', () => {
  it('returns a string containing the year and day for a valid ISO string', () => {
    const result = formatDate('2026-05-14T10:23:00.000Z');
    expect(result).toContain('2026');
    expect(result).toContain('14');
  });
  it('returns "–" for empty string', () => {
    expect(formatDate('')).toBe('–');
  });
  it('returns "–" for null', () => {
    expect(formatDate(null)).toBe('–');
  });
  it('returns "–" for undefined', () => {
    expect(formatDate(undefined)).toBe('–');
  });
});

describe('safeDateIso', () => {
  it('returns ISO string for a valid Date', () => {
    const d = new Date('2026-05-14T10:00:00.000Z');
    expect(safeDateIso(d)).toBe('2026-05-14T10:00:00.000Z');
  });
  it('returns null for an Invalid Date (new Date(""))', () => {
    expect(safeDateIso(new Date(''))).toBeNull();
  });
  it('returns null for an Invalid Date (new Date(NaN))', () => {
    expect(safeDateIso(new Date(NaN))).toBeNull();
  });
  it('returns null for null', () => {
    expect(safeDateIso(null)).toBeNull();
  });
  it('returns null for undefined', () => {
    expect(safeDateIso(undefined)).toBeNull();
  });
  it('returns null for a plain string (not a Date object)', () => {
    expect(safeDateIso('2026-05-14')).toBeNull();
  });
});

describe('buildDisplayName', () => {
  it('prefers baseName for sheet-music recordings', () => {
    const result = buildDisplayName('sheet-music', 'take-id', {
      baseName: 'notenlesen_4-4_120bpm_EAD_abc12',
      savedAt: '2026-05-14T10:00:00Z',
    });
    expect(result).toBe('notenlesen_4-4_120bpm_EAD_abc12');
  });

  it('prefers baseName for chord-recorder recordings', () => {
    const result = buildDisplayName('chord-recorder', 'take-id', {
      baseName: 'amoll_finger_laut_single_abc12',
      chord: 'A-Moll',
    });
    expect(result).toBe('amoll_finger_laut_single_abc12');
  });

  it('starts with "Notenlesen" for sheet-music source with metadata', () => {
    const result = buildDisplayName('sheet-music', 'last', { savedAt: '2026-05-14T10:00:00Z' });
    expect(result).toMatch(/^Notenlesen/);
    expect(result).toContain('2026');
  });
  it('contains chord and technique for chord-recorder source', () => {
    const result = buildDisplayName(
      'chord-recorder',
      'cmaj_finger_laut_single_abc12',
      { chord: 'C-Dur', technique: 'finger', recordedAt: '2026-05-14T10:00:00Z' },
    );
    expect(result).toContain('C-Dur');
    expect(result).toContain('finger');
  });
  it('returns baseName as fallback for chord-recorder with null metadata', () => {
    const result = buildDisplayName('chord-recorder', 'cmaj_finger_laut_single_abc12', null);
    expect(result).toBe('cmaj_finger_laut_single_abc12');
  });
  it('returns "Notenlesen-Aufnahme" as fallback for sheet-music with null metadata', () => {
    const result = buildDisplayName('sheet-music', 'last', null);
    expect(result).toMatch(/^Notenlesen/);
  });
});

describe('buildAudioAnalyseUrl', () => {
  it('builds correct URL for sheet-music source', () => {
    expect(buildAudioAnalyseUrl('sheet-music', 'last'))
      .toBe('../audio-analyse/index.html?source=sheet-music&id=last');
  });
  it('contains source and encoded id for chord-recorder', () => {
    const url = buildAudioAnalyseUrl('chord-recorder', 'cmaj_finger_laut_single_abc12');
    expect(url).toContain('source=chord-recorder');
    expect(url).toContain('cmaj_finger_laut_single_abc12');
  });
});

describe('buildOnsetTaggerUrl', () => {
  it('builds correct URL for sheet-music source', () => {
    expect(buildOnsetTaggerUrl('sheet-music', 'last'))
      .toBe('../onset-tagger/index.html?source=sheet-music&id=last');
  });
  it('contains source and id for chord-recorder', () => {
    const url = buildOnsetTaggerUrl('chord-recorder', 'cmaj_finger_laut_single_abc12');
    expect(url).toContain('source=chord-recorder');
    expect(url).toContain('cmaj_finger_laut_single_abc12');
  });
});

describe('buildTrainingDataOnsetTaggerUrl', () => {
  it('builds a training-data Onset Tagger URL', () => {
    expect(buildTrainingDataOnsetTaggerUrl('take zip'))
      .toBe('../onset-tagger/index.html?source=training-data&id=take%20zip');
  });
});

describe('sortByDate', () => {
  it('sorts recordings descending by date (newest first)', () => {
    const recordings = [
      { id: 'a', date: new Date('2026-01-01') },
      { id: 'b', date: new Date('2026-03-01') },
      { id: 'c', date: new Date('2026-02-01') },
    ];
    const sorted = sortByDate(recordings);
    expect(sorted[0].id).toBe('b');
    expect(sorted[1].id).toBe('c');
    expect(sorted[2].id).toBe('a');
  });
  it('returns empty array for empty input', () => {
    expect(sortByDate([])).toEqual([]);
  });
  it('does not mutate the original array', () => {
    const recordings = [
      { id: 'a', date: new Date('2026-01-01') },
      { id: 'b', date: new Date('2026-03-01') },
    ];
    sortByDate(recordings);
    expect(recordings[0].id).toBe('a');
  });
});

describe('training review sorting', () => {
  it('counts false positives and false negatives as issues', () => {
    expect(getTrainingReviewIssueCount({ metrics: { fp: 3, fn: 2 } })).toBe(5);
    expect(getTrainingReviewIssueCount({ metrics: { fp: null, fn: 2 } })).toBe(2);
  });

  it('sorts by issues descending by default', () => {
    const entries = [
      { name: 'clean', metrics: { fp: 0, fn: 0 } },
      { name: 'noisy', metrics: { fp: 5, fn: 1 } },
      { name: 'missed', metrics: { fp: 0, fn: 4 } },
    ];
    expect(sortTrainingReviewEntries(entries).map(entry => entry.name))
      .toEqual(['noisy', 'missed', 'clean']);
  });

  it('sorts named columns in the requested direction', () => {
    const entries = [
      { name: 'b', metrics: { fp: 1 } },
      { name: 'a', metrics: { fp: 3 } },
    ];
    expect(sortTrainingReviewEntries(entries, 'name', 'asc').map(entry => entry.name))
      .toEqual(['a', 'b']);
    expect(sortTrainingReviewEntries(entries, 'fp', 'asc').map(entry => entry.name))
      .toEqual(['b', 'a']);
  });
});

describe('buildZipEntryName', () => {
  it('returns date-based name for sheet-music with savedAt', () => {
    const result = buildZipEntryName('sheet-music', 'take-42', { savedAt: '2026-01-15T10:00:00.000Z' });
    expect(result).toBe('notenlesen_2026-01-15');
  });

  it('falls back to id for sheet-music without savedAt', () => {
    const result = buildZipEntryName('sheet-music', 'take-42', null);
    expect(result).toBe('notenlesen_take-42');
  });

  it('returns chord+technique name for chord-recorder with metadata', () => {
    const result = buildZipEntryName('chord-recorder', 'am_fingerpick_abc12', { chord: 'Am', technique: 'fingerpick' });
    expect(result).toBe('Am_fingerpick');
  });

  it('returns only chord for chord-recorder when technique is missing', () => {
    const result = buildZipEntryName('chord-recorder', 'am_abc12', { chord: 'Am' });
    expect(result).toBe('Am');
  });

  it('returns id for chord-recorder without metadata', () => {
    const result = buildZipEntryName('chord-recorder', 'some-id', null);
    expect(result).toBe('some-id');
  });

  it('strips special characters from chord-recorder name', () => {
    const result = buildZipEntryName('chord-recorder', 'id', { chord: 'A#m', technique: 'down/up' });
    expect(result).toMatch(/^[a-zA-Z0-9_-]+$/);
  });

  it('returns id for unknown source', () => {
    const result = buildZipEntryName('unknown-source', 'my-id', {});
    expect(result).toBe('my-id');
  });
});
