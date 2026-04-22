export function createAudioSessionState() {
  return {
    audioCtx: null,
    analyser: null,
    stream: null,
  };
}

export async function openAudioSession(audioSession, stream, AudioContextCtor, initialFftSize) {
  const audioCtx = new AudioContextCtor();
  if (audioCtx.state === 'suspended') {
    await audioCtx.resume();
  }

  const analyser = audioCtx.createAnalyser();
  analyser.fftSize = initialFftSize;

  const hpFilter = audioCtx.createBiquadFilter();
  hpFilter.type = 'highpass';
  hpFilter.frequency.value = 60;
  hpFilter.Q.value = 0.7;

  const lpFilter = audioCtx.createBiquadFilter();
  lpFilter.type = 'lowpass';
  lpFilter.frequency.value = 500;
  lpFilter.Q.value = 0.7;

  audioCtx.createMediaStreamSource(stream)
    .connect(hpFilter)
    .connect(lpFilter)
    .connect(analyser);

  audioSession.audioCtx = audioCtx;
  audioSession.analyser = analyser;
  audioSession.stream = stream;
}

export async function closeAudioSession(audioSession) {
  if (audioSession.stream) {
    audioSession.stream.getTracks().forEach(track => track.stop());
    audioSession.stream = null;
  }

  if (audioSession.audioCtx) {
    await audioSession.audioCtx.close();
    audioSession.audioCtx = null;
    audioSession.analyser = null;
  }
}
