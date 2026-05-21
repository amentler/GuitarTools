import { test, expect } from '@playwright/test';

test.describe('Akkordfolgen-Trainer – Start Flow', () => {

  test.beforeEach(async ({ page }) => {
    // Provide a minimal AudioContext mock so the metronome can initialise
    // without real audio hardware.
    await page.addInitScript(() => {
      const analyser = {
        fftSize: 4096,
        frequencyBinCount: 2048,
        connect() {},
        getFloatTimeDomainData(buf) { buf.fill(0); },
        getFloatFrequencyData(buf) { buf.fill(-120); },
      };
      window.AudioContext = class {
        constructor() { this.state = 'running'; this.sampleRate = 44100; }
        createAnalyser() { return analyser; }
        createMediaStreamSource() { return { connect() {} }; }
        resume() { return Promise.resolve(); }
        close()  { return Promise.resolve(); }
      };
      // Mock a microphone stream that succeeds immediately.
      const fakeTrack = { stop() {} };
      const fakeStream = { getTracks: () => [fakeTrack] };
      navigator.mediaDevices = { getUserMedia: () => Promise.resolve(fakeStream) };
    });

    await page.goto('/pages/akkordfolgen-trainer/index.html');
  });

  test('active panel is shown after clicking Start', async ({ page }) => {
    await page.locator('#aft-start-btn').click();

    await expect(page.locator('#aft-active')).not.toHaveClass(/u-hidden/);
    await expect(page.locator('#aft-setup')).toHaveClass(/u-hidden/);
  });

  test('chord progression strip is populated after clicking Start', async ({ page }) => {
    await page.locator('#aft-start-btn').click();

    const progressionDisplay = page.locator('#aft-progression-display');
    await expect(progressionDisplay).not.toBeEmpty();
    await expect(progressionDisplay.locator('.aft-chord-card')).not.toHaveCount(0);
  });

  test('beat dots are rendered after clicking Start', async ({ page }) => {
    await page.locator('#aft-start-btn').click();

    const beatDots = page.locator('#aft-beat-dots .aft-beat-dot');
    await expect(beatDots).toHaveCount(4); // default beatsPerChord = 4
  });

  test('current chord name is shown in the active panel', async ({ page }) => {
    await page.locator('#aft-start-btn').click();

    const chordName = page.locator('#aft-current-chord-name');
    await expect(chordName).not.toHaveText('–');
  });

  test('stop button returns to summary panel', async ({ page }) => {
    await page.locator('#aft-start-btn').click();
    await expect(page.locator('#aft-active')).not.toHaveClass(/u-hidden/);

    await page.locator('#aft-stop-btn').click();

    await expect(page.locator('#aft-active')).toHaveClass(/u-hidden/);
    await expect(page.locator('#aft-summary')).not.toHaveClass(/u-hidden/);
  });
});
