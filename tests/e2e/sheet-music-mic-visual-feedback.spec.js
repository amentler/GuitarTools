import { test, expect } from '@playwright/test';

async function installFixtureBackedMicrophone(page, fixtureUrl) {
  await page.addInitScript(url => {
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

    async function ensureFixtureLoaded() {
      if (fixtureState.samples) return fixtureState;
      if (!fixtureState.loadPromise) {
        fixtureState.loadPromise = fetch(url)
          .then(response => {
            if (!response.ok) throw new Error(`Failed to load fixture: ${response.status}`);
            return response.arrayBuffer();
          })
          .then(parsePcmWave)
          .then(({ samples, sampleRate }) => {
            fixtureState.samples = samples;
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
        this.state = 'running';
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
  }, fixtureUrl);
}

test('Noten spielen zeigt nach einem Treffer sichtbar gruen und wechselt zur naechsten Note', async ({ page }) => {
  await installFixtureBackedMicrophone(page, '/tests/fixtures/sequences/open-strings/medium.wav');
  await page.addInitScript(() => {
    window.__GT_SHEET_MUSIC_MIC_BARS__ = [[
      { name: 'E', octave: 2, vfKey: 'e/3', string: 6, fret: 0 },
      { name: 'A', octave: 2, vfKey: 'a/3', string: 5, fret: 0 },
    ]];
  });

  await page.goto('/pages/sheet-music-mic/index.html');

  await expect(page.locator('#sheet-mic-current-note')).toHaveText('E2');

  await page.click('#sheet-mic-start-btn');

  await expect(page.locator('#score-value')).toHaveText('1 / 2', { timeout: 4_000 });
  await expect(page.locator('#sheet-mic-current-note')).toHaveText('A2', { timeout: 4_000 });

  const greenNotes = page.locator('#sheet-mic-score-container svg [fill="#2ecc71"], #sheet-mic-score-container svg [stroke="#2ecc71"]');
  await expect(greenNotes).toHaveCount(1);
});
