export const GUITAR_MIN_RMS = 0.008;
export const GUITAR_MAX_CLIPPING_RATIO = 0.02;

export function analyzeInputLevel(buffer, minRms = GUITAR_MIN_RMS) {
  let sumSquares = 0;
  let clipping = 0;
  for (let i = 0; i < buffer.length; i++) {
    const v = buffer[i];
    sumSquares += v * v;
    if (Math.abs(v) >= 0.98) clipping++;
  }
  const rms = Math.sqrt(sumSquares / buffer.length);
  const clippingRatio = clipping / buffer.length;
  return {
    rms,
    clippingRatio,
    isValid: rms >= minRms && clippingRatio <= GUITAR_MAX_CLIPPING_RATIO,
  };
}
