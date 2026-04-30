import { createStorageService } from '../../shared/storage/storageService.js';

const LS_ENDLESS = 'sheetMusicMic_endless';

function getSheetMusicMicStorage(storage = globalThis.localStorage) {
  return createStorageService({ storage });
}

export function loadSheetMusicMicPrefs(storage = globalThis.localStorage) {
  return {
    endless: getSheetMusicMicStorage(storage).getBoolean(LS_ENDLESS, { defaultValue: false }),
  };
}

export function saveSheetMusicMicEndless(value, storage = globalThis.localStorage) {
  getSheetMusicMicStorage(storage).set(LS_ENDLESS, value);
}
