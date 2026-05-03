import { matchChordPath } from './essentiaChordLogic.js';

// Historical Pure-JS reference before the later Essentia-specific fallback work.
// The goal is to preserve this matcher behavior behind the dedicated pure-js path
// even if its precision shifts when the fixture corpus evolves.
export const PURE_JS_MATCHER_REFERENCE_COMMIT = 'c1125a8';

export function matchPureJsHpcpToChord(hpcp, targetChordName, templates, thresholdOverride, options = {}) {
  return matchChordPath(hpcp, targetChordName, templates, thresholdOverride, options);
}
