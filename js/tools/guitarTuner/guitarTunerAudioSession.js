import {
  createAudioSessionState as createSharedAudioSessionState,
  openAudioSession as openSharedAudioSession,
  closeAudioSession as closeSharedAudioSession,
} from '../../shared/audio/audioSessionService.js';

export function createAudioSessionState() {
  return createSharedAudioSessionState();
}

export async function openAudioSession(audioSession, stream, AudioContextCtor, initialFftSize) {
  return openSharedAudioSession(audioSession, {
    stream,
    AudioContextCtor,
    fftSize: initialFftSize,
    connectSource: ({ audioCtx, analyser, source }) => {
      const hpFilter = audioCtx.createBiquadFilter();
      hpFilter.type = 'highpass';
      hpFilter.frequency.value = 60;
      hpFilter.Q.value = 0.7;

      const lpFilter = audioCtx.createBiquadFilter();
      lpFilter.type = 'lowpass';
      lpFilter.frequency.value = 500;
      lpFilter.Q.value = 0.7;

      source
        .connect(hpFilter)
        .connect(lpFilter)
        .connect(analyser);
    },
  });
}

export async function closeAudioSession(audioSession) {
  return closeSharedAudioSession(audioSession);
}
