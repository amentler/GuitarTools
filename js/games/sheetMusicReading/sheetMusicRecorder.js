/**
 * sheetMusicRecorder.js
 *
 * Minimal WAV recorder based on ScriptProcessorNode (no external deps).
 * The recorder holds its own AudioContext + MediaStream, fully independent
 * from the Aktiv-Modus audio session.
 */

import { requestMicrophoneStream } from '../../shared/audio/microphoneService.js';

const SAMPLE_RATE = 44100;
const BUFFER_SIZE = 4096;

/**
 * Encodes an array of Float32 chunks into a 16-bit mono WAV Uint8Array.
 * @param {Float32Array[]} chunks
 * @param {number} sampleRate
 * @returns {Uint8Array}
 */
function encodeWav(chunks, sampleRate) {
  const totalSamples = chunks.reduce((s, c) => s + c.length, 0);
  const byteCount = totalSamples * 2; // 16-bit PCM = 2 bytes per sample

  const buffer = new ArrayBuffer(44 + byteCount);
  const view = new DataView(buffer);

  const writeStr = (offset, str) => {
    for (let i = 0; i < str.length; i++) {
      view.setUint8(offset + i, str.charCodeAt(i));
    }
  };

  // RIFF header
  writeStr(0, 'RIFF');
  view.setUint32(4, 36 + byteCount, true);
  writeStr(8, 'WAVE');
  // fmt chunk
  writeStr(12, 'fmt ');
  view.setUint32(16, 16, true);          // chunk size
  view.setUint16(20, 1, true);           // PCM format
  view.setUint16(22, 1, true);           // mono
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true); // byte rate
  view.setUint16(32, 2, true);           // block align
  view.setUint16(34, 16, true);          // bits per sample
  // data chunk
  writeStr(36, 'data');
  view.setUint32(40, byteCount, true);

  let offset = 44;
  for (const chunk of chunks) {
    for (let i = 0; i < chunk.length; i++) {
      const s = Math.max(-1, Math.min(1, chunk[i]));
      view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7fff, true);
      offset += 2;
    }
  }

  return new Uint8Array(buffer);
}

/**
 * Factory for a minimal microphone WAV recorder.
 *
 * @returns {{ start(): Promise<void>, stop(): Uint8Array|null, cancel(): void, get isRecording(): boolean }}
 */
export function createRecorder() {
  let audioCtx = null;
  let stream = null;
  let processor = null;
  let source = null;
  let chunks = [];
  let recording = false;

  function cleanup() {
    if (processor) {
      processor.disconnect();
      processor.onaudioprocess = null;
      processor = null;
    }
    if (source) {
      source.disconnect();
      source = null;
    }
    if (stream) {
      stream.getTracks().forEach(t => t.stop());
      stream = null;
    }
    if (audioCtx) {
      audioCtx.close().catch(() => {});
      audioCtx = null;
    }
    chunks = [];
    recording = false;
  }

  return {
    get isRecording() {
      return recording;
    },

    async start() {
      if (recording) return;

      stream = await requestMicrophoneStream();
      audioCtx = new AudioContext({ sampleRate: SAMPLE_RATE });
      source = audioCtx.createMediaStreamSource(stream);

      // ScriptProcessorNode is deprecated but universally supported without build tools.
      processor = audioCtx.createScriptProcessor(BUFFER_SIZE, 1, 1);
      chunks = [];

      processor.onaudioprocess = (e) => {
        if (!recording) return;
        // Copy the channel data so the buffer is not reused by the browser.
        chunks.push(new Float32Array(e.inputBuffer.getChannelData(0)));
      };

      source.connect(processor);
      processor.connect(audioCtx.destination);
      recording = true;
    },

    stop() {
      if (!recording) return null;
      recording = false;

      const capturedChunks = chunks;
      const capturedRate = audioCtx?.sampleRate ?? SAMPLE_RATE;

      cleanup();

      if (capturedChunks.length === 0) return null;
      return encodeWav(capturedChunks, capturedRate);
    },

    cancel() {
      if (!recording && !audioCtx) return;
      cleanup();
    },
  };
}
