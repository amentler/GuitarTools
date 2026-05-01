export const DEBUG_MODE_STORAGE_KEY = 'global_debug_enabled';
export const DEBUG_ENTRIES_SESSION_KEY = 'global_debug_entries';
export const DEBUG_LOG_SCOPE = 'page';
export const DEBUG_COPY_FORMAT_VERSION = 1;
export const DEBUG_ENTRY_LIMIT = 200;

export const GLOBAL_DEBUG_DEFAULTS = Object.freeze({
  visibility: 'active-only',
  windowMode: 'in-app',
  logScope: DEBUG_LOG_SCOPE,
  storageKey: DEBUG_MODE_STORAGE_KEY,
  copyFormatVersion: DEBUG_COPY_FORMAT_VERSION,
  includeMetadata: true,
  includeUserAgent: true,
  entryLimit: DEBUG_ENTRY_LIMIT,
});
