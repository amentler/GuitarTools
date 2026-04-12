import { describe, it, expect } from 'vitest';
import { 
  detectPitch, noteToFrequency, analyzeInputLevel, 
  buildAdaptiveThreshold, NOISE_FLOOR_SCALE_FACTOR 
} from '../../js/tools/guitarTuner/tunerLogic.js';

describe('E4 Sensitivity Verification', () => {
  function synth(freq, sampleRate, samples, amp) {
    const buf = new Float32Array(samples);
    for (let i = 0; i < samples; i++) {
      buf[i] = amp * Math.sin(2 * Math.PI * freq * i / sampleRate);
    }
    return buf;
  }

  it('verifies improved sensitivity with the new scale factor', () => {
    const sampleRate = 44100;
    const e4Freq = noteToFrequency('E', 4);
    const bufferSize = 8192;
    const noiseRms = 0.02;
    
    // This now uses the updated NOISE_FLOOR_SCALE_FACTOR (2.5)
    const threshold = buildAdaptiveThreshold(noiseRms);
    
    console.log(`Current Scale Factor: ${NOISE_FLOOR_SCALE_FACTOR}`);
    console.log(`Current Threshold: ${threshold.toFixed(4)}`);
    
    let currentAmp = 0.3;
    const decayFactor = 0.85;
    let validFrames = 0;
    
    for (let frame = 0; frame < 30; frame++) {
      const buffer = synth(e4Freq, sampleRate, bufferSize, currentAmp);
      const level = analyzeInputLevel(buffer, threshold);
      if (level.isValid) {
        validFrames++;
      }
      currentAmp *= decayFactor;
    }
    
    console.log(`Total Valid Frames: ${validFrames}`);
    // With 4.0 we had 6 frames. With 2.5 we expect 9 or more.
    expect(validFrames).toBeGreaterThanOrEqual(9);
    expect(NOISE_FLOOR_SCALE_FACTOR).toBe(2.5);
  });
});
