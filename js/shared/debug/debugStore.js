import { createStorageService } from '../storage/storageService.js';
import {
  DEBUG_COPY_FORMAT_VERSION,
  DEBUG_ENTRY_LIMIT,
  DEBUG_LOG_SCOPE,
  DEBUG_MODE_STORAGE_KEY,
  GLOBAL_DEBUG_DEFAULTS,
} from './debugConfig.js';

function normalizeString(value, fallback = '') {
  return typeof value === 'string' && value.trim()
    ? value.trim()
    : fallback;
}

function clonePayload(payload) {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    return payload ?? {};
  }
  return { ...payload };
}

function toIsoTimestamp(now) {
  if (typeof now === 'string') return now;
  if (now instanceof Date) return now.toISOString();
  return new Date(now).toISOString();
}

function resolvePageUrl(location) {
  if (!location) return '';
  if (typeof location.href === 'string') return location.href;

  const pathname = typeof location.pathname === 'string' ? location.pathname : '';
  const search = typeof location.search === 'string' ? location.search : '';
  const hash = typeof location.hash === 'string' ? location.hash : '';
  return `${pathname}${search}${hash}`;
}

function createBasePageContext({ pageId = '', pageTitle = '', url = '' } = {}) {
  return {
    pageId: normalizeString(pageId),
    pageTitle: normalizeString(pageTitle),
    url: normalizeString(url),
  };
}

export function createGlobalDebugStore({
  storage = globalThis.localStorage,
  location = globalThis.location,
  navigator = globalThis.navigator,
  now = () => new Date(),
  entryLimit = DEBUG_ENTRY_LIMIT,
} = {}) {
  const storageService = createStorageService({ storage });
  const subscribers = new Set();
  const state = {
    enabled: storageService.getBoolean(DEBUG_MODE_STORAGE_KEY, { defaultValue: false }),
    entries: [],
    page: createBasePageContext({
      pageTitle: globalThis.document?.title ?? '',
      url: resolvePageUrl(location),
    }),
  };

  function notify() {
    const snapshot = getSnapshot();
    for (const subscriber of subscribers) subscriber(snapshot);
  }

  function trimEntries() {
    if (state.entries.length <= entryLimit) return;
    state.entries.splice(0, state.entries.length - entryLimit);
  }

  function setEnabled(nextEnabled) {
    const enabled = Boolean(nextEnabled);
    if (state.enabled === enabled) return state.enabled;

    state.enabled = enabled;
    if (enabled) {
      storageService.set(DEBUG_MODE_STORAGE_KEY, 'true');
    } else {
      storageService.remove(DEBUG_MODE_STORAGE_KEY);
      state.entries = [];
    }

    notify();
    return state.enabled;
  }

  function setPageContext(pageContext = {}) {
    state.page = createBasePageContext({
      pageId: pageContext.pageId,
      pageTitle: pageContext.pageTitle ?? state.page.pageTitle,
      url: pageContext.url ?? state.page.url,
    });
    notify();
    return getPageContext();
  }

  function getPageContext() {
    return { ...state.page };
  }

  function addEntry(type, payload = {}, options = {}) {
    if (!state.enabled) return null;

    const entry = {
      at: toIsoTimestamp(options.at ?? now()),
      type: normalizeString(type, 'unknown'),
      source: normalizeString(options.source, state.page.pageId || state.page.pageTitle || 'app'),
      level: normalizeString(options.level, 'info'),
      payload: clonePayload(payload),
    };

    state.entries.push(entry);
    trimEntries();
    notify();
    return { ...entry, payload: clonePayload(entry.payload) };
  }

  function clearEntries() {
    if (state.entries.length === 0) return;
    state.entries = [];
    notify();
  }

  function getEntries() {
    return state.entries.map(entry => ({
      ...entry,
      payload: clonePayload(entry.payload),
    }));
  }

  function getMetadata() {
    return {
      debugMode: state.enabled,
      logScope: DEBUG_LOG_SCOPE,
      page: getPageContext(),
      capturedAt: toIsoTimestamp(now()),
      userAgent: normalizeString(navigator?.userAgent),
      formatVersion: DEBUG_COPY_FORMAT_VERSION,
    };
  }

  function getSnapshot() {
    return {
      ...getMetadata(),
      entries: getEntries(),
    };
  }

  function createClipboardPayload() {
    return {
      metadata: getMetadata(),
      entries: getEntries(),
    };
  }

  function serializeForClipboard() {
    return JSON.stringify(createClipboardPayload(), null, 2);
  }

  function subscribe(listener) {
    if (typeof listener !== 'function') return () => {};
    subscribers.add(listener);
    return () => {
      subscribers.delete(listener);
    };
  }

  return {
    defaults: GLOBAL_DEBUG_DEFAULTS,
    isEnabled: () => state.enabled,
    enable: () => setEnabled(true),
    disable: () => setEnabled(false),
    setEnabled,
    setPageContext,
    getPageContext,
    addEntry,
    clearEntries,
    getEntries,
    getMetadata,
    getSnapshot,
    createClipboardPayload,
    serializeForClipboard,
    subscribe,
  };
}
