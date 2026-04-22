import { createAudioContext } from './audioContextFactory.js';
import { stopMicrophoneStream } from './microphoneService.js';

export function createAudioSessionState(overrides = {}) {
  return {
    audioCtx: null,
    analyser: null,
    stream: null,
    ...overrides,
  };
}

export async function openAudioSession(
  session,
  {
    stream,
    fftSize,
    AudioContextCtor,
    audioContextFactory = options => createAudioContext(options),
    configureAnalyser,
    connectSource,
  } = {},
) {
  let audioCtx = null;

  try {
    const maybeAudioCtx = audioContextFactory({ AudioContextCtor });
    audioCtx = typeof maybeAudioCtx?.then === 'function'
      ? await maybeAudioCtx
      : maybeAudioCtx;
    if (audioCtx.state === 'suspended' && typeof audioCtx.resume === 'function') {
      await audioCtx.resume();
    }

    const analyser = audioCtx.createAnalyser();
    if (typeof configureAnalyser === 'function') {
      configureAnalyser(analyser, audioCtx);
    } else if (Number.isFinite(fftSize)) {
      analyser.fftSize = fftSize;
    }

    const source = audioCtx.createMediaStreamSource(stream);
    if (typeof connectSource === 'function') {
      const maybeConnection = connectSource({ audioCtx, analyser, source, stream });
      if (typeof maybeConnection?.then === 'function') {
        await maybeConnection;
      }
    } else {
      source.connect(analyser);
    }

    session.audioCtx = audioCtx;
    session.analyser = analyser;
    session.stream = stream;
    return session;
  } catch (error) {
    stopMicrophoneStream(stream);

    if (audioCtx && typeof audioCtx.close === 'function') {
      try {
        await audioCtx.close();
      } catch {
        // Cleanup should not mask the original failure.
      }
    }

    session.audioCtx = null;
    session.analyser = null;
    session.stream = null;
    throw error;
  }
}

export async function closeAudioSession(session, { reset } = {}) {
  if (!session) return;

  const stream = session.stream;
  const audioCtx = session.audioCtx;

  session.stream = null;
  session.audioCtx = null;
  session.analyser = null;

  stopMicrophoneStream(stream);

  if (audioCtx && typeof audioCtx.close === 'function') {
    try {
      await audioCtx.close();
    } catch {
      // Closing remains best-effort so repeated teardown stays safe.
    }
  }

  if (typeof reset === 'function') {
    reset(session);
  }
}
