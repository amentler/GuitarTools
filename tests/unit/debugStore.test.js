import { describe, expect, it, vi } from 'vitest';
import {
  DEBUG_COPY_FORMAT_VERSION,
  DEBUG_ENTRY_LIMIT,
  DEBUG_ENTRIES_SESSION_KEY,
  DEBUG_LOG_SCOPE,
  DEBUG_MODE_STORAGE_KEY,
  createGlobalDebugStore,
} from '../../js/shared/debug/index.js';

function createMockStorage(initialValues = {}) {
  const store = new Map(Object.entries(initialValues));

  return {
    getItem: vi.fn(key => store.get(key) ?? null),
    setItem: vi.fn((key, value) => {
      store.set(key, String(value));
    }),
    removeItem: vi.fn(key => {
      store.delete(key);
    }),
  };
}

describe('global debug store', () => {
  it('restores and persists the debug enabled flag', () => {
    const storage = createMockStorage({ [DEBUG_MODE_STORAGE_KEY]: 'true' });
    const store = createGlobalDebugStore({ storage });

    expect(store.isEnabled()).toBe(true);

    store.disable();
    expect(storage.removeItem).toHaveBeenCalledWith(DEBUG_MODE_STORAGE_KEY);
    expect(store.isEnabled()).toBe(false);

    store.enable();
    expect(storage.setItem).toHaveBeenCalledWith(DEBUG_MODE_STORAGE_KEY, 'true');
    expect(store.isEnabled()).toBe(true);
  });

  it('captures page-scoped entries only while debug mode is enabled', () => {
    const store = createGlobalDebugStore({
      storage: createMockStorage(),
      sessionStorage: createMockStorage(),
      now: () => new Date('2026-05-01T10:15:30.000Z'),
    });

    expect(store.addEntry('page-loaded', { phase: 'boot' })).toBeNull();

    store.enable();
    store.setPageContext({
      pageId: 'sheet-music-reading',
      pageTitle: 'Noten lesen',
      url: 'https://example.test/pages/sheet-music-reading/index.html',
    });

    const entry = store.addEntry('page-loaded', { phase: 'boot' });

    expect(entry).toEqual({
      at: '2026-05-01T10:15:30.000Z',
      type: 'page-loaded',
      source: 'sheet-music-reading',
      level: 'info',
      payload: { phase: 'boot' },
    });
    expect(store.getEntries()).toEqual([entry]);
    expect(store.getSnapshot()).toMatchObject({
      debugMode: true,
      logScope: DEBUG_LOG_SCOPE,
      page: {
        pageId: 'sheet-music-reading',
        pageTitle: 'Noten lesen',
        url: 'https://example.test/pages/sheet-music-reading/index.html',
      },
      entries: [entry],
    });
  });

  it('trims the oldest entries when the configured limit is exceeded', () => {
    const store = createGlobalDebugStore({
      storage: createMockStorage({ [DEBUG_MODE_STORAGE_KEY]: 'true' }),
      sessionStorage: createMockStorage(),
      entryLimit: 2,
      now: () => new Date('2026-05-01T10:15:30.000Z'),
    });

    store.setPageContext({ pageId: 'metronome' });
    store.addEntry('a');
    store.addEntry('b');
    store.addEntry('c');

    expect(store.getEntries().map(entry => entry.type)).toEqual(['b', 'c']);
  });

  it('serializes metadata and entries for clipboard export', () => {
    const sessionStorage = createMockStorage();
    const store = createGlobalDebugStore({
      storage: createMockStorage({ [DEBUG_MODE_STORAGE_KEY]: 'true' }),
      sessionStorage,
      navigator: { userAgent: 'UnitTest/1.0' },
      location: { href: 'https://example.test/pages/note-playing/index.html?debug=1' },
      now: () => new Date('2026-05-01T12:00:00.000Z'),
    });

    store.setPageContext({
      pageId: 'note-playing',
      pageTitle: 'Ton spielen',
    });
    store.addEntry('permission-error', { reason: 'denied' }, { level: 'warn' });

    const payload = store.createClipboardPayload();
    const serialized = JSON.parse(store.serializeForClipboard());

    expect(payload).toEqual({
      metadata: {
        debugMode: true,
        logScope: DEBUG_LOG_SCOPE,
        page: {
          pageId: 'note-playing',
          pageTitle: 'Ton spielen',
          url: 'https://example.test/pages/note-playing/index.html?debug=1',
        },
        capturedAt: '2026-05-01T12:00:00.000Z',
        userAgent: 'UnitTest/1.0',
        formatVersion: DEBUG_COPY_FORMAT_VERSION,
      },
      entries: [{
        at: '2026-05-01T12:00:00.000Z',
        type: 'permission-error',
        source: 'note-playing',
        level: 'warn',
        payload: { reason: 'denied' },
      }],
    });
    expect(serialized).toEqual(payload);
    expect(sessionStorage.setItem).toHaveBeenCalledWith(
      DEBUG_ENTRIES_SESSION_KEY,
      JSON.stringify({
        page: {
          pageId: 'note-playing',
          pageTitle: 'Ton spielen',
          url: 'https://example.test/pages/note-playing/index.html?debug=1',
        },
        entries: payload.entries,
      }),
    );
  });

  it('clears in-memory entries when debug mode is disabled', () => {
    const sessionStorage = createMockStorage();
    const store = createGlobalDebugStore({
      storage: createMockStorage({ [DEBUG_MODE_STORAGE_KEY]: 'true' }),
      sessionStorage,
      now: () => new Date('2026-05-01T10:15:30.000Z'),
    });

    store.setPageContext({ pageId: 'home' });
    store.addEntry('ui-action', { id: 'debug-toggle' });
    expect(store.getEntries()).toHaveLength(1);

    store.disable();

    expect(store.getEntries()).toEqual([]);
    expect(sessionStorage.removeItem).toHaveBeenCalledWith(DEBUG_ENTRIES_SESSION_KEY);
  });

  it('exposes the agreed shared defaults for later UI integration', () => {
    const store = createGlobalDebugStore({ storage: createMockStorage() });

    expect(store.defaults).toMatchObject({
      logScope: DEBUG_LOG_SCOPE,
      storageKey: DEBUG_MODE_STORAGE_KEY,
      copyFormatVersion: DEBUG_COPY_FORMAT_VERSION,
      entryLimit: DEBUG_ENTRY_LIMIT,
      visibility: 'active-only',
      windowMode: 'in-app',
      includeMetadata: true,
      includeUserAgent: true,
    });
  });

  it('restores the last persisted page context and entries from session storage', () => {
    const sessionStorage = createMockStorage({
      [DEBUG_ENTRIES_SESSION_KEY]: JSON.stringify({
        page: {
          pageId: 'sheet-music-reading',
          pageTitle: 'Noten lesen',
          url: 'https://example.test/pages/sheet-music-reading/index.html',
        },
        entries: [{
          at: '2026-05-01T12:00:00.000Z',
          type: 'mounted',
          source: 'sheet-music-reading',
          level: 'info',
          payload: { mode: 'easy' },
        }],
      }),
    });

    const store = createGlobalDebugStore({
      storage: createMockStorage({ [DEBUG_MODE_STORAGE_KEY]: 'true' }),
      sessionStorage,
    });

    expect(store.getPageContext()).toEqual({
      pageId: 'sheet-music-reading',
      pageTitle: 'Noten lesen',
      url: 'https://example.test/pages/sheet-music-reading/index.html',
    });
    expect(store.getEntries()).toEqual([{
      at: '2026-05-01T12:00:00.000Z',
      type: 'mounted',
      source: 'sheet-music-reading',
      level: 'info',
      payload: { mode: 'easy' },
    }]);
  });
});
