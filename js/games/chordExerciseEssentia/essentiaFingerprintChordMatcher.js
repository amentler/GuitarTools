import { matchChordPath } from './essentiaChordLogic.js';

// The Essentia path is intentionally lean for the upcoming rebuild phase.
// No matcher-specific alias tables or fingerprint-only fallback rules live here.
export function matchEssentiaFingerprintHpcpToChord(hpcp, targetChordName, templates, thresholdOverride, options = {}) {
  return matchChordPath(hpcp, targetChordName, templates, thresholdOverride, options);
}
