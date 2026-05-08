// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createChordRecorderTool } from '../../js/tools/chordRecorder/chordRecorder.js';
import { addRecording, clearRecordings, getAllRecordings } from '../../js/tools/chordRecorder/chordRecorderFiles.js';

function createMockStorageService(initialValues = {}) {
  const values = new Map(Object.entries(initialValues));

  return {
    getString(key, { defaultValue } = {}) {
      return values.has(key) ? values.get(key) : defaultValue;
    },
    getBoolean(key, { defaultValue } = {}) {
      if (!values.has(key)) return defaultValue;
      return values.get(key) === 'true';
    },
    set(key, value) {
      values.set(key, String(value));
    },
  };
}

describe('chordRecorder controller', () => {
  beforeEach(() => {
    vi.useRealTimers();
    clearRecordings();
    document.body.innerHTML = '<div id="root"></div>';
    globalThis.URL.createObjectURL = vi.fn(() => 'blob:test');
    globalThis.URL.revokeObjectURL = vi.fn();
  });

  it('shows download and management actions in record view', async () => {
    const tool = createChordRecorderTool({
      storageService: createMockStorageService(),
    });

    await tool.mount(document.getElementById('root'));

    expect(document.getElementById('cr-download-all')?.textContent).toContain('Alles herunterladen');
    expect(document.getElementById('cr-manage-recordings')?.textContent).toContain('Verwaltung');
    expect(document.getElementById('cr-clear-all')).toBeNull();
  });

  it('switches to the management view and back without losing setup state', async () => {
    const tool = createChordRecorderTool({
      storageService: createMockStorageService({
        guitarSize: 'Vollgröße',
        guitarStrings: 'Nylon',
        'technik-finger': 'true',
        'technik-fingernagel': 'true',
        'technik-plektrum': 'false',
        'strumModus-single': 'true',
        'strumModus-multi1': 'false',
        'strumModus-multi2': 'false',
      }),
    });

    await tool.mount(document.getElementById('root'));

    const sizeSelect = document.getElementById('cr-guitar-size');
    sizeSelect.value = '7/8';
    sizeSelect.dispatchEvent(new Event('change', { bubbles: true }));

    const multi1 = document.querySelector('[data-strum-modus="multi1"]');
    multi1.checked = true;
    multi1.dispatchEvent(new Event('change', { bubbles: true }));

    const firstChord = document.querySelector('.cr-chord-card');
    firstChord.click();
    const secondChord = document.querySelectorAll('.cr-chord-card')[1];
    secondChord.click();

    document.getElementById('cr-manage-recordings').click();

    expect(document.getElementById('cr-back-to-record')?.textContent).toContain('Zurück zur Aufnahme');
    expect(document.getElementById('cr-chord-grid')).toBeNull();

    document.getElementById('cr-back-to-record').click();

    expect(document.getElementById('cr-guitar-size')?.value).toBe('7/8');
    expect(document.querySelector('[data-strum-modus="multi1"]')?.checked).toBe(true);
    expect(document.querySelectorAll('.cr-chord-card--selected')).toHaveLength(2);
  });

  it('allows toggling multiple chord selections in the record view', async () => {
    const tool = createChordRecorderTool({
      storageService: createMockStorageService(),
    });

    await tool.mount(document.getElementById('root'));

    const cards = document.querySelectorAll('.cr-chord-card');
    cards[0].click();
    cards[1].click();

    expect(document.querySelectorAll('.cr-chord-card--selected')).toHaveLength(2);
    expect(document.getElementById('cr-variation-count')?.textContent).toContain('2 Akkorde');

    cards[0].click();

    expect(document.querySelectorAll('.cr-chord-card--selected')).toHaveLength(1);
  });

  it('lists recordings in the record view and keeps management actions in the management view', async () => {
    addRecording({
      baseName: 'gdur_take_1',
      wavBlob: new Blob(['wav'], { type: 'audio/wav' }),
      sidecar: {
        chord: 'G-Dur',
        technique: 'finger',
        volume: 'laut',
        strumMode: 'single',
        repeatIndex: 1,
        recordedAt: '2026-05-05T12:00:00.000Z',
        quality: { passed: true, warnReasons: [] },
      },
    });

    const tool = createChordRecorderTool({
      storageService: createMockStorageService(),
    });

    await tool.mount(document.getElementById('root'));

    expect(document.body.textContent).toContain('G-Dur');
    expect(document.body.textContent).toContain('Anhören');
    expect(document.getElementById('cr-clear-all')).toBeNull();

    document.getElementById('cr-manage-recordings').click();

    expect(document.body.textContent).toContain('G-Dur');
    expect(document.body.textContent).toContain('Anhören');
    expect(document.getElementById('cr-clear-all')).not.toBeNull();

    globalThis.confirm = vi.fn(() => true);
    document.querySelector('[data-delete-recording="gdur_take_1"]').click();

    expect(document.body.textContent).toContain('Noch keine Aufnahmen in dieser Session.');
  });

  it('toggles stored recording flags from the record view and management view', async () => {
    addRecording({
      baseName: 'gdur_take_1',
      wavBlob: new Blob(['wav'], { type: 'audio/wav' }),
      sidecar: {
        chord: 'G-Dur',
        technique: 'finger',
        volume: 'laut',
        strumMode: 'single',
        repeatIndex: 1,
        recordedAt: '2026-05-05T12:00:00.000Z',
        quality: { passed: true, warnReasons: [], userFlags: [] },
      },
    });

    const tool = createChordRecorderTool({
      storageService: createMockStorageService(),
    });

    await tool.mount(document.getElementById('root'));

    document.querySelector('[data-toggle-flag="buzz"]').click();

    expect(getAllRecordings()[0].sidecar.quality.userFlags).toEqual(['buzz']);
    expect(document.body.textContent).toContain('Bewertung: Schnarren');

    document.getElementById('cr-manage-recordings').click();

    expect(document.body.textContent).toContain('Bewertung: Schnarren');

    document.querySelector('[data-toggle-flag="buzz"]').click();

    expect(getAllRecordings()[0].sidecar.quality.userFlags).toEqual([]);
    expect(document.body.textContent).toContain('Bewertung: Keine Bewertung');
  });

  it('stops active playback when leaving the management view', async () => {
    const pauseMock = vi.fn();
    const playMock = vi.fn().mockResolvedValue();
    globalThis.Audio = class FakeAudio {
      constructor() {
        this.currentTime = 0;
      }
      play() {
        return playMock();
      }
      pause() {
        pauseMock();
      }
      addEventListener() {}
    };

    addRecording({
      baseName: 'gdur_take_2',
      wavBlob: new Blob(['wav'], { type: 'audio/wav' }),
      sidecar: {
        chord: 'G-Dur',
        technique: 'finger',
        volume: 'laut',
        strumMode: 'single',
        repeatIndex: 1,
        recordedAt: '2026-05-05T12:00:00.000Z',
        quality: { passed: true, warnReasons: [] },
      },
    });

    const tool = createChordRecorderTool({
      storageService: createMockStorageService(),
    });

    await tool.mount(document.getElementById('root'));
    document.getElementById('cr-manage-recordings').click();
    document.querySelector('[data-play-recording="gdur_take_2"]').click();

    expect(playMock).toHaveBeenCalledTimes(1);

    document.getElementById('cr-back-to-record').click();

    expect(pauseMock).toHaveBeenCalledTimes(1);
    expect(globalThis.URL.revokeObjectURL).toHaveBeenCalledWith('blob:test');
  });

  it('disables management navigation while a recording session is starting', async () => {
    const tool = createChordRecorderTool({
      storageService: createMockStorageService(),
      createAudioSession: () => ({
        open: () => new Promise(() => {}),
        close: vi.fn(),
      }),
    });

    await tool.mount(document.getElementById('root'));

    document.querySelector('.cr-chord-card').click();
    document.querySelector('[data-start]').click();
    await Promise.resolve();

    const manageButton = document.getElementById('cr-manage-recordings');
    expect(manageButton?.disabled).toBe(true);

    manageButton.click();
    expect(document.getElementById('cr-chord-grid')).not.toBeNull();
  });

  it('records multiple selected chords in sorted sequence order', async () => {
    vi.useFakeTimers();

    const open = vi.fn().mockResolvedValue();
    const close = vi.fn();
    const recordForDuration = vi.fn().mockResolvedValue({
      samples: Float32Array.from({ length: 44100 * 2 }, () => 0.1),
      sampleRate: 44100,
      durationSec: 2,
    });
    const audioSession = {
      open,
      close,
      startOnsetWatch(callback) {
        callback();
      },
      stopOnsetWatch: vi.fn(),
      startLevelWatch: vi.fn(),
      stopLevelWatch: vi.fn(),
      recordForDuration,
    };

    const tool = createChordRecorderTool({
      storageService: createMockStorageService({
        'technik-finger': 'true',
        'technik-fingernagel': 'false',
        'technik-plektrum': 'false',
        'strumModus-single': 'true',
        'strumModus-multi1': 'false',
        'strumModus-multi2': 'false',
      }),
      createAudioSession: () => audioSession,
    });

    await tool.mount(document.getElementById('root'));

    document.querySelector('[data-chord="G-Dur"]').click();
    document.querySelector('[data-chord="A-Dur"]').click();

    document.querySelector('[data-start]').click();

    await vi.runAllTimersAsync();

    expect(recordForDuration).toHaveBeenCalledTimes(8);
    expect(getAllRecordings().map(entry => entry.sidecar.chord)).toEqual([
      'A-Dur', 'A-Dur', 'A-Dur', 'A-Dur',
      'G-Dur', 'G-Dur', 'G-Dur', 'G-Dur',
    ]);
    expect(open).toHaveBeenCalledTimes(1);
    expect(close).toHaveBeenCalledTimes(1);
  });

  it('can repeat the last saved recording during the next pre-countdown', async () => {
    vi.useFakeTimers();

    const open = vi.fn().mockResolvedValue();
    const close = vi.fn();
    const recordForDuration = vi.fn().mockResolvedValue({
      samples: Float32Array.from({ length: 44100 * 2 }, () => 0.1),
      sampleRate: 44100,
      durationSec: 2,
    });
    const audioSession = {
      open,
      close,
      startOnsetWatch(callback) {
        callback();
      },
      stopOnsetWatch: vi.fn(),
      startLevelWatch: vi.fn(),
      stopLevelWatch: vi.fn(),
      recordForDuration,
    };

    const tool = createChordRecorderTool({
      storageService: createMockStorageService({
        'technik-finger': 'true',
        'technik-fingernagel': 'false',
        'technik-plektrum': 'false',
        'strumModus-single': 'true',
        'strumModus-multi1': 'false',
        'strumModus-multi2': 'false',
      }),
      createAudioSession: () => audioSession,
    });

    await tool.mount(document.getElementById('root'));

    document.querySelector('[data-chord="A-Dur"]').click();
    document.querySelector('[data-start]').click();
    await vi.advanceTimersByTimeAsync(9000);

    expect(getAllRecordings()).toHaveLength(1);
    expect(document.querySelector('[data-action="repeat"]')?.textContent).toContain('Letzte wiederholen');

    document.querySelector('[data-action="repeat"]').click();
    await vi.advanceTimersByTimeAsync(1);

    expect(getAllRecordings()).toHaveLength(0);

    document.querySelector('[data-action="stop"]').click();
    await vi.advanceTimersByTimeAsync(1);

    expect(close).toHaveBeenCalledTimes(1);
  });
});
