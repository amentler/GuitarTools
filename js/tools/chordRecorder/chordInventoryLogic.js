export function buildInventoryEntry(sidecar) {
  return {
    chord:         sidecar.chord,
    chordKey:      sidecar.chordKey,
    guitarSize:    sidecar.guitarSize,
    guitarStrings: sidecar.guitarStrings,
    technique:     sidecar.technique,
    strumMode:     sidecar.strumMode,
    volume:        sidecar.volume,
  };
}

export function countMatchingRecordings(recordings, chordKey, filter) {
  const { guitarSize, guitarStrings, techniken, strumModi } = filter;
  return recordings.filter(r => {
    if (r.chordKey !== chordKey) return false;
    if (guitarSize  && r.guitarSize    !== guitarSize)            return false;
    if (guitarStrings && r.guitarStrings !== guitarStrings)       return false;
    if (techniken?.length && !techniken.includes(r.technique))   return false;
    if (strumModi?.length && !strumModi.includes(r.strumMode))   return false;
    return true;
  }).length;
}

export function isChordSufficient(recordings, chordKey, filter, target = 3) {
  return countMatchingRecordings(recordings, chordKey, filter) >= target;
}
