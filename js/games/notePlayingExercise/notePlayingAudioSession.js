import {
  createAudioSessionState as createSharedAudioSessionState,
  openAudioSession as openSharedAudioSession,
  closeAudioSession as closeSharedAudioSession,
} from '../../shared/audio/audioSessionService.js';

export function createNotePlayingAudioSession() {
  return createSharedAudioSessionState({ currentFftSize: 0 });
}

export async function openNotePlayingAudioSession(session, stream, AudioContextCtor) {
  session.currentFftSize = 0;
  return openSharedAudioSession(session, {
    stream,
    AudioContextCtor,
  });
}

export function closeNotePlayingAudioSession(session) {
  return closeSharedAudioSession(session, {
    reset: currentSession => {
      currentSession.currentFftSize = 0;
    },
  });
}
