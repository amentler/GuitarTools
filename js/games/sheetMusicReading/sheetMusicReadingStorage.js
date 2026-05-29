import { createStorageService } from '../../shared/storage/storageService.js';

const LS_BPM = 'sheetMusic_bpm';
const LS_TIMESIG = 'sheetMusic_timeSig';
const LS_TAB = 'sheetMusic_showTab';
const LS_ENDLESS = 'sheetMusic_endless';
const LS_ACTIVE = 'sheetMusic_active';
const LS_KEY = 'sheetMusic_key';
const LS_USE_KEY = 'sheetMusic_useKey';
const LS_ARPEGGIO = 'sheetMusic_arpeggio';

function getSheetMusicStorage(storage = globalThis.localStorage) {
  return createStorageService({ storage });
}

export function loadSheetMusicPrefs(storage = globalThis.localStorage) {
  const sharedStorage = getSheetMusicStorage(storage);

  return {
    active: sharedStorage.getBoolean(LS_ACTIVE, { defaultValue: false }),
    showTab: sharedStorage.getBoolean(LS_TAB, { defaultValue: false }),
    bpm: sharedStorage.getNumber(LS_BPM, {
      defaultValue: 80,
      parse: value => parseInt(value, 10),
    }),
    timeSig: sharedStorage.getString(LS_TIMESIG, { defaultValue: '4/4' }),
    key: sharedStorage.getString(LS_KEY, { defaultValue: 'C' }),
    endless: sharedStorage.getBoolean(LS_ENDLESS, { defaultValue: false }),
    useKey: sharedStorage.getBoolean(LS_USE_KEY, { defaultValue: true }),
    arpeggio: sharedStorage.getBoolean(LS_ARPEGGIO, { defaultValue: false }),
  };
}

export function saveSheetMusicBpm(value, storage = globalThis.localStorage) {
  getSheetMusicStorage(storage).set(LS_BPM, value);
}

export function saveSheetMusicActive(value, storage = globalThis.localStorage) {
  getSheetMusicStorage(storage).set(LS_ACTIVE, value);
}

export function saveSheetMusicTimeSig(value, storage = globalThis.localStorage) {
  getSheetMusicStorage(storage).set(LS_TIMESIG, value);
}

export function saveSheetMusicKey(value, storage = globalThis.localStorage) {
  getSheetMusicStorage(storage).set(LS_KEY, value);
}

export function saveSheetMusicShowTab(value, storage = globalThis.localStorage) {
  getSheetMusicStorage(storage).set(LS_TAB, value);
}

export function saveSheetMusicEndless(value, storage = globalThis.localStorage) {
  getSheetMusicStorage(storage).set(LS_ENDLESS, value);
}

export function saveSheetMusicUseKey(value, storage = globalThis.localStorage) {
  getSheetMusicStorage(storage).set(LS_USE_KEY, value);
}

export function saveSheetMusicArpeggio(value, storage = globalThis.localStorage) {
  getSheetMusicStorage(storage).set(LS_ARPEGGIO, value);
}
