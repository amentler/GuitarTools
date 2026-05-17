/**
 * pitchPipelineConfig.js
 *
 * Configuration for the pitch-detection pipeline.
 * Pitch remains note-adaptive via getRecommendedFftSize() from fastNoteMatcher.js.
 */

export const PITCH_SAMPLE_RATE = 48000;
/** hopSize = fftSize (no overlap – pitch detection is latency-tolerant) */
export const PITCH_HOP_DIVISOR = 1;
