import { chromium } from '@playwright/test';
import { mkdirSync, writeFileSync } from 'fs';
import http from 'http';
import { dirname, join } from 'path';
import { discoverNoteAudioFixtures } from '../tests/helpers/noteAudioFixtures.js';
import { readWavFile } from '../tests/helpers/wavDecoder.js';

// Generates frozen Chromium AnalyserNode captures for all single-note WAVs in
// tests/fixtures/audio. These goldens feed the single-note onset section of
// `npm run notefingerprint`; update them whenever the note analyser capture
// path or source note WAV fixtures change.

const OUT_DIR = join(process.cwd(), 'tests/fixtures/analyser-goldens/notes');
const FFT_SIZE = 4096;
const HOP_MS = 50;
const MAX_CAPTURE_MS = 3500;
const EXTRA_CAPTURE_MS = 1200;

function round2(value) {
  return Number.isFinite(value) ? Math.round(value * 100) / 100 : value;
}

function round6(value) {
  return Number.isFinite(value) ? Math.round(value * 1_000_000) / 1_000_000 : value;
}

function startServer() {
  const server = http.createServer((_req, res) => {
    res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
    res.end('<!doctype html><meta charset="utf-8"><title>analyser capture</title>');
  });
  return new Promise(resolve => {
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      resolve({
        origin: `http://127.0.0.1:${address.port}`,
        close: () => new Promise(done => server.close(done)),
      });
    });
  });
}

async function captureGolden(fixture, origin) {
  const { samples, sampleRate } = readWavFile(fixture.path);
  const durationMs = Math.ceil((samples.length / sampleRate) * 1000);
  const captureMs = Math.min(MAX_CAPTURE_MS, durationMs + EXTRA_CAPTURE_MS);

  const browser = await chromium.launch({
    headless: true,
    args: [
      '--use-fake-ui-for-media-stream',
      '--use-fake-device-for-media-stream',
      `--use-file-for-fake-audio-capture=${fixture.path}`,
    ],
  });

  try {
    const context = await browser.newContext({ permissions: ['microphone'] });
    const page = await context.newPage();
    await page.goto(origin);
    const capture = await page.evaluate(async ({ fftSize, hopMs, captureMs }) => {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const audioCtx = new AudioContext();
      const source = audioCtx.createMediaStreamSource(stream);
      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = fftSize;
      source.connect(analyser);

      const timeDomain = new Float32Array(analyser.fftSize);
      const frequency = new Float32Array(analyser.frequencyBinCount);
      const frames = [];
      const start = performance.now();
      const frameCount = Math.ceil(captureMs / hopMs);

      for (let index = 0; index < frameCount; index++) {
        await new Promise(resolve => setTimeout(resolve, index === 0 ? 0 : hopMs));
        analyser.getFloatTimeDomainData(timeDomain);
        analyser.getFloatFrequencyData(frequency);

        let sumSquares = 0;
        for (const sample of timeDomain) sumSquares += sample * sample;

        frames.push({
          index,
          timeMs: Math.round(performance.now() - start),
          rms: Math.sqrt(sumSquares / Math.max(1, timeDomain.length)),
          frequencyDb: Array.from(frequency),
        });
      }

      stream.getTracks().forEach(track => track.stop());
      await audioCtx.close();

      return {
        actualSampleRate: audioCtx.sampleRate,
        fftSize: analyser.fftSize,
        frequencyBinCount: analyser.frequencyBinCount,
        frames,
      };
    }, { fftSize: FFT_SIZE, hopMs: HOP_MS, captureMs });

    return {
      schemaVersion: 1,
      source: fixture.file,
      pitch: fixture.pitch,
      browser: 'chromium',
      capture: {
        hopMs: HOP_MS,
        requestedCaptureMs: captureMs,
        sourceDurationMs: durationMs,
        sourceSampleRate: sampleRate,
        sampleRate: capture.actualSampleRate,
        fftSize: capture.fftSize,
        frequencyBinCount: capture.frequencyBinCount,
      },
      frames: capture.frames.map(frame => ({
        index: frame.index,
        timeMs: frame.timeMs,
        rms: round6(frame.rms),
        frequencyDb: frame.frequencyDb.map(round2),
      })),
    };
  } finally {
    await browser.close();
  }
}

const fixtures = discoverNoteAudioFixtures();
const server = await startServer();

try {
  const manifest = {
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    generator: 'scripts/generate-note-analyser-goldens.mjs',
    fixtureCount: fixtures.length,
    fixtures: [],
  };

  for (const [index, fixture] of fixtures.entries()) {
    const outPath = join(OUT_DIR, fixture.goldenFile);
    mkdirSync(dirname(outPath), { recursive: true });
    console.log(`[${index + 1}/${fixtures.length}] ${fixture.file} -> ${fixture.goldenFile}`);
    const golden = await captureGolden(fixture, server.origin);
    writeFileSync(outPath, `${JSON.stringify(golden)}\n`);
    manifest.fixtures.push({
      pitch: fixture.pitch,
      file: fixture.file,
      goldenFile: fixture.goldenFile,
      frames: golden.frames.length,
    });
  }

  writeFileSync(join(OUT_DIR, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`);
} finally {
  await server.close();
}
