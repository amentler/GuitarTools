// WAV file decoder – pure Node.js, no external dependencies.
// Supports: 16-bit & 32-bit PCM (format 1), 32-bit float (format 3).
// Multi-channel: only the left (first) channel is returned.

import { readFileSync } from 'fs';

/**
 * Decodes a WAV Buffer into a mono Float32Array.
 * @param {Buffer} buf  Raw WAV file contents.
 * @returns {{ samples: Float32Array, sampleRate: number }}
 */
export function decodeWav(buf) {
  if (buf.length < 44) throw new Error('Buffer zu klein für eine gültige WAV-Datei');
  if (buf.toString('ascii', 0, 4) !== 'RIFF') throw new Error('Kein RIFF-Header gefunden');
  if (buf.toString('ascii', 8, 12) !== 'WAVE') throw new Error('Kein WAVE-Format erkannt');

  let audioFormat, numChannels, sampleRate, bitsPerSample;
  let dataOffset, dataSize;

  let offset = 12;
  while (offset + 8 <= buf.length) {
    const chunkId = buf.toString('ascii', offset, offset + 4);
    const chunkSize = buf.readUInt32LE(offset + 4);

    if (chunkId === 'fmt ') {
      audioFormat = buf.readUInt16LE(offset + 8);
      numChannels = buf.readUInt16LE(offset + 10);
      sampleRate = buf.readUInt32LE(offset + 12);
      bitsPerSample = buf.readUInt16LE(offset + 22);
    } else if (chunkId === 'data') {
      dataOffset = offset + 8;
      dataSize = chunkSize;
      break;
    }

    offset += 8 + chunkSize;
    if (chunkSize % 2 !== 0) offset++; // word-align
  }

  if (dataOffset === undefined) throw new Error('Kein data-Chunk in WAV-Datei gefunden');
  if (audioFormat !== 1 && audioFormat !== 3) {
    throw new Error(
      `Nicht unterstütztes WAV-Format: ${audioFormat}. Nur PCM (1) und Float (3) werden unterstützt.`,
    );
  }

  const bytesPerSample = bitsPerSample / 8;
  const bytesPerFrame = bytesPerSample * numChannels;
  const numFrames = Math.floor(dataSize / bytesPerFrame);
  const samples = new Float32Array(numFrames);

  for (let i = 0; i < numFrames; i++) {
    const pos = dataOffset + i * bytesPerFrame; // left channel only
    if (audioFormat === 1) {
      if (bitsPerSample === 16) {
        samples[i] = buf.readInt16LE(pos) / 32768.0;
      } else if (bitsPerSample === 32) {
        samples[i] = buf.readInt32LE(pos) / 2147483648.0;
      } else if (bitsPerSample === 8) {
        samples[i] = (buf.readUInt8(pos) - 128) / 128.0;
      }
    } else if (audioFormat === 3 && bitsPerSample === 32) {
      samples[i] = buf.readFloatLE(pos);
    }
  }

  return { samples, sampleRate };
}

/**
 * Reads a WAV file from disk and decodes it.
 * @param {string} filePath  Absolute or relative path to the .wav file.
 * @returns {{ samples: Float32Array, sampleRate: number }}
 */
export function readWavFile(filePath) {
  const buf = readFileSync(filePath);
  return decodeWav(buf);
}
