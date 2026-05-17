/**
 * Central configuration for the guitar onset detection pipeline.
 *
 * Import from here in all contexts: live analysis, offline detection, SFP,
 * sweep scripts, and XGBoost feature extraction. The tuner pipeline is
 * isolated and does not use this config.
 */

export const BROWSER_SAMPLE_RATE = 48000;

export const ONSET_FFT_SIZE = 1024;
export const ONSET_HOP_DIVISOR = 4;
export const ONSET_HOP_SIZE = Math.round(ONSET_FFT_SIZE / ONSET_HOP_DIVISOR);

// Live analysis period in ms. Matches one onset hop at 48 kHz.
export const ONSET_LIVE_ANALYZE_INTERVAL_MS = 5;

// Cooldown in frames, calibrated for hopSize = ONSET_FFT_SIZE / ONSET_HOP_DIVISOR.
export const ONSET_SWEEP_STANDARD_COOLDOWN_FRAMES = 19;
export const ONSET_BROADBAND_OR_COOLDOWN_FRAMES = 12;
export const ONSET_DEFAULT_COOLDOWN_FRAMES = 12;
