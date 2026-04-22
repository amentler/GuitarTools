const LS_BPM = 'sheetMusic_bpm';
const LS_TIMESIG = 'sheetMusic_timeSig';
const LS_TAB = 'sheetMusic_showTab';
const LS_ENDLESS = 'sheetMusic_endless';

export function loadSheetMusicPrefs(storage = localStorage) {
  return {
    showTab: storage.getItem(LS_TAB) === 'true',
    bpm: parseInt(storage.getItem(LS_BPM), 10) || 80,
    timeSig: storage.getItem(LS_TIMESIG) || '4/4',
    endless: storage.getItem(LS_ENDLESS) === 'true',
  };
}

export function saveSheetMusicBpm(value, storage = localStorage) {
  storage.setItem(LS_BPM, String(value));
}

export function saveSheetMusicTimeSig(value, storage = localStorage) {
  storage.setItem(LS_TIMESIG, value);
}

export function saveSheetMusicShowTab(value, storage = localStorage) {
  storage.setItem(LS_TAB, String(value));
}

export function saveSheetMusicEndless(value, storage = localStorage) {
  storage.setItem(LS_ENDLESS, String(value));
}
