/**
 * sheetMusicRecorder.js
 *
 * Minimal WAV recorder based on ScriptProcessorNode (no external deps).
 * The recorder holds its own AudioContext but can reuse an existing
 * MediaStream (e.g. from the active mode) to avoid opening a second
 * concurrent stream on the same device.
 */

import { requestMicrophoneStream } from '../../shared/audio/microphoneService.js';

const SAMPLE_RATE = 44100;
const BUFFER_SIZE = 4096;

/**
 * Encodes an array of per-chunk channel data into a 16-bit PCM WAV Uint8Array.
 * @param {Float32Array[][]} chunks  Array of frames; each frame is an array of
 *                                   Float32Arrays, one per channel (interleaved order).
 * @param {number} sampleRate
 * @param {number} numChannels
 * @returns {Uint8Array}
 */
function encodeWav(chunks, sampleRate, numChannels) {
  const samplesPerChannel = chunks.reduce((s, c) => s + c[0].length, 0);
  const byteCount = samplesPerChannel * numChannels * 2; // 16-bit PCM

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
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);                             // PCM format
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * numChannels * 2, true);  // byte rate
  view.setUint16(32, numChannels * 2, true);               // block align
  view.setUint16(34, 16, true);                            // bits per sample
  // data chunk
  writeStr(36, 'data');
  view.setUint32(40, byteCount, true);

  let offset = 44;
  for (const channelFrames of chunks) {
    const frameLen = channelFrames[0].length;
    for (let i = 0; i < frameLen; i++) {
      for (let c = 0; c < numChannels; c++) {
        const s = Math.max(-1, Math.min(1, channelFrames[c][i]));
        view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7fff, true);
        offset += 2;
      }
    }
  }

  return new Uint8Array(buffer);
}

/**
 * Factory for a minimal microphone WAV recorder.
 *
 * @returns {{
 *   start(existingStream?: MediaStream|null): Promise<void>,
 *   stop(): Uint8Array|null,
 *   cancel(): void,
 *   get isRecording(): boolean
 * }}
 */
export function createRecorder() {
  let audioCtx = null;
  let stream = null;
  let streamOwned = false;
  let processor = null;
  let source = null;
  let chunks = [];
  let numChannels = 1;
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
    if (streamOwned && stream) {
      stream.getTracks().forEach(t => t.stop());
    }
    stream = null;
    streamOwned = false;
    if (audioCtx) {
      audioCtx.close().catch(() => {});
      audioCtx = null;
    }
    chunks = [];
    numChannels = 1;
    recording = false;
  }

  return {
    get isRecording() {
      return recording;
    },

    /**
     * @param {MediaStream|null} [existingStream]  Pass the active-mode stream to avoid
     *   opening a second concurrent getUserMedia on the same device.  When null/omitted
     *   the recorder opens its own stereo stream.
     */
    async start(existingStream = null) {
      if (recording) return;

      if (existingStream) {
        stream = existingStream;
        streamOwned = false;
      } else {
        stream = await requestMicrophoneStream({
          constraints: {
            audio: {
              noiseSuppression: false,
              echoCancellation: false,
              autoGainControl: false,
              channelCount: { ideal: 2 },
            },
            video: false,
          },
        });
        streamOwned = true;
      }

      // Detect actual channel count delivered by the device/browser.
      const trackSettings = stream.getAudioTracks()[0]?.getSettings?.() ?? {};
      numChannels = Math.min(2, Math.max(1, trackSettings.channelCount ?? 1));

      audioCtx = new AudioContext({ sampleRate: SAMPLE_RATE });
      source = audioCtx.createMediaStreamSource(stream);

      // ScriptProcessorNode is deprecated but universally supported without build tools.
      processor = audioCtx.createScriptProcessor(BUFFER_SIZE, numChannels, numChannels);
      chunks = [];

      processor.onaudioprocess = (e) => {
        if (!recording) return;
        const channelFrames = [];
        for (let c = 0; c < numChannels; c++) {
          channelFrames.push(new Float32Array(e.inputBuffer.getChannelData(c)));
        }
        chunks.push(channelFrames);
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
      const capturedChannels = numChannels;

      cleanup();

      if (capturedChunks.length === 0) return null;
      return encodeWav(capturedChunks, capturedRate, capturedChannels);
    },

    cancel() {
      if (!recording && !audioCtx) return;
      cleanup();
    },
  };
}
