import { createStorageService } from './storage/storageService.js';

export const SETTING_KEYS = {
  SRS_ENABLED: 'gt_srs_enabled',
  CHORD_DETECTION_USE_ESSENTIA: 'gt_chord_detection_use_essentia',
  SHEET_MUSIC_RECOGNITION_STRATEGY: 'gt_sheet_music_recognition_strategy',
};

const DEFAULTS = {
  [SETTING_KEYS.SRS_ENABLED]: true,
  [SETTING_KEYS.CHORD_DETECTION_USE_ESSENTIA]: true,
  [SETTING_KEYS.SHEET_MUSIC_RECOGNITION_STRATEGY]: 'fast-note-matcher',
};

const storageService = createStorageService({ storage: globalThis.localStorage });

export function getSetting(key) {
  if (!(key in DEFAULTS)) return undefined;
  const defaultValue = DEFAULTS[key];
  if (typeof defaultValue === 'boolean') {
    return storageService.getBoolean(key, { defaultValue });
  }
  return storageService.getString(key, { defaultValue: String(defaultValue) });
}

export function setSetting(key, value) {
  if (!(key in DEFAULTS)) return;
  if (value === DEFAULTS[key]) {
    storageService.remove(key);
  } else {
    storageService.set(key, String(value));
  }
}
