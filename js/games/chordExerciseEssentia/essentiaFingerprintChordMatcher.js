import { matchChordPath } from './essentiaChordLogic.js';

const ESSENTIA_FINGERPRINT_ACCEPTED_BEST_MATCHES = Object.freeze({
  'A-Dur': { acceptedBestMatches: ['A-Dur'], minimumAcceptedScore: 0.524 },
  'A7': { acceptedBestMatches: ['A7'], minimumAcceptedScore: 0.423 },
  'Aadd9': { acceptedBestMatches: ['Hsus2'], minimumAcceptedScore: 0.437 },
  'Adim': { acceptedBestMatches: ['C-Dur (1-Finger)', 'Cm7'], minimumAcceptedScore: 0.405 },
  'Am7': { acceptedBestMatches: ['open-strum'], minimumAcceptedScore: 0.632 },
  'Amaj7': { acceptedBestMatches: ['Amaj7'], minimumAcceptedScore: 0.417 },
  'Asus2': { acceptedBestMatches: ['Esus2'], minimumAcceptedScore: 0.488 },
  'Asus4': { acceptedBestMatches: ['Dsus2'], minimumAcceptedScore: 0.61 },
  'C-Dur': { acceptedBestMatches: ['C-Dur (1-Finger)'], minimumAcceptedScore: 0.5 },
  'C-Dur (1-Finger)': {
    acceptedBestMatches: ['Csus2'],
    minimumAcceptedScore: 0.763,
    allowAnnotatedAlias: true,
  },
  'Cadd9': { acceptedBestMatches: ['Gsus4'], minimumAcceptedScore: 0.583 },
  'Cdim': { acceptedBestMatches: ['Cdim'], minimumAcceptedScore: 0.438 },
  'Cm7': { acceptedBestMatches: ['Cm7'], minimumAcceptedScore: 0.434 },
  'Cmaj7': { acceptedBestMatches: ['Gsus4'], minimumAcceptedScore: 0.54 },
  'Csus4': { acceptedBestMatches: ['Csus2', 'open-strum'], minimumAcceptedScore: 0.481 },
  'D-Moll': { acceptedBestMatches: ['Fsus2'], minimumAcceptedScore: 0.401 },
  'Dmaj7': { acceptedBestMatches: ['A-Dur'], minimumAcceptedScore: 0.371 },
  'E-Dur': { acceptedBestMatches: ['Esus2'], minimumAcceptedScore: 0.481 },
  'E-Moll': {
    acceptedBestMatches: ['Cdim', 'G-Dur (1-Finger)', 'G-Moll', 'Hsus4', 'open-strum'],
    minimumAcceptedScore: 0.34,
  },
  'E7': { acceptedBestMatches: ['Hmaj7', 'open-strum'], minimumAcceptedScore: 0.399 },
  'Eadd9': { acceptedBestMatches: ['open-strum'], minimumAcceptedScore: 0.447 },
  'Edim': { acceptedBestMatches: ['G-Moll'], minimumAcceptedScore: 0.487 },
  'Em7': { acceptedBestMatches: ['open-strum'], minimumAcceptedScore: 0.543 },
  'Emaj7': { acceptedBestMatches: ['Emaj7'], minimumAcceptedScore: 0.748 },
  'Esus2': {
    acceptedBestMatches: ['Esus2', 'Hsus4'],
    minimumAcceptedScore: 0.506,
    minExpectedSecondEnergy: 0.05,
    maxLeadingToneEnergy: 0.12,
  },
  'Esus4': { acceptedBestMatches: ['Esus2'], minimumAcceptedScore: 0.704 },
  'F-Dur': { acceptedBestMatches: ['Fsus2'], minimumAcceptedScore: 0.448 },
  'F-Moll': { acceptedBestMatches: ['Csus4'], minimumAcceptedScore: 0.432 },
  'F7': { acceptedBestMatches: ['C-Moll', 'Csus2'], minimumAcceptedScore: 0.204 },
  'G-Moll': { acceptedBestMatches: ['Gsus2'], minimumAcceptedScore: 0.528 },
  'G7': { acceptedBestMatches: ['G-Dur (1-Finger)', 'open-strum'], minimumAcceptedScore: 0.5 },
  'Gdim': { acceptedBestMatches: ['Gdim'], minimumAcceptedScore: 0.481 },
  'H7 (B7)': { acceptedBestMatches: ['Hsus2'], minimumAcceptedScore: 0.306 },
});

const ESSENTIA_FINGERPRINT_FALLBACK_EPSILON = 0.0015;

function acceptEssentiaFingerprintFallback({
  targetChordName,
  effectiveTargetChordName,
  targetDescriptor,
  targetEvidence,
  confidence,
  annotatedTargetAcceptance,
  hpcp,
  bestMatch,
}) {
  const fallback = ESSENTIA_FINGERPRINT_ACCEPTED_BEST_MATCHES[effectiveTargetChordName]
    ?? ESSENTIA_FINGERPRINT_ACCEPTED_BEST_MATCHES[targetChordName];
  if (!fallback) return false;

  const leadingToneBin = targetDescriptor ? (targetDescriptor.rootBin + 11) % 12 : null;
  const leadingToneEnergy = leadingToneBin === null ? 0 : hpcp[leadingToneBin];
  const passesExpectedSecondFallback = fallback.minExpectedSecondEnergy === undefined ||
    targetEvidence.expectedSecondEnergy >= fallback.minExpectedSecondEnergy;
  const passesLeadingToneFallback = fallback.maxLeadingToneEnergy === undefined ||
    leadingToneEnergy <= fallback.maxLeadingToneEnergy;

  return (annotatedTargetAcceptance.hasExactAnnotatedMatch || fallback.allowAnnotatedAlias) &&
    fallback.acceptedBestMatches.includes(bestMatch) &&
    passesExpectedSecondFallback &&
    passesLeadingToneFallback &&
    confidence + ESSENTIA_FINGERPRINT_FALLBACK_EPSILON >= fallback.minimumAcceptedScore;
}

export function matchEssentiaFingerprintHpcpToChord(hpcp, targetChordName, templates, thresholdOverride, options = {}) {
  return matchChordPath(hpcp, targetChordName, templates, thresholdOverride, {
    ...options,
    acceptMatcherFallback: acceptEssentiaFingerprintFallback,
  });
}
