export const CHORD_DETECTION_PATHS = Object.freeze({
  ESSENTIA: 'essentia',
  PURE_JS: 'pure-js',
});

export function getDefaultChordDetectionPath() {
  return CHORD_DETECTION_PATHS.ESSENTIA;
}

export function resolveChordDetectionPath(options = {}) {
  if (options.path === CHORD_DETECTION_PATHS.ESSENTIA || options.path === CHORD_DETECTION_PATHS.PURE_JS) {
    return options.path;
  }

  if (typeof options.preferEssentia === 'boolean') {
    return options.preferEssentia
      ? CHORD_DETECTION_PATHS.ESSENTIA
      : CHORD_DETECTION_PATHS.PURE_JS;
  }

  return getDefaultChordDetectionPath();
}

export function isEssentiaDetectionPath(path) {
  return path === CHORD_DETECTION_PATHS.ESSENTIA;
}
