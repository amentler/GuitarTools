import { createServer } from 'http';
import { writeFileSync, createReadStream, existsSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { chromium } from '@playwright/test';
import { CHORD_HPCP_FIXTURE_CASES } from '../tests/helpers/chordHpcpFixtureCatalog.js';
import {
  buildFrequencyFrames,
} from '../tests/helpers/chordHpcpExtraction.js';
import { extractBassSupportMapFromSamples } from '../tests/helpers/chordBassExtraction.js';
import { readWavFile } from '../tests/helpers/wavDecoder.js';
import {
  detectEssentiaPeaks,
  normalizeFrequencyDataToPeak,
  normalizePeakMagnitudes,
} from '../js/games/chordExerciseEssentia/essentiaChordDetection.js';
import { averageHpcps, buildChordTemplates } from '../js/games/chordExerciseEssentia/essentiaChordLogic.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '..');
const fixtureDir = path.join(repoRoot, 'tests/fixtures/chords');
const outputFile = path.join(repoRoot, 'tests/fixtures/chord-hpcp/frozen-essentia-fingerprint-fixtures.json');
const essentiaLibDir = path.join(repoRoot, 'js/lib/essentia');
const HPCP_REFERENCE_HZ = 261.626;

function normalizeNumber(value) {
  return Number(value.toFixed(6));
}

function normalizeVector(vector) {
  return Array.from(vector, normalizeNumber);
}

function deepNormalize(value) {
  if (typeof value === 'number') return normalizeNumber(value);
  if (Array.isArray(value)) return value.map(deepNormalize);
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(Object.entries(value).map(([key, nested]) => [key, deepNormalize(nested)]));
}

function serveFile(filePath, res) {
  const ext = path.extname(filePath);
  const contentType = {
    '.js': 'application/javascript; charset=utf-8',
    '.wasm': 'application/wasm',
    '.json': 'application/json; charset=utf-8',
    '.html': 'text/html; charset=utf-8',
  }[ext] ?? 'application/octet-stream';
  res.writeHead(200, { 'Content-Type': contentType });
  createReadStream(filePath).pipe(res);
}

function createStaticServer(rootDir) {
  const server = createServer((req, res) => {
    const urlPath = new URL(req.url ?? '/', 'http://127.0.0.1').pathname;
    if (urlPath === '/') {
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end('<!doctype html><html><body>essentia</body></html>');
      return;
    }

    const relativePath = decodeURIComponent(urlPath).replace(/^\/+/, '');
    const resolvedPath = path.normalize(path.join(rootDir, relativePath));

    if (!resolvedPath.startsWith(rootDir) || !existsSync(resolvedPath)) {
      res.writeHead(404);
      res.end('Not found');
      return;
    }

    serveFile(resolvedPath, res);
  });

  return new Promise(resolve => {
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      resolve({
        server,
        baseUrl: `http://127.0.0.1:${address.port}`,
      });
    });
  });
}

async function createEssentiaPage() {
  const { server, baseUrl } = await createStaticServer(repoRoot);
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  await page.goto(baseUrl);
  await page.addScriptTag({ url: `${baseUrl}/js/lib/essentia/essentia-wasm.web.js` });
  await page.evaluate(async ({ baseUrl: evaluateBaseUrl, referenceHz }) => {
    const wasmModule = await window.EssentiaWASM({
      locateFile: filename => `${evaluateBaseUrl}/js/lib/essentia/${filename}`,
    });

    const essentia = new wasmModule.EssentiaJS(wasmModule);
    window.__essentiaFingerprintCompute = ({ peakFrames, sampleRate }) => {
      return peakFrames.map(({ peakFreqs, peakMags }) => {
        if (!peakFreqs.length) return new Array(12).fill(0);

        const freqVec = wasmModule.arrayToVector(new Float32Array(peakFreqs));
        const magVec = wasmModule.arrayToVector(new Float32Array(peakMags));
        const { hpcp } = essentia.HPCP(
          freqVec,
          magVec,
          true,
          500,
          0,
          5000,
          false,
          40,
          false,
          'unitMax',
          referenceHz,
          sampleRate,
          12,
          'squaredCosine',
          1,
        );

        const frame = Array.from(wasmModule.vectorToArray(hpcp));
        freqVec.delete();
        magVec.delete();
        hpcp.delete();
        return frame;
      });
    };
  }, { baseUrl, referenceHz: HPCP_REFERENCE_HZ });

  return {
    page,
    async close() {
      await browser.close();
      await new Promise(resolve => server.close(resolve));
    },
  };
}

function buildPeakFrames(samples, sampleRate) {
  return buildFrequencyFrames(samples, undefined, undefined, sampleRate).map(frame => {
    const normalizedFrame = normalizeFrequencyDataToPeak(frame);
    const { peakFreqs, peakMags } = detectEssentiaPeaks(normalizedFrame, sampleRate);
    return {
      peakFreqs,
      peakMags: normalizePeakMagnitudes(peakMags),
    };
  });
}

async function main() {
  const chordNames = Object.keys(buildChordTemplates());
  const essentiaRuntime = await createEssentiaPage();

  try {
    const preparedFixtures = [];

    for (const fixture of CHORD_HPCP_FIXTURE_CASES) {
      const wavPath = path.join(fixtureDir, fixture.wavFile);
      const { samples, sampleRate } = readWavFile(wavPath);
      const peakFrames = buildPeakFrames(samples, sampleRate);
      const wasmHpcpFrames = await essentiaRuntime.page.evaluate(
        ({ peakFrames: evaluatePeakFrames, sampleRate: evaluateSampleRate }) =>
          window.__essentiaFingerprintCompute({ peakFrames: evaluatePeakFrames, sampleRate: evaluateSampleRate }),
        { peakFrames, sampleRate },
      );
      const wasmHpcpFloatFrames = wasmHpcpFrames.map(frame => Float32Array.from(frame));
      const bassSupportByChord = fixture.wavFile.includes('/')
        ? extractBassSupportMapFromSamples(samples, sampleRate, chordNames)
        : null;

      preparedFixtures.push({
        chordName: fixture.chordName,
        wavFile: fixture.wavFile,
        expected: fixture.expected,
        sampleRate,
        wasmHpcpFrames: wasmHpcpFrames.map(normalizeVector),
        wasmAverageHpcp: normalizeVector(averageHpcps(wasmHpcpFloatFrames)),
        bassSupportByChord: deepNormalize(bassSupportByChord),
      });
    }

    writeFileSync(outputFile, `${JSON.stringify(preparedFixtures, null, 2)}\n`, 'utf8');
    console.log(`Essentia fingerprint fixtures generated: ${preparedFixtures.length}`);
  } finally {
    await essentiaRuntime.close();
  }
}

await main();
