// Central configuration for the guitar onset detection pipeline.
// Import from here in ALL contexts: live analysis, offline detection, SFP, sweep scripts.
// hopSize in samples = ONSET_FFT_SIZE / ONSET_HOP_DIVISOR = 1024 ≈ 23ms @ 44.1kHz

export const ONSET_FFT_SIZE = 4096;
export const ONSET_HOP_DIVISOR = 4;

// Live analysis: setInterval period (ms). Approximates ONSET_FFT_SIZE / ONSET_HOP_DIVISOR / 44100 * 1000.
export const ONSET_LIVE_ANALYZE_INTERVAL_MS = 23;

// Cooldown in frames — calibrated for hopSize = ONSET_FFT_SIZE / ONSET_HOP_DIVISOR.
// Effective cooldown = cooldownFrames × hopSize / sampleRate × 1000 ms.
export const ONSET_SWEEP_STANDARD_COOLDOWN_FRAMES = 4;  // ≈ 92ms @ 23ms/frame
export const ONSET_BROADBAND_OR_COOLDOWN_FRAMES = 3;    // ≈ 69ms @ 23ms/frame
export const ONSET_DEFAULT_COOLDOWN_FRAMES = 3;
