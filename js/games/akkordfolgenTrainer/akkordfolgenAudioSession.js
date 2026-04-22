export function createAkkordfolgenAudioSession() {
  return {
    audioCtx: null,
    analyser: null,
    stream: null,
  };
}

export async function openAkkordfolgenAudioSession(session, stream, AudioContextCtor, fftSize) {
  const audioCtx = new AudioContextCtor();
  if (audioCtx.state === 'suspended') {
    await audioCtx.resume();
  }

  const analyser = audioCtx.createAnalyser();
  analyser.fftSize = fftSize;
  audioCtx.createMediaStreamSource(stream).connect(analyser);

  session.audioCtx = audioCtx;
  session.analyser = analyser;
  session.stream = stream;
}

export function closeAkkordfolgenAudioSession(session) {
  if (session.stream) {
    session.stream.getTracks().forEach(track => track.stop());
    session.stream = null;
  }
  if (session.audioCtx) {
    session.audioCtx.close().catch(() => {});
    session.audioCtx = null;
    session.analyser = null;
  }
}
