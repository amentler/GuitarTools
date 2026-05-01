import { test, expect } from '@playwright/test';

const INJECTED_OPEN_STRING_BARS = [[
  { name: 'E', octave: 2, vfKey: 'e/3', string: 6, fret: 0 },
  { name: 'A', octave: 2, vfKey: 'a/3', string: 5, fret: 0 },
  { name: 'D', octave: 3, vfKey: 'd/4', string: 4, fret: 0 },
  { name: 'G', octave: 3, vfKey: 'g/4', string: 3, fret: 0 },
]];

async function installFixtureBackedMicrophone(page, fixtureUrls) {
  await page.addInitScript(({ urls, startSuspended }) => {
    const fixtureState = {
      samples: null,
      sampleRate: 44100,
      cursor: 0,
      loadPromise: null,
    };

    function readAscii(view, offset, length) {
      let result = '';
      for (let i = 0; i < length; i++) {
        result += String.fromCharCode(view.getUint8(offset + i));
      }
      return result;
    }

    function parsePcmWave(buffer) {
      const view = new DataView(buffer);
      if (readAscii(view, 0, 4) !== 'RIFF' || readAscii(view, 8, 4) !== 'WAVE') {
        throw new Error('Unsupported WAV container');
      }

      let fmtOffset = -1;
      let dataOffset = -1;
      let dataSize = 0;
      let offset = 12;

      while (offset + 8 <= view.byteLength) {
        const chunkId = readAscii(view, offset, 4);
        const chunkSize = view.getUint32(offset + 4, true);
        const chunkDataOffset = offset + 8;

        if (chunkId === 'fmt ') {
          fmtOffset = chunkDataOffset;
        } else if (chunkId === 'data') {
          dataOffset = chunkDataOffset;
          dataSize = chunkSize;
        }

        offset = chunkDataOffset + chunkSize + (chunkSize % 2);
      }

      if (fmtOffset === -1 || dataOffset === -1) {
        throw new Error('WAV is missing fmt or data chunk');
      }

      const audioFormat = view.getUint16(fmtOffset, true);
      const channelCount = view.getUint16(fmtOffset + 2, true);
      const sampleRate = view.getUint32(fmtOffset + 4, true);
      const bitsPerSample = view.getUint16(fmtOffset + 14, true);

      if (audioFormat !== 1 || channelCount !== 1 || bitsPerSample !== 16) {
        throw new Error('Only 16-bit mono PCM WAV fixtures are supported');
      }

      const sampleCount = Math.floor(dataSize / 2);
      const samples = new Float32Array(sampleCount);
      for (let i = 0; i < sampleCount; i++) {
        samples[i] = view.getInt16(dataOffset + i * 2, true) / 32768;
      }

      return { samples, sampleRate };
    }

    function concatSamples(segments, silenceSamples) {
      const totalLength = segments.reduce((sum, samples, index) => {
        const gap = index === segments.length - 1 ? 0 : silenceSamples;
        return sum + samples.length + gap;
      }, 0);

      const combined = new Float32Array(totalLength);
      let offset = 0;
      segments.forEach((samples, index) => {
        combined.set(samples, offset);
        offset += samples.length;
        if (index !== segments.length - 1) {
          offset += silenceSamples;
        }
      });
      return combined;
    }

    async function ensureFixtureLoaded() {
      if (fixtureState.samples) return fixtureState;
      if (!fixtureState.loadPromise) {
        fixtureState.loadPromise = Promise.all(
          urls.map(async url => {
            const response = await fetch(url);
            if (!response.ok) throw new Error(`Failed to load fixture: ${response.status}`);
            return parsePcmWave(await response.arrayBuffer());
          }),
        ).then(fixtures => {
          const sampleRate = fixtures[0]?.sampleRate ?? 44100;
          if (fixtures.some(fixture => fixture.sampleRate !== sampleRate)) {
            throw new Error('All WAV fixtures must use the same sample rate');
          }

          fixtureState.samples = concatSamples(
            fixtures.map(fixture => fixture.samples),
            Math.floor(sampleRate * 0.2),
          );
          fixtureState.sampleRate = sampleRate;
          fixtureState.cursor = 0;
          return fixtureState;
        });
      }
      return fixtureState.loadPromise;
    }

    class FakeAnalyserNode {
      constructor() {
        this._fftSize = 2048;
      }

      get fftSize() {
        return this._fftSize;
      }

      set fftSize(value) {
        this._fftSize = value;
      }

      getFloatTimeDomainData(target) {
        const samples = fixtureState.samples;
        if (!samples) {
          target.fill(0);
          return;
        }

        const start = fixtureState.cursor;
        for (let i = 0; i < target.length; i++) {
          target[i] = samples[start + i] ?? 0;
        }

        const hopSize = Math.max(1, Math.floor(fixtureState.sampleRate * 0.05));
        fixtureState.cursor = Math.min(start + hopSize, samples.length);
      }
    }

    class FakeAudioContext {
      constructor() {
        this.state = startSuspended ? 'suspended' : 'running';
        this.sampleRate = fixtureState.sampleRate;
      }

      createAnalyser() {
        return new FakeAnalyserNode();
      }

      createMediaStreamSource() {
        return {
          connect() {},
        };
      }

      resume() {
        this.state = 'running';
        return Promise.resolve();
      }

      close() {
        return Promise.resolve();
      }
    }

    Object.defineProperty(navigator, 'mediaDevices', {
      configurable: true,
      value: {
        async getUserMedia() {
          fixtureState.cursor = 0;
          await ensureFixtureLoaded();
          return {
            getTracks() {
              return [{ stop() {} }];
            },
          };
        },
      },
    });

    window.AudioContext = FakeAudioContext;
    window.webkitAudioContext = FakeAudioContext;
  }, { urls: fixtureUrls, startSuspended: false });
}

