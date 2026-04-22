export function createSheetMusicMicAudioSession() {
  return {
    audioCtx: null,
    analyser: null,
    stream: null,
    currentFftSize: 0,
  };
}

export function openSheetMusicMicAudioSession(session, stream, AudioContextCtor) {
  const audioCtx = new AudioContextCtor();
  if (audioCtx.state === 'suspended') {
    audioCtx.resume();
  }

  const analyser = audioCtx.createAnalyser();
  audioCtx.createMediaStreamSource(stream).connect(analyser);

  session.audioCtx = audioCtx;
  session.analyser = analyser;
  session.stream = stream;
  session.currentFftSize = 0;
}

export async function closeSheetMusicMicAudioSession(session) {
  if (session.stream) {
    session.stream.getTracks().forEach(track => track.stop());
    session.stream = null;
  }

  if (session.audioCtx) {
    await session.audioCtx.close();
    session.audioCtx = null;
    session.analyser = null;
  }

  session.currentFftSize = 0;
}
