import { test, expect } from '@playwright/test';

test('Noten lesen im Aktivmodus mit Metronom zieht die aktuelle Note zeitgesteuert weiter', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('sheetMusic_active', 'true');
    localStorage.setItem('sheetMusic_bpm', '120');
    window.__GT_SHEET_MUSIC_READING_BARS__ = [[
      { name: 'E', octave: 2, vfKey: 'e/3', string: 6, fret: 0 },
      { name: 'A', octave: 2, vfKey: 'a/3', string: 5, fret: 0 },
      { name: 'D', octave: 3, vfKey: 'd/4', string: 4, fret: 0 },
      { name: 'G', octave: 3, vfKey: 'g/4', string: 3, fret: 0 },
    ]];

    class SilentAnalyserNode {
      constructor() {
        this.fftSize = 4096;
      }

      getFloatTimeDomainData(target) {
        target.fill(0);
      }
    }

    class SilentAudioContext {
      constructor() {
        this.state = 'running';
        this.sampleRate = 44100;
        this.destination = {};
        this._startedAt = Date.now();
      }

      get currentTime() {
        return (Date.now() - this._startedAt) / 1000;
      }

      createAnalyser() {
        return new SilentAnalyserNode();
      }

      createMediaStreamSource() {
        return { connect() {} };
      }

      createOscillator() {
        return {
          frequency: { value: 0 },
          connect() {},
          start() {},
          stop() {},
        };
      }

      createGain() {
        return {
          gain: {
            value: 1,
            exponentialRampToValueAtTime() {},
          },
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
          return {
            getTracks() {
              return [{ stop() {} }];
            },
          };
        },
      },
    });

    window.AudioContext = SilentAudioContext;
    window.webkitAudioContext = SilentAudioContext;
  });

  await page.goto('/pages/sheet-music-reading/index.html');

  await expect(page.locator('#sheet-music-current-note')).toHaveText('E2');

  await page.locator('#sheet-music-bpm-slider').fill('120');
  await page.locator('#btn-sheet-play').click();

  await expect(page.locator('#sheet-music-current-note')).toHaveText('A2', { timeout: 5_000 });
  await expect(page.locator('#sheet-music-current-note')).toHaveText('D3', { timeout: 5_000 });
  await expect(page.locator('#sheet-music-current-note')).toHaveText('G3', { timeout: 5_000 });
  await expect(page.locator('#sheet-music-current-note')).toHaveText('✓', { timeout: 5_000 });
  await expect(page.locator('#sheet-music-feedback')).toContainText('Durchlauf beendet.', { timeout: 5_000 });

  const missedNotes = page.locator('#score-container svg [fill="#e74c3c"], #score-container svg [stroke="#e74c3c"]');
  await expect(missedNotes).toHaveCount(4);
});