async function installSuspendedFixtureBackedMicrophone(page, fixtureUrls) {
  await page.addInitScript(({ urls, startSuspended }) => {
    const fixtureState = {
      samples: null,
      sampleRate: 44100,
      cursor: 0,
      loadPromise: null,
    };

    function readAscii(view, offset, length) {
      let result = '';
      for (let i = 0; i < length; i++) {
        result += String.fromCharCode(view.getUint8(offset + i));
      }
      return result;
    }

    function parsePcmWave(buffer) {
      const view = new DataView(buffer);
      if (readAscii(view, 0, 4) !== 'RIFF' || readAscii(view, 8, 4) !== 'WAVE') {
        throw new Error('Unsupported WAV container');
      }

      let fmtOffset = -1;
      let dataOffset = -1;
      let dataSize = 0;
      let offset = 12;

      while (offset + 8 <= view.byteLength) {
        const chunkId = readAscii(view, offset, 4);
        const chunkSize = view.getUint32(offset + 4, true);
        const chunkDataOffset = offset + 8;

        if (chunkId === 'fmt ') {
          fmtOffset = chunkDataOffset;
        } else if (chunkId === 'data') {
          dataOffset = chunkDataOffset;
          dataSize = chunkSize;
        }

        offset = chunkDataOffset + chunkSize + (chunkSize % 2);
      }

      if (fmtOffset === -1 || dataOffset === -1) {
        throw new Error('WAV is missing fmt or data chunk');
      }

      const audioFormat = view.getUint16(fmtOffset, true);
      const channelCount = view.getUint16(fmtOffset + 2, true);
      const sampleRate = view.getUint32(fmtOffset + 4, true);
      const bitsPerSample = view.getUint16(fmtOffset + 14, true);

      if (audioFormat !== 1 || channelCount !== 1 || bitsPerSample !== 16) {
        throw new Error('Only 16-bit mono PCM WAV fixtures are supported');
      }

      const sampleCount = Math.floor(dataSize / 2);
      const samples = new Float32Array(sampleCount);
      for (let i = 0; i < sampleCount; i++) {
        samples[i] = view.getInt16(dataOffset + i * 2, true) / 32768;
      }

      return { samples, sampleRate };
    }

    function concatSamples(segments, silenceSamples) {
      const totalLength = segments.reduce((sum, samples, index) => {
        const gap = index === segments.length - 1 ? 0 : silenceSamples;
        return sum + samples.length + gap;
      }, 0);

      const combined = new Float32Array(totalLength);
      let offset = 0;
      segments.forEach((samples, index) => {
        combined.set(samples, offset);
        offset += samples.length;
        if (index !== segments.length - 1) {
          offset += silenceSamples;
        }
      });
      return combined;
    }

    async function ensureFixtureLoaded() {
      if (fixtureState.samples) return fixtureState;
      if (!fixtureState.loadPromise) {
        fixtureState.loadPromise = Promise.all(
          urls.map(async url => {
            const response = await fetch(url);
            if (!response.ok) throw new Error(`Failed to load fixture: ${response.status}`);
            return parsePcmWave(await response.arrayBuffer());
          }),
        ).then(fixtures => {
          const sampleRate = fixtures[0]?.sampleRate ?? 44100;
          if (fixtures.some(fixture => fixture.sampleRate !== sampleRate)) {
            throw new Error('All WAV fixtures must use the same sample rate');
          }

          fixtureState.samples = concatSamples(
            fixtures.map(fixture => fixture.samples),
            Math.floor(sampleRate * 0.2),
          );
          fixtureState.sampleRate = sampleRate;
          fixtureState.cursor = 0;
          return fixtureState;
        });
      }
      return fixtureState.loadPromise;
    }

    class FakeAnalyserNode {
      constructor() {
        this._fftSize = 2048;
      }

      get fftSize() {
        return this._fftSize;
      }

      set fftSize(value) {
        this._fftSize = value;
      }

      getFloatTimeDomainData(target) {
        const samples = fixtureState.samples;
        if (!samples) {
          target.fill(0);
          return;
        }

        const start = fixtureState.cursor;
        for (let i = 0; i < target.length; i++) {
          target[i] = samples[start + i] ?? 0;
        }

        const hopSize = Math.max(1, Math.floor(fixtureState.sampleRate * 0.05));
        fixtureState.cursor = Math.min(start + hopSize, samples.length);
      }
    }

    class FakeAudioContext {
      constructor() {
        this.state = startSuspended ? 'suspended' : 'running';
        this.sampleRate = fixtureState.sampleRate;
      }

      createAnalyser() {
        return new FakeAnalyserNode();
      }

      createMediaStreamSource() {
        return {
          connect() {},
        };
      }

      resume() {
        this.state = 'running';
        return Promise.resolve();
      }

      close() {
        return Promise.resolve();
      }
    }

    Object.defineProperty(navigator, 'mediaDevices', {
      configurable: true,
      value: {
        async getUserMedia() {
          fixtureState.cursor = 0;
          await ensureFixtureLoaded();
          return {
            getTracks() {
              return [{ stop() {} }];
            },
          };
        },
      },
    });

    window.AudioContext = FakeAudioContext;
    window.webkitAudioContext = FakeAudioContext;
  }, { urls: fixtureUrls, startSuspended: true });
}

