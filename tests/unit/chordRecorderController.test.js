// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createChordRecorderTool } from '../../js/tools/chordRecorder/chordRecorder.js';
import { addRecording, clearRecordings } from '../../js/tools/chordRecorder/chordRecorderFiles.js';

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

    document.getElementById('cr-manage-recordings').click();

    expect(document.getElementById('cr-back-to-record')?.textContent).toContain('Zurück zur Aufnahme');
    expect(document.getElementById('cr-chord-grid')).toBeNull();

    document.getElementById('cr-back-to-record').click();

    expect(document.getElementById('cr-guitar-size')?.value).toBe('7/8');
    expect(document.querySelector('[data-strum-modus="multi1"]')?.checked).toBe(true);
    expect(document.querySelectorAll('.cr-chord-card--selected')).toHaveLength(1);
  });

  it('manages recordings only inside the management view', async () => {
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

    expect(document.body.textContent).not.toContain('Anhören');
    document.getElementById('cr-manage-recordings').click();

    expect(document.body.textContent).toContain('G-Dur');
    expect(document.body.textContent).toContain('Anhören');
    expect(document.getElementById('cr-clear-all')).not.toBeNull();

    document.querySelector('[data-delete-recording="gdur_take_1"]').click();

    expect(document.body.textContent).toContain('Noch keine Aufnahmen in dieser Session.');
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
});
