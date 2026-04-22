export function resolveAudioContextCtor({
  windowObject = globalThis.window,
  AudioContextCtor,
} = {}) {
  return AudioContextCtor
    ?? windowObject?.AudioContext
    ?? windowObject?.webkitAudioContext
    ?? globalThis.AudioContext
    ?? globalThis.webkitAudioContext
    ?? null;
}

export function createAudioContext(options = {}) {
  const AudioCtor = resolveAudioContextCtor(options);
  if (!AudioCtor) {
    throw new Error('AudioContext is not supported in this environment');
  }
  return new AudioCtor();
}

export function createAudioContextFactory(baseOptions = {}) {
  return function buildAudioContext(overrideOptions = {}) {
    return createAudioContext({
      ...baseOptions,
      ...overrideOptions,
    });
  };
}
