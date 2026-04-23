#!/usr/bin/env node
import { readFileSync, writeFileSync } from 'fs';

const DEFAULTS = {
  fadeMs: 10,
  preRollMs: 50,
  tailSilenceMs: 400,
  targetPeakDbfs: -1,
  maxContentMs: null,
  normalize: false,
  thresholdRatio: 0.03,
  noiseMultiplier: 8,
  channel: 1,
  write: false,
};

function parseArgs(argv) {
  const options = { ...DEFAULTS, files: [] };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--write') options.write = true;
    else if (arg === '--normalize') options.normalize = true;
    else if (arg === '--no-normalize') options.normalize = false;
    else if (arg === '--fade-ms') options.fadeMs = Number(argv[++i]);
    else if (arg === '--pre-roll-ms') options.preRollMs = Number(argv[++i]);
    else if (arg === '--max-content-ms') options.maxContentMs = Number(argv[++i]);
    else if (arg === '--tail-silence-ms') options.tailSilenceMs = Number(argv[++i]);
    else if (arg === '--target-peak-dbfs') options.targetPeakDbfs = Number(argv[++i]);
    else if (arg === '--threshold-ratio') options.thresholdRatio = Number(argv[++i]);
    else if (arg === '--noise-multiplier') options.noiseMultiplier = Number(argv[++i]);
    else if (arg === '--channel') options.channel = Number(argv[++i]);
    else if (arg.startsWith('--')) throw new Error(`Unknown option: ${arg}`);
    else options.files.push(arg);
  }
  if (options.files.length === 0) throw new Error('Usage: clean-wav-fixtures.mjs [--write] <file.wav>...');
  return options;
}

function decodeWav(buffer, selectedChannel = 1) {
  if (buffer.toString('ascii', 0, 4) !== 'RIFF' || buffer.toString('ascii', 8, 12) !== 'WAVE') {
    throw new Error('Not a RIFF/WAVE file');
  }

  let fmt = null;
  let dataOffset = null;
  let dataSize = null;
  let offset = 12;
  while (offset + 8 <= buffer.length) {
    const id = buffer.toString('ascii', offset, offset + 4);
    const size = buffer.readUInt32LE(offset + 4);
    if (id === 'fmt ') {
      fmt = {
        audioFormat: buffer.readUInt16LE(offset + 8),
        channels: buffer.readUInt16LE(offset + 10),
        sampleRate: buffer.readUInt32LE(offset + 12),
        bitsPerSample: buffer.readUInt16LE(offset + 22),
      };
    } else if (id === 'data') {
      dataOffset = offset + 8;
      dataSize = size;
      break;
    }
    offset += 8 + size + (size % 2);
  }

  if (!fmt || dataOffset === null) throw new Error('Missing fmt or data chunk');
  const { audioFormat, channels, sampleRate, bitsPerSample } = fmt;
  const bytesPerSample = bitsPerSample / 8;
  const bytesPerFrame = bytesPerSample * channels;
  if (!Number.isInteger(selectedChannel) || selectedChannel < 1 || selectedChannel > channels) {
    throw new Error(`Selected channel ${selectedChannel} is outside available channel range 1-${channels}`);
  }
  const channelIndex = selectedChannel - 1;
  const availableBytes = Math.min(dataSize, buffer.length - dataOffset);
  const frameCount = Math.floor(availableBytes / bytesPerFrame);
  const samples = new Float32Array(frameCount);

  for (let frame = 0; frame < frameCount; frame++) {
    const pos = dataOffset + frame * bytesPerFrame + channelIndex * bytesPerSample;
    if (audioFormat === 1 && bitsPerSample === 16) samples[frame] = buffer.readInt16LE(pos) / 32768;
    else if (audioFormat === 1 && bitsPerSample === 24) samples[frame] = buffer.readIntLE(pos, 3) / 8388608;
    else if (audioFormat === 1 && bitsPerSample === 32) samples[frame] = buffer.readInt32LE(pos) / 2147483648;
    else if (audioFormat === 3 && bitsPerSample === 32) samples[frame] = buffer.readFloatLE(pos);
    else throw new Error(`Unsupported WAV format=${audioFormat}, bits=${bitsPerSample}`);
  }

  return { samples, sampleRate, channels, bitsPerSample, audioFormat };
}