async function countRenderedScoreState(page) {
  return page.evaluate(() => {
    const svg = document.querySelector('#sheet-mic-score-container svg');
    if (!svg) return null;
    return {
      renderedNotes: svg.querySelectorAll('g.vf-stavenote').length,
      orangeFill: svg.querySelectorAll('[fill="#ff6b35"]').length,
      orangeStroke: svg.querySelectorAll('[stroke="#ff6b35"]').length,
      greenFill: svg.querySelectorAll('[fill="#2ecc71"]').length,
      greenStroke: svg.querySelectorAll('[stroke="#2ecc71"]').length,
    };
  });
}

test('Noten spielen erzeugt ohne Test-Hook einen gueltigen Startzustand', async ({ page }) => {
  await page.goto('/pages/sheet-music-mic/index.html');

  await expect(page.locator('#sheet-mic-score-container svg')).toBeVisible();
  await expect(page.locator('#score-value')).toHaveText('0 / 16');
  await expect(page.locator('#sheet-mic-current-note')).not.toHaveText('–');

  const scoreState = await countRenderedScoreState(page);
  expect(scoreState).toEqual({
    renderedNotes: 16,
    orangeFill: 1,
    orangeStroke: 1,
    greenFill: 0,
    greenStroke: 0,
  });
});

test('Noten spielen rendert injizierte Zielnoten konsistent direkt nach dem Laden', async ({ page }) => {
  await page.addInitScript(bars => {
    window.__GT_SHEET_MUSIC_MIC_BARS__ = bars;
  }, INJECTED_OPEN_STRING_BARS);

  await page.goto('/pages/sheet-music-mic/index.html');

  await expect(page.locator('#sheet-mic-score-container svg')).toBeVisible();
  await expect(page.locator('#score-value')).toHaveText('0 / 4');
  await expect(page.locator('#sheet-mic-current-note')).toHaveText('E2');

  const scoreState = await countRenderedScoreState(page);
  expect(scoreState).toEqual({
    renderedNotes: 4,
    orangeFill: 1,
    orangeStroke: 1,
    greenFill: 0,
    greenStroke: 0,
  });
});

