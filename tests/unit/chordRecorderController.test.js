// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest';
import { createChordRecorderTool } from '../../js/tools/chordRecorder/chordRecorder.js';
import { clearRecordings } from '../../js/tools/chordRecorder/chordRecorderFiles.js';

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
});
