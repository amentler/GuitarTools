/**
 * onsetPipelineConfig.js
 *
 * Shared configuration for the onset-detection pipeline.
 * All onset detectors (offline strategy-based, XGBoost) use these values.
 * The Tuner pipeline is fully isolated and does NOT use this config.
 */

export const BROWSER_SAMPLE_RATE = 48000;

export const ONSET_FFT_SIZE = 1024;
export const ONSET_HOP_DIVISOR = 4;
/** hopSize = fftSize / 4 → one hop ≈ 5.3 ms @ 48 kHz */
export const ONSET_HOP_SIZE = Math.round(ONSET_FFT_SIZE / ONSET_HOP_DIVISOR); // 256

/** Live-onset analysis interval in ms (one hop ≈ 5 ms) */
export const ONSET_LIVE_ANALYZE_INTERVAL_MS = 5;

/**
 * Cooldown frame counts recalibrated to keep the same effective duration in ms
 * after switching from fftSize=4096/hopSize=4096 to fftSize=1024/hopSize=256.
 *
 * Old: 1 frame ≈ 85.3 ms  →  New: 1 frame ≈ 5.3 ms
 *   SWEEP_STANDARD  4 frames × 85 ms ≈ 340 ms → 19 × 5.3 ms ≈ 100 ms  (intentionally tighter)
 *   BROADBAND_OR    3 frames × 85 ms ≈ 255 ms → 12 × 5.3 ms ≈ 64 ms
 *   DEFAULT         3 frames × 85 ms ≈ 255 ms → 12 × 5.3 ms ≈ 64 ms
 */
export const ONSET_SWEEP_STANDARD_COOLDOWN_FRAMES = 19; // ca. 100 ms
export const ONSET_BROADBAND_OR_COOLDOWN_FRAMES = 12;   // ca. 64 ms
export const ONSET_DEFAULT_COOLDOWN_FRAMES = 12;        // ca. 64 ms
