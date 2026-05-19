import { describe, expect, it, vi, beforeEach } from 'vitest';
import { buildRecordingZip } from '../../js/shared/zip.js';

describe('training data review catalog helpers', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.resetModules();
  });

  it('normalizes training annotations to onsetsMs', async () => {
    const { normalizeTrainingDataSidecar } = await import('../../js/shared/trainingDataReviewCatalog.js');
    const sidecar = normalizeTrainingDataSidecar({
      metadata: { filename: 'take.wav' },
      annotations: { onsetsMs: [10, 20] },
    });
    expect(sidecar.filename).toBe('take.wav');
    expect(sidecar.onsetsMs).toEqual([10, 20]);
  });

  it('loads a ZIP training-data entry through recordingLoader', async () => {
    const encoder = new TextEncoder();
    const wav = new Uint8Array([1, 2, 3, 4]);
    const zip = buildRecordingZip(
      'demo',
      wav,
      encoder.encode(JSON.stringify({ annotations: { onsetsMs: [123, 456] } })),
    );
    const catalog = {
      entries: [{
        id: 'demo-entry',
        kind: 'zip',
        name: 'demo',
        baseName: 'demo',
        url: '../../fixtures/demo.zip',
      }],
    };

    globalThis.fetch = vi.fn(async url => {
      if (String(url).endsWith('android-firefox-training-review-catalog.json')) {
        return { ok: true, json: async () => catalog };
      }
      return { ok: true, arrayBuffer: async () => zip.buffer.slice(0) };
    });

    const { loadRecordingFromSource } = await import('../../js/shared/recordingLoader.js');
    const entry = await loadRecordingFromSource('training-data', 'demo-entry');
    expect(Array.from(entry.wav)).toEqual(Array.from(wav));
    expect(entry.sidecar.onsetsMs).toEqual([123, 456]);
    expect(entry.readOnly).toBe(true);
  });
});
