// Central configuration for the guitar onset detection pipeline.
// Import from here in ALL contexts: live analysis, offline detection, SFP, sweep scripts.
// hopSize in samples = ONSET_FFT_SIZE / ONSET_HOP_DIVISOR = 1024 ≈ 21ms @ 48kHz

// Target sample rate: AudioContext runs at 48000 Hz on all tested devices (desktop + mobile,
// Chrome + Firefox). decodeAudioData resamples automatically. SFP scripts must resample to
// this rate before onset detection so timestamps match browser results.
export const BROWSER_SAMPLE_RATE = 48000;

export const ONSET_FFT_SIZE = 4096;
export const ONSET_HOP_DIVISOR = 4;

// Live analysis: setInterval period (ms). Approximates ONSET_FFT_SIZE / ONSET_HOP_DIVISOR / 48000 * 1000.
export const ONSET_LIVE_ANALYZE_INTERVAL_MS = 21;

// Cooldown in frames — calibrated for hopSize = ONSET_FFT_SIZE / ONSET_HOP_DIVISOR.
// Effective cooldown = cooldownFrames × hopSize / sampleRate × 1000 ms.
export const ONSET_SWEEP_STANDARD_COOLDOWN_FRAMES = 4;  // ≈ 85ms @ 21ms/frame
export const ONSET_BROADBAND_OR_COOLDOWN_FRAMES = 3;    // ≈ 64ms @ 21ms/frame
export const ONSET_DEFAULT_COOLDOWN_FRAMES = 3;
