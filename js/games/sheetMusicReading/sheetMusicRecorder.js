/**
 * sheetMusicRecorder.js
 *
 * MediaRecorder-based WAV recorder (no external deps).
 * Uses the browser's native encoder (webm/ogg/mp4), then converts to
 * 16-bit PCM WAV via decodeAudioData so the output format is always
 * consistent regardless of browser.
 *
 * The recorder can reuse an existing MediaStream (e.g. from the active
 * mode) to avoid opening a second concurrent stream on the same device.
 */

import { requestMicrophoneStream } from '../../shared/audio/microphoneService.js';

/**
 * Returns the best audio MIME type supported by this browser's MediaRecorder.
 * Priority: opus-in-webm (Chrome/Edge) → opus-in-ogg (Firefox) → mp4 (Safari).
 * Firefox on Windows is forced to webm first because its ogg/opus pipeline
 * produces intermittent audio dropouts on Windows audio drivers.
 * @returns {string}
 */
function getSupportedMimeType() {
  const isFirefoxWindows =
    typeof navigator !== 'undefined' &&
    /Firefox/.test(navigator.userAgent) &&
    /Windows/.test(navigator.userAgent);

  const candidates = isFirefoxWindows
    ? ['audio/webm;codecs=opus', 'audio/webm', 'audio/ogg;codecs=opus', 'audio/ogg']
    : ['audio/webm;codecs=opus', 'audio/ogg;codecs=opus', 'audio/webm', 'audio/ogg', 'audio/mp4'];

  return candidates.find(t => MediaRecorder.isTypeSupported(t)) ?? '';
}

/**
 * Encodes per-channel Float32 sample arrays into a 16-bit PCM WAV Uint8Array.
 * @param {Float32Array[]} channelData  One contiguous Float32Array per channel.
 * @param {number} sampleRate
 * @param {number} numChannels
 * @returns {Uint8Array}
 */
function encodeWav(channelData, sampleRate, numChannels) {
  const samplesPerChannel = channelData[0].length;
  const byteCount = samplesPerChannel * numChannels * 2; // 16-bit PCM

  const buffer = new ArrayBuffer(44 + byteCount);
  const view = new DataView(buffer);

  const writeStr = (offset, str) => {
    for (let i = 0; i < str.length; i++) view.setUint8(offset + i, str.charCodeAt(i));
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
  for (let i = 0; i < samplesPerChannel; i++) {
    for (let c = 0; c < numChannels; c++) {
      const s = Math.max(-1, Math.min(1, channelData[c][i]));
      view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7fff, true);
      offset += 2;
    }
  }

  return new Uint8Array(buffer);
}

/**
 * Factory for a MediaRecorder-based WAV recorder.
 *
 * @returns {{
 *   start(existingStream?: MediaStream|null): Promise<void>,
 *   stop(): Promise<Uint8Array|null>,
 *   cancel(): void,
 *   get isRecording(): boolean
 * }}
 */
export function createRecorder() {
  let mediaRecorder = null;
  let stream = null;
  let streamOwned = false;
  let recordedChunks = [];
  let mimeType = '';
  let recording = false;

  function cleanup() {
    if (mediaRecorder && mediaRecorder.state !== 'inactive') {
      mediaRecorder.stop();
    }
    mediaRecorder = null;
    if (streamOwned && stream) {
      stream.getTracks().forEach(t => t.stop());
    }
    stream = null;
    streamOwned = false;
    recordedChunks = [];
    mimeType = '';
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

      mimeType = getSupportedMimeType();
      recordedChunks = [];
      try {
        mediaRecorder = new MediaRecorder(stream, mimeType ? { mimeType } : {});
      } catch {
        // Forced MIME type not accepted by this browser – fall back to default.
        mimeType = '';
        mediaRecorder = new MediaRecorder(stream);
      }
      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) recordedChunks.push(e.data);
      };
      mediaRecorder.start(100); // 100ms timeslice for regular data events
      recording = true;
    },

    /**
     * Stops recording and resolves with a 16-bit PCM WAV Uint8Array.
     * The conversion (compressed → WAV) happens via decodeAudioData.
     * @returns {Promise<Uint8Array|null>}
     */
    async stop() {
      if (!recording) return null;
      recording = false;

      // Create the AudioContext here, while still in the user-gesture chain,
      // because iOS Safari refuses AudioContext creation in async callbacks.
      const decodeCtx = new AudioContext();

      return new Promise((resolve) => {
        const capturedRecorder = mediaRecorder;
        const capturedChunks = recordedChunks;
        const capturedMime = mimeType;

        capturedRecorder.onstop = async () => {
          cleanup();

          if (capturedChunks.length === 0) {
            decodeCtx.close().catch(() => {});
            resolve(null);
            return;
          }

          try {
            const blob = new Blob(capturedChunks, { type: capturedMime || 'audio/webm' });
            const arrayBuffer = await blob.arrayBuffer();
            const audioBuffer = await decodeCtx.decodeAudioData(arrayBuffer);
            await decodeCtx.close();

            const numChannels = Math.min(2, audioBuffer.numberOfChannels);
            const channelData = [];
            for (let c = 0; c < numChannels; c++) {
              channelData.push(audioBuffer.getChannelData(c));
            }
            resolve(encodeWav(channelData, audioBuffer.sampleRate, numChannels));
          } catch {
            decodeCtx.close().catch(() => {});
            resolve(null);
          }
        };

        if (capturedRecorder.state !== 'inactive') {
          capturedRecorder.stop();
        } else {
          decodeCtx.close().catch(() => {});
          resolve(null);
        }
      });
    },

    cancel() {
      if (!recording && !mediaRecorder) return;
      recording = false;
      cleanup();
    },
  };
}
