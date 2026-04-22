import { createStorageService } from '../../shared/storage/storageService.js';

const LS_BPM = 'sheetMusic_bpm';
const LS_TIMESIG = 'sheetMusic_timeSig';
const LS_TAB = 'sheetMusic_showTab';
const LS_ENDLESS = 'sheetMusic_endless';

function getSheetMusicStorage(storage = globalThis.localStorage) {
  return createStorageService({ storage });
}

export function loadSheetMusicPrefs(storage = globalThis.localStorage) {
  const sharedStorage = getSheetMusicStorage(storage);

  return {
    showTab: sharedStorage.getBoolean(LS_TAB, { defaultValue: false }),
    bpm: sharedStorage.getNumber(LS_BPM, {
      defaultValue: 80,
      parse: value => parseInt(value, 10),
    }),
    timeSig: sharedStorage.getString(LS_TIMESIG, { defaultValue: '4/4' }),
    endless: sharedStorage.getBoolean(LS_ENDLESS, { defaultValue: false }),
  };
}

export function saveSheetMusicBpm(value, storage = globalThis.localStorage) {
  getSheetMusicStorage(storage).set(LS_BPM, value);
}

export function saveSheetMusicTimeSig(value, storage = globalThis.localStorage) {
  getSheetMusicStorage(storage).set(LS_TIMESIG, value);
}

export function saveSheetMusicShowTab(value, storage = globalThis.localStorage) {
  getSheetMusicStorage(storage).set(LS_TAB, value);
}

export function saveSheetMusicEndless(value, storage = globalThis.localStorage) {
  getSheetMusicStorage(storage).set(LS_ENDLESS, value);
}
