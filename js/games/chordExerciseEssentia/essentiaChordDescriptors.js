import {
  GERMAN_TO_BIN,
  TYPE_INTERVALS,
  DEFAULT_PROFILE,
  CHORD_TYPE_PROFILES,
} from './essentiaChordConstants.js';

export function stripChordAnnotation(chordName) {
  return chordName.replace(/\s*\([^)]*\)\s*$/, '').trim();
}

export function parseChordDescriptor(chordName) {
  if (!chordName || typeof chordName !== 'string') return null;

  const cleaned = stripChordAnnotation(chordName);

  const hyphenMatch = cleaned.match(/^([A-Z][a-z]*)-([A-Za-z0-9]+)$/);
  if (hyphenMatch) {
    const root = hyphenMatch[1];
    const type = hyphenMatch[2];
    if (GERMAN_TO_BIN[root] !== undefined && TYPE_INTERVALS[type] !== undefined) {
      return { root, type };
    }
  }

  const suffixes = ['7sus4', 'maj7', 'm7', 'sus2', 'sus4', 'add9', 'dim'];
  for (const suffix of suffixes) {
    if (!cleaned.endsWith(suffix)) continue;
    const root = cleaned.slice(0, -suffix.length);
    if (GERMAN_TO_BIN[root] !== undefined) return { root, type: suffix };
  }

  const dom7Match = cleaned.match(/^([A-Z][a-z]*)7$/);
  if (dom7Match) {
    const root = dom7Match[1];
    if (GERMAN_TO_BIN[root] !== undefined) {
      return { root, type: '7' };
    }
  }

  return null;
}

export function getChordDescriptor(chordName) {
  const parsed = parseChordDescriptor(chordName);
  if (!parsed) return null;

  const rootBin = GERMAN_TO_BIN[parsed.root];
  const intervals = TYPE_INTERVALS[parsed.type];
  if (rootBin === undefined || !intervals) return null;

  const descriptor = {
    type: parsed.type,
    rootBin,
    fifthBin: (rootBin + 7) % 12,
    minorThirdBin: (rootBin + 3) % 12,
    majorThirdBin: (rootBin + 4) % 12,
    expectedThirdBin: null,
    expectedSecondBin: null,
    expectedFourthBin: null,
    competingThirdBin: null,
    expectedSeventhBin: null,
    extensionSecondBin: null,
  };

  if (['Dur', '7', 'maj7', 'add9'].includes(parsed.type)) {
    descriptor.expectedThirdBin = (rootBin + 4) % 12;
    descriptor.competingThirdBin = (rootBin + 3) % 12;
  } else if (['Moll', 'm7', 'dim'].includes(parsed.type)) {
    descriptor.expectedThirdBin = (rootBin + 3) % 12;
    descriptor.competingThirdBin = (rootBin + 4) % 12;
  }

  if (parsed.type === '7') {
    descriptor.expectedSeventhBin = (rootBin + 10) % 12;
  } else if (parsed.type === '7sus4') {
    descriptor.expectedSeventhBin = (rootBin + 10) % 12;
  } else if (parsed.type === 'maj7') {
    descriptor.expectedSeventhBin = (rootBin + 11) % 12;
  } else if (parsed.type === 'm7') {
    descriptor.expectedSeventhBin = (rootBin + 10) % 12;
  }

  if (parsed.type === 'sus2' || parsed.type === 'add9') {
    descriptor.expectedSecondBin = (rootBin + 2) % 12;
  }
  if (parsed.type === 'sus4') {
    descriptor.expectedFourthBin = (rootBin + 5) % 12;
  }

  if (!intervals.includes(2)) {
    descriptor.extensionSecondBin = (rootBin + 2) % 12;
  }

  return descriptor;
}

export const CHORD_MATCH_SPECIAL_CASES = {
  Asus2: {
    acceptedBestMatches: ['Asus2', 'H7sus4'],
    minimumAcceptedScore: 0.53,
    reportAsTarget: true,
  },
};

export function getEffectiveTargetChordName(chordName) {
  return chordName;
}

export function getChordProfile(descriptor) {
  if (!descriptor) return DEFAULT_PROFILE;
  return CHORD_TYPE_PROFILES[descriptor.type] ?? DEFAULT_PROFILE;
}

export function sharesRoot(descriptorA, descriptorB) {
  if (!descriptorA || !descriptorB) return false;
  return descriptorA.rootBin === descriptorB.rootBin;
}

export function isTriadModeSensitive(descriptor) {
  if (!descriptor) return false;
  return descriptor.type === 'Dur' || descriptor.type === 'Moll';
}

export function isAnnotatedVariant(chordName) {
  const annotation = chordName.match(/\(([^)]*)\)/)?.[1]?.trim();
  if (!annotation) return false;

  return /finger|rock|klein/i.test(annotation);
}