test('Noten spielen exponiert Debug-Snapshot bei aktiviertem Audio-Debug', async ({ page }) => {
  await page.addInitScript(bars => {
    window.__GT_SHEET_MUSIC_MIC_BARS__ = bars;
  }, INJECTED_OPEN_STRING_BARS);
  await page.addInitScript(() => {
    window.localStorage.setItem('global_debug_enabled', 'true');
  });

  await page.goto('/pages/sheet-music-mic/index.html');

  await expect(page.locator('#sheet-mic-debug')).toBeVisible();
  await expect(page.locator('#sheet-mic-debug-output')).toContainText('"currentTarget": "E2"');

  const debugSnapshot = await page.evaluate(() => window.__GT_SHEET_MUSIC_MIC_DEBUG__);
  expect(debugSnapshot).toMatchObject({
    mode: 'easy',
    isListening: true,
    currentTarget: 'E2',
    score: {
      correct: 0,
      total: 4,
    },
  });
  expect(Array.isArray(debugSnapshot.events)).toBe(true);
  expect(debugSnapshot.bars[0]).toHaveLength(4);
});

test('Noten spielen setzt die FFT auch bei initial suspended AudioContext korrekt', async ({ page }) => {
  await installSuspendedFixtureBackedMicrophone(page, [
    '/tests/fixtures/audio/E2/e2.wav',
    '/tests/fixtures/audio/A2/a2k.wav',
    '/tests/fixtures/audio/D3/d.wav',
    '/tests/fixtures/audio/G3/g.wav',
  ]);
  await page.addInitScript(bars => {
    window.__GT_SHEET_MUSIC_MIC_BARS__ = bars;
  }, INJECTED_OPEN_STRING_BARS);
  await page.addInitScript(() => {
    window.localStorage.setItem('global_debug_enabled', 'true');
  });

  await page.goto('/pages/sheet-music-mic/index.html');

  await page.waitForFunction(() => {
    const debugSnapshot = window.__GT_SHEET_MUSIC_MIC_DEBUG__;
    return debugSnapshot?.isListening === true
      && debugSnapshot?.sampleRate === 44100
      && debugSnapshot?.analyserFftSize === 4096;
  }, null, { timeout: 4_000 });

  await expect(page.locator('#score-value')).toHaveText('4 / 4', { timeout: 20_000 });
});

test('Noten spielen markiert vier nacheinander gespielte WAV-Noten jeweils gruen', async ({ page }) => {
  await installFixtureBackedMicrophone(page, [
    '/tests/fixtures/audio/E2/e2.wav',
    '/tests/fixtures/audio/A2/a2k.wav',
    '/tests/fixtures/audio/D3/d.wav',
    '/tests/fixtures/audio/G3/g.wav',
  ]);
  await page.addInitScript(bars => {
    window.__GT_SHEET_MUSIC_MIC_BARS__ = bars;
  }, INJECTED_OPEN_STRING_BARS);

  await page.goto('/pages/sheet-music-mic/index.html');

  await expect(page.locator('#sheet-mic-current-note')).toHaveText('E2');

  await expect(page.locator('#score-value')).toHaveText('1 / 4', { timeout: 4_000 });
  await expect(page.locator('#sheet-mic-current-note')).toHaveText('A2', { timeout: 4_000 });

  const greenNotes = page.locator('#sheet-mic-score-container svg [fill="#2ecc71"], #sheet-mic-score-container svg [stroke="#2ecc71"]');
  await expect(greenNotes).toHaveCount(1);

  await expect(page.locator('#score-value')).toHaveText('2 / 4', { timeout: 4_000 });
  await expect(page.locator('#sheet-mic-current-note')).toHaveText('D3', { timeout: 4_000 });
  await expect(greenNotes).toHaveCount(2);

  await expect(page.locator('#score-value')).toHaveText('3 / 4', { timeout: 4_000 });
  await expect(page.locator('#sheet-mic-current-note')).toHaveText('G3', { timeout: 4_000 });
  await expect(greenNotes).toHaveCount(3);

  await expect(page.locator('#score-value')).toHaveText('4 / 4', { timeout: 8_000 });
  await expect(page.locator('#sheet-mic-current-note')).toHaveText('✓', { timeout: 4_000 });
  await expect(greenNotes).toHaveCount(4);
  await expect(page.locator('#sheet-mic-feedback')).toContainText('Alle Noten gespielt!', { timeout: 4_000 });
});