function encodePcm16MonoWav(samples, sampleRate) {
  const dataSize = samples.length * 2;
  const buffer = Buffer.alloc(44 + dataSize);
  buffer.write('RIFF', 0, 'ascii');
  buffer.writeUInt32LE(36 + dataSize, 4);
  buffer.write('WAVE', 8, 'ascii');
  buffer.write('fmt ', 12, 'ascii');
  buffer.writeUInt32LE(16, 16);
  buffer.writeUInt16LE(1, 20);
  buffer.writeUInt16LE(1, 22);
  buffer.writeUInt32LE(sampleRate, 24);
  buffer.writeUInt32LE(sampleRate * 2, 28);
  buffer.writeUInt16LE(2, 32);
  buffer.writeUInt16LE(16, 34);
  buffer.write('data', 36, 'ascii');
  buffer.writeUInt32LE(dataSize, 40);

  for (let i = 0; i < samples.length; i++) {
    const clipped = Math.max(-1, Math.min(1, samples[i]));
    const value = clipped < 0 ? Math.round(clipped * 32768) : Math.round(clipped * 32767);
    buffer.writeInt16LE(value, 44 + i * 2);
  }
  return buffer;
}

function rms(samples, start, size) {
  let sum = 0;
  const end = Math.min(samples.length, start + size);
  for (let i = start; i < end; i++) sum += samples[i] * samples[i];
  return Math.sqrt(sum / Math.max(1, end - start));
}

function peakOf(samples) {
  let peak = 0;
  for (const sample of samples) peak = Math.max(peak, Math.abs(sample));
  return peak;
}

function trailingQuietSamples(samples, threshold = 0.001) {
  let count = 0;
  for (let i = samples.length - 1; i >= 0; i--) {
    if (Math.abs(samples[i]) > threshold) break;
    count += 1;
  }
  return count;
}

function findTrimStart(samples, sampleRate, options) {
  const frameSize = 1024;
  const hopSize = 256;
  const peak = peakOf(samples);
  const noiseFrames = [];
  const noiseEnd = Math.min(samples.length, Math.floor(sampleRate * 0.2));
  for (let start = 0; start < noiseEnd; start += hopSize) noiseFrames.push(rms(samples, start, frameSize));
  noiseFrames.sort((a, b) => a - b);
  const noiseFloor = noiseFrames[Math.floor(noiseFrames.length * 0.5)] ?? 0;
  const threshold = Math.max(noiseFloor * options.noiseMultiplier, peak * options.thresholdRatio, 0.002);

  for (let start = 0; start < samples.length; start += hopSize) {
    if (rms(samples, start, frameSize) >= threshold) {
      return {
        trimStart: Math.max(0, start - Math.floor(sampleRate * options.preRollMs / 1000)),
        peak,
        noiseFloor,
        threshold,
      };
    }
  }
  return { trimStart: 0, peak, noiseFloor, threshold };
}

function clean(samples, sampleRate, options) {
  const analysis = findTrimStart(samples, sampleRate, options);
  const targetTailSilence = Math.floor(sampleRate * options.tailSilenceMs / 1000);
  const maxContentSamples = options.maxContentMs === null
    ? samples.length - analysis.trimStart
    : Math.floor(sampleRate * options.maxContentMs / 1000);
  const contentEnd = Math.min(samples.length, analysis.trimStart + maxContentSamples);
  const sliced = samples.slice(analysis.trimStart, contentEnd);
  const existingTailSilence = trailingQuietSamples(sliced);
  const tailSilenceToAdd = Math.max(0, targetTailSilence - existingTailSilence);
  const cleaned = new Float32Array(sliced.length + tailSilenceToAdd);
  cleaned.set(sliced, 0);

  const fadeSamples = Math.min(Math.floor(sampleRate * options.fadeMs / 1000), cleaned.length);
  for (let i = 0; i < fadeSamples; i++) cleaned[i] *= i / fadeSamples;

  const outputPeak = peakOf(cleaned);
  let gain = 1;
  if (options.normalize && outputPeak > 0) {
    const targetPeak = 10 ** (options.targetPeakDbfs / 20);
    gain = targetPeak / outputPeak;
    for (let i = 0; i < cleaned.length; i++) cleaned[i] *= gain;
  }

  return {
    samples: cleaned,
    ...analysis,
    existingTailSilence,
    tailSilenceToAdd,
    outputPeak: peakOf(cleaned),
    gain,
  };
}

const options = parseArgs(process.argv.slice(2));
for (const file of options.files) {
  const input = decodeWav(readFileSync(file), options.channel);
  const result = clean(input.samples, input.sampleRate, options);
  const message = [
    file,
    `format=${input.channels}ch/${input.bitsPerSample}bit/${input.sampleRate}Hz`,
    `channel=${options.channel}`,
    `trim=${Math.round(result.trimStart / input.sampleRate * 1000)}ms`,
    `tailAdded=${Math.round(result.tailSilenceToAdd / input.sampleRate * 1000)}ms`,
    `gain=${result.gain.toFixed(3)}`,
    `peak=${result.outputPeak.toFixed(3)}`,
    `duration=${(result.samples.length / input.sampleRate).toFixed(2)}s`,
    options.write ? 'written' : 'dry-run',
  ].join(' | ');
  console.log(message);
  if (options.write) writeFileSync(file, encodePcm16MonoWav(result.samples, input.sampleRate));
}
