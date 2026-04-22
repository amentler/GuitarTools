import {
  createAudioSessionState as createSharedAudioSessionState,
  openAudioSession as openSharedAudioSession,
  closeAudioSession as closeSharedAudioSession,
} from '../../shared/audio/audioSessionService.js';

export function createSheetMusicMicAudioSession() {
  return createSharedAudioSessionState({ currentFftSize: 0 });
}

export function openSheetMusicMicAudioSession(session, stream, AudioContextCtor) {
  session.currentFftSize = 0;
  return openSharedAudioSession(session, {
    stream,
    AudioContextCtor,
  });
}

export async function closeSheetMusicMicAudioSession(session) {
  return closeSharedAudioSession(session, {
    reset: currentSession => {
      currentSession.currentFftSize = 0;
    },
  });
}
