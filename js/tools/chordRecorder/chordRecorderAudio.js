import { requestMicrophoneStream, stopMicrophoneStream } from '../../shared/audio/microphoneService.js';

const FFT_SIZE = 2048;
const ONSET_RMS_THRESHOLD = 0.05;

export function encodeWav(samples, sampleRate) {
  const n = samples.length;
  const buf = new ArrayBuffer(44 + n * 2);
  const view = new DataView(buf);

  function str(off, s) { for (let i = 0; i < s.length; i++) view.setUint8(off + i, s.charCodeAt(i)); }

  str(0, 'RIFF'); view.setUint32(4, 36 + n * 2, true);
  str(8, 'WAVE'); str(12, 'fmt ');
  view.setUint32(16, 16, true); view.setUint16(20, 1, true); view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true); view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true); view.setUint16(34, 16, true);
  str(36, 'data'); view.setUint32(40, n * 2, true);

  let off = 44;
  for (let i = 0; i < n; i++) {
    const s = Math.max(-1, Math.min(1, samples[i]));
    view.setInt16(off, Math.round(s < 0 ? s * 0x8000 : s * 0x7FFF), true);
    off += 2;
  }
  return new Blob([buf], { type: 'audio/wav' });
}

export function createChordRecorderAudio() {
  let audioCtx = null;
  let analyser = null;
  let stream = null;
  let rafId = null;

  async function open() {
    stream = await requestMicrophoneStream({
      constraints: {
        audio: { channelCount: { ideal: 1 }, echoCancellation: false, noiseSuppression: false },
        video: false,
      },
    });
    audioCtx = new AudioContext();
    const source = audioCtx.createMediaStreamSource(stream);
    analyser = audioCtx.createAnalyser();
    analyser.fftSize = FFT_SIZE;
    source.connect(analyser);
  }

  function startOnsetWatch(onOnset) {
    const buf = new Float32Array(FFT_SIZE);
    function loop() {
      analyser.getFloatTimeDomainData(buf);
      let sum = 0;
      for (const s of buf) sum += s * s;
      if (Math.sqrt(sum / buf.length) >= ONSET_RMS_THRESHOLD) {
        onOnset();
      } else {
        rafId = requestAnimationFrame(loop);
      }
    }
    rafId = requestAnimationFrame(loop);
  }

  function stopOnsetWatch() {
    if (rafId !== null) { cancelAnimationFrame(rafId); rafId = null; }
  }

  async function recordForDuration(durationMs) {
    const chunks = [];
    const recorder = new MediaRecorder(stream);
    recorder.ondataavailable = e => { if (e.data.size > 0) chunks.push(e.data); };

    return new Promise((resolve, reject) => {
      recorder.onstop = async () => {
        try {
          const blob = new Blob(chunks, { type: recorder.mimeType });
          const ab = await blob.arrayBuffer();
          const tempCtx = new AudioContext();
          const audioBuf = await tempCtx.decodeAudioData(ab);
          const samples = Float32Array.from(audioBuf.getChannelData(0));
          await tempCtx.close();
          resolve({ samples, sampleRate: audioBuf.sampleRate, durationSec: durationMs / 1000 });
        } catch (err) { reject(err); }
      };
      recorder.start();
      setTimeout(() => recorder.stop(), durationMs);
    });
  }

  function close() {
    stopOnsetWatch();
    if (analyser) { analyser.disconnect(); analyser = null; }
    if (audioCtx) { audioCtx.close(); audioCtx = null; }
    if (stream) { stopMicrophoneStream(stream); stream = null; }
  }

  return { open, startOnsetWatch, stopOnsetWatch, recordForDuration, close };
}
