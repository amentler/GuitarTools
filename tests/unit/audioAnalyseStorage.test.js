import { beforeEach, describe, expect, it, vi } from 'vitest';

function createRequest(run) {
  const req = {};
  setTimeout(() => {
    try {
      req.result = run();
      req.onsuccess?.({ target: req });
    } catch (err) {
      req.error = err;
      req.onerror?.();
    }
  }, 0);
  return req;
}

function createFakeIndexedDb() {
  const stores = new Map();
  function ensureStore(name) {
    if (!stores.has(name)) stores.set(name, new Map());
    return stores.get(name);
  }

  const indexedDB = {
    open(dbName) {
      const req = {};
      setTimeout(() => {
        const db = {
          createObjectStore(name) {
            ensureStore(`${dbName}:${name}`);
          },
          transaction(name) {
            const store = ensureStore(`${dbName}:${name}`);
            const tx = {
              objectStore() {
                return {
                  put(value, key) {
                    return createRequest(() => {
                      store.set(key, value);
                      setTimeout(() => tx.oncomplete?.(), 0);
                      return key;
                    });
                  },
                  get(key) {
                    return createRequest(() => store.get(key));
                  },
                  getAll() {
                    return createRequest(() => [...store.values()]);
                  },
                  getAllKeys() {
                    return createRequest(() => [...store.keys()]);
                  },
                  delete(key) {
                    return createRequest(() => {
                      store.delete(key);
                      setTimeout(() => tx.oncomplete?.(), 0);
                      return undefined;
                    });
                  },
                };
              },
            };
            return tx;
          },
          close() {},
        };
        req.result = db;
        req.onupgradeneeded?.({ target: { result: db } });
        req.onsuccess?.({ target: { result: db } });
      }, 0);
      return req;
    },
    _stores: stores,
  };
  return indexedDB;
}

describe('audioAnalyseStorage sheet-music takes', () => {
  let storage;

  beforeEach(async () => {
    vi.resetModules();
    vi.stubGlobal('indexedDB', createFakeIndexedDb());
    storage = await import('../../js/shared/audioAnalyseStorage.js');
  });

  it('stores two distinct complete WAV and sidecar takes', async () => {
    const first = await storage.saveSheetMusicTake(
      new Uint8Array([1, 2, 3]),
      { category: 'sheet-music-reading', recordedAt: '2026-05-14T10:00:00.000Z' },
      { baseName: 'take-a' },
    );
    const second = await storage.saveSheetMusicTake(
      new Uint8Array([4, 5, 6]),
      { category: 'sheet-music-reading', recordedAt: '2026-05-14T10:01:00.000Z' },
      { baseName: 'take-b' },
    );

    expect(first.id).toBe('take-a');
    expect(second.id).toBe('take-b');
    const takes = await storage.listSheetMusicTakes();
    expect(takes.map(take => take.id).sort()).toEqual(['take-a', 'take-b']);
    expect(takes.every(take => take.wav instanceof Uint8Array && take.sidecar.category === 'sheet-music-reading')).toBe(true);
  });

  it('does not write a persistent take when WAV or sidecar is missing', async () => {
    await expect(storage.saveSheetMusicTake(null, { category: 'sheet-music-reading' }, { baseName: 'missing-wav' }))
      .resolves.toBeNull();
    await expect(storage.saveSheetMusicTake(new Uint8Array([1]), null, { baseName: 'missing-json' }))
      .resolves.toBeNull();

    await expect(storage.listSheetMusicTakes()).resolves.toEqual([]);
  });

  it('loads a take by id and selects the newest complete take', async () => {
    await storage.saveSheetMusicTake(
      new Uint8Array([1]),
      { category: 'sheet-music-reading', recordedAt: '2026-05-14T10:00:00.000Z' },
      { baseName: 'older' },
    );
    await storage.saveSheetMusicTake(
      new Uint8Array([2]),
      { category: 'sheet-music-reading', recordedAt: '2026-05-14T10:05:00.000Z' },
      { baseName: 'newer' },
    );

    await expect(storage.loadSheetMusicTake('older')).resolves.toMatchObject({ id: 'older' });
    await expect(storage.loadLatestSheetMusicTake()).resolves.toMatchObject({ id: 'newer' });
  });

  it('replaces a take under a new baseName and removes the old key', async () => {
    const original = await storage.saveSheetMusicTake(
      new Uint8Array([1, 2]),
      { category: 'sheet-music-reading', onsetsMs: [100] },
      { baseName: 'old-name' },
    );

    const replaced = await storage.replaceSheetMusicTake(original.id, {
      wav: original.wav,
      sidecar: { category: 'sheet-music-reading', onsetsMs: [200] },
    }, { baseName: 'new-name' });

    expect(replaced.id).toBe('new-name');
    await expect(storage.loadSheetMusicTake('old-name')).resolves.toBeNull();
    await expect(storage.loadSheetMusicTake('new-name')).resolves.toMatchObject({
      id: 'new-name',
      sidecar: { onsetsMs: [200] },
    });
  });

  it('keeps a valid legacy last entry readable', async () => {
    const store = globalThis.indexedDB._stores.get('gt-audio-analyse-db:recordings')
      ?? new Map();
    globalThis.indexedDB._stores.set('gt-audio-analyse-db:recordings', store);
    store.set('last', {
      wav: new Uint8Array([9, 9]),
      manifest: { category: 'sheet-music-reading', recordedAt: '2026-05-14T09:00:00.000Z' },
      savedAt: '2026-05-14T09:00:00.000Z',
    });

    await expect(storage.loadSheetMusicTake('last')).resolves.toMatchObject({
      id: 'last',
      sidecar: { category: 'sheet-music-reading' },
    });
  });
});
