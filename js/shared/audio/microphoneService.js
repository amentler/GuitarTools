const DEFAULT_CONSTRAINTS = { audio: true, video: false };

export function resolveGetUserMedia({
  mediaDevices = globalThis.navigator?.mediaDevices,
  getUserMedia,
} = {}) {
  return getUserMedia ?? mediaDevices?.getUserMedia?.bind(mediaDevices) ?? null;
}

export function requestMicrophoneStream({
  constraints = DEFAULT_CONSTRAINTS,
  ...options
} = {}) {
  const getUserMedia = resolveGetUserMedia(options);
  if (!getUserMedia) {
    throw new Error('getUserMedia is not available');
  }
  return getUserMedia(constraints);
}

export function stopMicrophoneStream(stream) {
  if (!stream?.getTracks) return;
  for (const track of stream.getTracks()) {
    try {
      track.stop();
    } catch {
      // Track teardown should stay best-effort and idempotent.
    }
  }
}
