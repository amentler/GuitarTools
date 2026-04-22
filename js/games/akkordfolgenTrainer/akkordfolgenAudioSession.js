import {
  createAudioSessionState as createSharedAudioSessionState,
  openAudioSession as openSharedAudioSession,
  closeAudioSession as closeSharedAudioSession,
} from '../../shared/audio/audioSessionService.js';

export function createAkkordfolgenAudioSession() {
  return createSharedAudioSessionState();
}

export async function openAkkordfolgenAudioSession(session, stream, AudioContextCtor, fftSize) {
  return openSharedAudioSession(session, {
    stream,
    AudioContextCtor,
    fftSize,
  });
}

export function closeAkkordfolgenAudioSession(session) {
  return closeSharedAudioSession(session);
}
