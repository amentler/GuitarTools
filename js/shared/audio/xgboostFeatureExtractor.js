/**
 * xgboostFeatureExtractor.js
 *
 * Feature extraction for XGBoost-based onset detection.
 *
 * Exports:
 *   extractXGBoostFrameFeatures(frame, frequencyData, onsetResult, sampleRate, fftSize, logCompression, history)
 *   buildContextFeatures(baseFeatures, history, featureOrder)
 *   computeMFCC(samples, sampleRate, fftSize, numCoefficients)
 *   computeLogBandFlux(magnitudes, prevMagnitudes, lowHz, highHz, sampleRate, fftSize, logCompression)
 */

// ── FFT (reused from dbSpectrum pattern) ──────────────────────────────────────

function fftInPlace(re, im) {
  const n = re.length;
  let j = 0;
  for (let i = 1; i < n; i++) {
    let bit = n >> 1;
    for (; j & bit; bit >>= 1) j ^= bit;
    j ^= bit;
    if (i < j) {
      [re[i], re[j]] = [re[j], re[i]];
      [im[i], im[j]] = [im[j], im[i]];
    }
  }
  for (let len = 2; len <= n; len <<= 1) {
    const angle = -2 * Math.PI / len;
    const stepRe = Math.cos(angle);
    const stepIm = Math.sin(angle);
    for (let i = 0; i < n; i += len) {
      let curRe = 1;
      let curIm = 0;
      const half = len >> 1;
      for (let k = 0; k < half; k++) {
        const uRe = re[i + k];
        const uIm = im[i + k];
        const vRe = re[i + k + half] * curRe - im[i + k + half] * curIm;
        const vIm = re[i + k + half] * curIm + im[i + k + half] * curRe;
        re[i + k] = uRe + vRe;
        im[i + k] = uIm + vIm;
        re[i + k + half] = uRe - vRe;
        im[i + k + half] = uIm - vIm;
        const nextRe = curRe * stepRe - curIm * stepIm;
        curIm = curRe * stepIm + curIm * stepRe;
        curRe = nextRe;
      }
    }
  }
}

/**
 * Computes linear magnitude spectrum from samples using a Hann window + FFT.
 * Returns Float32Array of length fftSize/2 (positive frequencies).
 * @param {Float32Array} samples
 * @param {number} fftSize
 * @returns {Float32Array}
 */
function computeLinearMagnitudes(samples, fftSize) {
  const re = new Float64Array(fftSize);
  const im = new Float64Array(fftSize);
  const n = Math.min(samples.length, fftSize);
  for (let i = 0; i < n; i++) {
    const win = 0.5 * (1 - Math.cos((2 * Math.PI * i) / (fftSize - 1)));
    re[i] = samples[i] * win;
  }
  fftInPlace(re, im);
  const bins = fftSize >> 1;
  const norm = fftSize >> 1;
  const mag = new Float32Array(bins);
  for (let i = 0; i < bins; i++) {
    mag[i] = Math.hypot(re[i], im[i]) / norm;
  }
  return mag;
}

// ── MFCC ──────────────────────────────────────────────────────────────────────

/**
 * Converts Hz to Mel scale.
 * @param {number} hz
 * @returns {number}
 */
function hzToMel(hz) {
  return 2595 * Math.log10(1 + hz / 700);
}

/**
 * Converts Mel to Hz scale.
 * @param {number} mel
 * @returns {number}
 */
function melToHz(mel) {
  return 700 * (Math.pow(10, mel / 2595) - 1);
}

/**
 * Computes MFCC coefficients from samples.
 *
 * @param {Float32Array} samples
 * @param {number} sampleRate
 * @param {number} fftSize
 * @param {number} [numCoefficients=13]
 * @param {number} [numFilters=26]
 * @returns {Float32Array} numCoefficients MFCC values
 */
export function computeMFCC(samples, sampleRate, fftSize, numCoefficients = 13, numFilters = 26) {
  const mag = computeLinearMagnitudes(samples, fftSize);
  const bins = mag.length; // fftSize / 2

  const nyquist = sampleRate / 2;
  const minMel = hzToMel(80);
  const maxMel = hzToMel(Math.min(nyquist, 8000));

  // Build mel filterbank
  const melPoints = new Float64Array(numFilters + 2);
  for (let m = 0; m <= numFilters + 1; m++) {
    melPoints[m] = melToHz(minMel + (m / (numFilters + 1)) * (maxMel - minMel));
  }

  const binHz = sampleRate / fftSize;
  const filterBins = melPoints.map(hz => Math.round(hz / binHz));

  // Apply mel filterbank → log energies
  const logEnergies = new Float64Array(numFilters);
  for (let m = 1; m <= numFilters; m++) {
    const lo = filterBins[m - 1];
    const center = filterBins[m];
    const hi = filterBins[m + 1];
    let energy = 0;
    for (let k = lo; k < center && k < bins; k++) {
      const w = (k - lo) / Math.max(1, center - lo);
      energy += mag[k] * w;
    }
    for (let k = center; k <= hi && k < bins; k++) {
      const w = (hi - k) / Math.max(1, hi - center);
      energy += mag[k] * w;
    }
    logEnergies[m - 1] = Math.log(Math.max(energy, 1e-10));
  }

  // DCT-II
  const mfcc = new Float32Array(numCoefficients);
  for (let n = 0; n < numCoefficients; n++) {
    let sum = 0;
    for (let m = 0; m < numFilters; m++) {
      sum += logEnergies[m] * Math.cos((Math.PI / numFilters) * (m + 0.5) * n);
    }
    mfcc[n] = sum;
  }

  return mfcc;
}

// ── Log-Band Flux ─────────────────────────────────────────────────────────────

/**
 * Computes log-compressed positive spectral flux in a frequency band.
 *
 * logMag[k] = log(1 + logCompression * magnitude[k])
 * flux = sum(max(0, logMag[t][k] - logMag[t-1][k])) for bins in [lowHz, highHz]
 *
 * @param {Float32Array} magnitudes       Current linear magnitudes
 * @param {Float32Array|null} prevMagnitudes  Previous linear magnitudes (null for first frame)
 * @param {number} lowHz
 * @param {number} highHz
 * @param {number} sampleRate
 * @param {number} fftSize
 * @param {number} [logCompression=1000]
 * @returns {number}
 */
export function computeLogBandFlux(magnitudes, prevMagnitudes, lowHz, highHz, sampleRate, fftSize, logCompression = 1000) {
  if (!prevMagnitudes || prevMagnitudes.length !== magnitudes.length) return 0;
  const binHz = sampleRate / fftSize;
  const binLow = Math.floor(lowHz / binHz);
  const binHigh = Math.min(magnitudes.length - 1, Math.ceil(highHz / binHz));
  let flux = 0;
  for (let k = binLow; k <= binHigh; k++) {
    const logCur = Math.log(1 + logCompression * magnitudes[k]);
    const logPrev = Math.log(1 + logCompression * prevMagnitudes[k]);
    const delta = logCur - logPrev;
    if (delta > 0) flux += delta;
  }
  return flux;
}

// ── Spectral features ─────────────────────────────────────────────────────────

/**
 * Computes HFC (High Frequency Content): sum(k * magnitude[k])
 * Optionally restricted to [lowHz, highHz].
 */
function computeHFC(magnitudes, sampleRate, fftSize, lowHz = 0, highHz = Infinity) {
  const binHz = sampleRate / fftSize;
  const binLow = Math.floor(lowHz / binHz);
  const binHigh = Math.min(magnitudes.length - 1, Math.ceil(highHz / binHz));
  let hfc = 0;
  for (let k = binLow; k <= binHigh; k++) {
    hfc += k * magnitudes[k];
  }
  return hfc;
}

/**
 * Computes spectral centroid in Hz: sum(f[k] * magnitude[k]) / sum(magnitude[k])
 */
function computeSpectralCentroid(magnitudes, sampleRate, fftSize) {
  const binHz = sampleRate / fftSize;
  let weightedSum = 0;
  let totalMag = 0;
  for (let k = 0; k < magnitudes.length; k++) {
    weightedSum += k * binHz * magnitudes[k];
    totalMag += magnitudes[k];
  }
  return totalMag > 1e-10 ? weightedSum / totalMag : 0;
}

/**
 * Computes spectral rolloff: frequency below which `rolloffPercent` of energy is contained.
 * @param {number} [rolloffPercent=0.85]
 */
function computeSpectralRolloff(magnitudes, sampleRate, fftSize, rolloffPercent = 0.85) {
  const binHz = sampleRate / fftSize;
  let totalEnergy = 0;
  for (let k = 0; k < magnitudes.length; k++) totalEnergy += magnitudes[k] * magnitudes[k];
  const target = rolloffPercent * totalEnergy;
  let cumEnergy = 0;
  for (let k = 0; k < magnitudes.length; k++) {
    cumEnergy += magnitudes[k] * magnitudes[k];
    if (cumEnergy >= target) return k * binHz;
  }
  return (magnitudes.length - 1) * binHz;
}

/**
 * Computes spectral flatness: geometric mean / arithmetic mean of |magnitude|.
 */
function computeSpectralFlatness(magnitudes) {
  const n = magnitudes.length;
  if (n === 0) return 0;
  let logSum = 0;
  let linSum = 0;
  const eps = 1e-10;
  for (let k = 0; k < n; k++) {
    logSum += Math.log(magnitudes[k] + eps);
    linSum += magnitudes[k];
  }
  const geomMean = Math.exp(logSum / n);
  const arithMean = linSum / n;
  return arithMean > eps ? geomMean / arithMean : 0;
}

/**
 * Computes crest factor: max(magnitude) / rms(magnitude).
 */
function computeCrestFactor(magnitudes) {
  let maxVal = 0;
  let sumSq = 0;
  for (let k = 0; k < magnitudes.length; k++) {
    if (magnitudes[k] > maxVal) maxVal = magnitudes[k];
    sumSq += magnitudes[k] * magnitudes[k];
  }
  const rmsVal = Math.sqrt(sumSq / Math.max(1, magnitudes.length));
  return rmsVal > 1e-10 ? maxVal / rmsVal : 0;
}

/**
 * Computes zero crossing rate: fraction of sign changes in samples.
 */
function computeZCR(samples) {
  if (!samples || samples.length < 2) return 0;
  let crossings = 0;
  for (let i = 1; i < samples.length; i++) {
    if ((samples[i] >= 0) !== (samples[i - 1] >= 0)) crossings++;
  }
  return crossings / (samples.length - 1);
}

/**
 * Computes band energy: sum(magnitude[k]^2) for bins in [lowHz, highHz].
 */
function computeBandEnergy(magnitudes, sampleRate, fftSize, lowHz, highHz) {
  const binHz = sampleRate / fftSize;
  const binLow = Math.floor(lowHz / binHz);
  const binHigh = Math.min(magnitudes.length - 1, Math.ceil(highHz / binHz));
  let energy = 0;
  for (let k = binLow; k <= binHigh; k++) {
    energy += magnitudes[k] * magnitudes[k];
  }
  return energy;
}

/**
 * Computes total energy: sum(magnitude[k]^2)
 */
function computeTotalEnergy(magnitudes) {
  let energy = 0;
  for (let k = 0; k < magnitudes.length; k++) energy += magnitudes[k] * magnitudes[k];
  return energy;
}

// ── Safe value helper ─────────────────────────────────────────────────────────

function safe(v) {
  if (!Number.isFinite(v)) return 0.0;
  return v;
}

// ── Main extractor ────────────────────────────────────────────────────────────

/**
 * Extracts all base XGBoost features for a single frame.
 *
 * @param {Float32Array} samples           Time-domain samples for this frame
 * @param {Float32Array} frequencyData     dB spectrum from AnalyserNode (unused for MFCC)
 * @param {object} onsetResult             Result from updateGuitarOnsetDetectorNormalized
 * @param {number} sampleRate
 * @param {number} fftSize
 * @param {number} [logCompression=1000]
 * @param {{
 *   prevMagnitudes?: Float32Array|null,
 *   prevRms?: number,
 *   prevHfc?: number,
 *   prevSpectralCentroid?: number,
 *   prevSpectralRolloff?: number,
 *   prevSpectralFlatness?: number,
 *   prevCrestFactor?: number,
 *   prevHfcDelta?: number,
 *   prevLogBandFlux_150_6000?: number,
 * }} [history]
 * @returns {{ baseFeatures: object, linearMagnitudes: Float32Array }}
 */
export function extractXGBoostFrameFeatures(
  samples,
  frequencyData,
  onsetResult,
  sampleRate,
  fftSize,
  logCompression = 1000,
  history = {},
) {
  // Compute linear magnitudes from samples (not dB – required for MFCC)
  const mag = computeLinearMagnitudes(samples, fftSize);

  const prevMag = history.prevMagnitudes ?? null;
  const prevRms = history.prevRms ?? 0;

  // ── Features from onsetResult ─────────────────────────────────────────────
  const rms = safe(onsetResult.rms ?? 0);
  const clippingRatio = safe(onsetResult.clippingRatio ?? 0);
  const isValid = onsetResult.isValid ? 1.0 : 0.0;
  const broadbandFlux = safe(onsetResult.broadbandFlux ?? 0);
  const bandRatio = safe(onsetResult.bandRatio ?? 0);
  const activeBandRatio = safe(onsetResult.activeBandRatio ?? 0);
  const confidence = safe(onsetResult.confidence ?? 0);
  const isOnset = onsetResult.event === 'onset' ? 1.0 : 0.0;
  const spectralNoveltyBins = safe(onsetResult.spectralNoveltyBins ?? 0);
  const relativeRms = safe(onsetResult.relativeRms ?? 0);
  const relativeFlux = safe(onsetResult.relativeFlux ?? 0);
  const sustainFloorRms = safe(onsetResult.sustainFloorRms ?? 0);
  const fluxHistory = safe(onsetResult.fluxHistory ?? 0);
  const gateRelativeRms = (onsetResult.relativeRmsAttack ?? false) ? 1.0 : 0.0;
  const gateRelativeFlux = (onsetResult.relativeSpectralAttack ?? false) ? 1.0 : 0.0;
  const gateConfirmed = (onsetResult.confirmedWeakRmsFluxAttack ?? false) ? 1.0 : 0.0;
  const gateCooldownOverride = (onsetResult.cooldownOverrideAttack ?? false) ? 1.0 : 0.0;
  const gateBroadbandOr = (onsetResult.broadbandOrAttack ?? false) ? 1.0 : 0.0;

  // Sub-band fluxes
  const subbandFlux_low = safe(computeLogBandFlux(mag, prevMag, 80, 300, sampleRate, fftSize, logCompression));
  const subbandFlux_lowMid = safe(computeLogBandFlux(mag, prevMag, 300, 1500, sampleRate, fftSize, logCompression));
  const subbandFlux_presence = safe(computeLogBandFlux(mag, prevMag, 1500, 6000, sampleRate, fftSize, logCompression));

  // ── Spectral features ─────────────────────────────────────────────────────
  const hfc = safe(computeHFC(mag, sampleRate, fftSize));
  const hfcDelta = safe(hfc - (history.prevHfc ?? 0));

  const spectralCentroid = safe(computeSpectralCentroid(mag, sampleRate, fftSize));
  const spectralCentroidDelta = safe(spectralCentroid - (history.prevSpectralCentroid ?? 0));

  const spectralRolloff = safe(computeSpectralRolloff(mag, sampleRate, fftSize));
  const spectralRolloffDelta = safe(spectralRolloff - (history.prevSpectralRolloff ?? 0));

  const spectralFlatness = safe(computeSpectralFlatness(mag));
  const spectralFlatnessDelta = safe(spectralFlatness - (history.prevSpectralFlatness ?? 0));

  const crestFactor = safe(computeCrestFactor(mag));
  const crestFactorDelta = safe(crestFactor - (history.prevCrestFactor ?? 0));

  // ── Time-domain features ──────────────────────────────────────────────────
  const zeroCrossingRate = safe(computeZCR(samples));
  const rmsDelta = safe(rms - prevRms);
  const rmsRise = Math.max(0, rmsDelta);

  // ── Log-band flux features ────────────────────────────────────────────────
  const logBandFlux_150_6000 = safe(computeLogBandFlux(mag, prevMag, 150, 6000, sampleRate, fftSize, logCompression));
  const logBandFlux_500_6000 = safe(computeLogBandFlux(mag, prevMag, 500, 6000, sampleRate, fftSize, logCompression));

  const hfc_1000_6000 = safe(computeHFC(mag, sampleRate, fftSize, 1000, 6000));

  const highBandEnergy_2000_6000 = safe(computeBandEnergy(mag, sampleRate, fftSize, 2000, 6000));
  const totalEnergy = computeTotalEnergy(mag);
  const highToTotalEnergyRatio = safe(highBandEnergy_2000_6000 / (totalEnergy + 1e-10));

  const fluxSlope = safe(logBandFlux_150_6000 - (history.prevLogBandFlux_150_6000 ?? 0));
  // peakProminence is computed in buildContextFeatures where the rolling median is available

  // ── MFCC ──────────────────────────────────────────────────────────────────
  const mfccValues = computeMFCC(samples, sampleRate, fftSize, 13);

  const baseFeatures = {
    rms,
    clippingRatio,
    isValid,
    broadbandFlux,
    bandRatio,
    activeBandRatio,
    confidence,
    isOnset,
    spectralNoveltyBins,
    hfc,
    hfcDelta,
    spectralCentroid,
    spectralCentroidDelta,
    spectralRolloff,
    spectralRolloffDelta,
    spectralFlatness,
    spectralFlatnessDelta,
    crestFactor,
    crestFactorDelta,
    subbandFlux_low,
    subbandFlux_lowMid,
    subbandFlux_presence,
    relativeRms,
    relativeFlux,
    sustainFloorRms,
    fluxHistory,
    gateRelativeRms,
    gateRelativeFlux,
    gateConfirmed,
    gateCooldownOverride,
    gateBroadbandOr,
    hz: safe(onsetResult.hz ?? 0),
    note: safe(onsetResult.note ?? 0),
    octave: safe(onsetResult.octave ?? 0),
    cents: safe(onsetResult.cents ?? 0),
    zeroCrossingRate,
    rmsDelta,
    rmsRise,
    logBandFlux_150_6000,
    logBandFlux_500_6000,
    hfc_1000_6000,
    highBandEnergy_2000_6000,
    highToTotalEnergyRatio,
    fluxSlope,
    peakProminence: 0, // filled by buildContextFeatures
  };

  for (let i = 0; i < 13; i++) {
    baseFeatures[`mfcc_${String(i).padStart(2, '0')}`] = safe(mfccValues[i]);
  }

  return { baseFeatures, linearMagnitudes: mag };
}

// ── Context features ──────────────────────────────────────────────────────────

/**
 * Features that get the full context set of suffixes.
 */
const FULL_CONTEXT_FEATURES = [
  'rms', 'zeroCrossingRate', 'broadbandFlux', 'bandRatio', 'spectralNoveltyBins',
  'hfc', 'spectralCentroid', 'spectralFlatness', 'crestFactor',
  'subbandFlux_low', 'subbandFlux_lowMid', 'subbandFlux_presence',
  'relativeRms', 'relativeFlux',
  'logBandFlux_150_6000', 'logBandFlux_500_6000', 'hfc_1000_6000',
  'highBandEnergy_2000_6000', 'highToTotalEnergyRatio',
  'rmsDelta', 'rmsRise', 'fluxSlope', 'peakProminence',
];

const FULL_CONTEXT_SUFFIXES = [
  'current', 'previous_1', 'previous_2', 'previous_3',
  'mean_last_5', 'max_last_5', 'median_last_30', 'mad_last_30',
];

/**
 * Features that get only the short history set of suffixes.
 */
const SHORT_HISTORY_FEATURES = [
  'mfcc_00', 'mfcc_01', 'mfcc_02', 'mfcc_03', 'mfcc_04',
  'mfcc_05', 'mfcc_06', 'mfcc_07', 'mfcc_08', 'mfcc_09',
  'mfcc_10', 'mfcc_11', 'mfcc_12',
  'spectralCentroid', 'spectralRolloff', 'spectralFlatness', 'crestFactor',
  'hfcDelta', 'spectralCentroidDelta', 'spectralRolloffDelta',
  'spectralFlatnessDelta', 'crestFactorDelta',
];

const SHORT_HISTORY_SUFFIXES = ['current', 'previous_1', 'previous_2', 'previous_3'];

/**
 * Features that get only .current suffix.
 */
const CURRENT_ONLY_FEATURES = [
  'clippingRatio', 'confidence', 'sustainFloorRms', 'fluxHistory',
  'isOnset', 'gateRelativeRms', 'gateRelativeFlux', 'gateConfirmed',
  'gateCooldownOverride', 'gateBroadbandOr',
  'hz', 'note', 'octave', 'cents',
  'isValid', 'activeBandRatio',
];

/**
 * Builds the deterministic feature order array for the full feature set.
 * This is the canonical featureOrder used in exports and model schemas.
 * @returns {string[]}
 */
export function buildFeatureOrder() {
  const order = [];

  for (const feat of FULL_CONTEXT_FEATURES) {
    for (const suffix of FULL_CONTEXT_SUFFIXES) {
      order.push(`${feat}.${suffix}`);
    }
  }

  // SHORT_HISTORY_FEATURES – deduplicate (some overlap with FULL_CONTEXT_FEATURES)
  const seen = new Set(order);
  for (const feat of SHORT_HISTORY_FEATURES) {
    for (const suffix of SHORT_HISTORY_SUFFIXES) {
      const key = `${feat}.${suffix}`;
      if (!seen.has(key)) {
        order.push(key);
        seen.add(key);
      }
    }
  }

  for (const feat of CURRENT_ONLY_FEATURES) {
    const key = `${feat}.current`;
    if (!seen.has(key)) {
      order.push(key);
      seen.add(key);
    }
  }

  return order;
}

/** Cached feature order (computed once). */
let _cachedFeatureOrder = null;

export function getFeatureOrder() {
  if (!_cachedFeatureOrder) _cachedFeatureOrder = buildFeatureOrder();
  return _cachedFeatureOrder;
}

/**
 * Median of an array (non-mutating).
 * @param {number[]} arr
 * @returns {number}
 */
function median(arr) {
  if (arr.length === 0) return 0;
  const sorted = arr.slice().sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? (sorted[mid - 1] + sorted[mid]) / 2
    : sorted[mid];
}

/**
 * Mean Absolute Deviation relative to the median.
 * @param {number[]} arr
 * @param {number} med
 * @returns {number}
 */
function mad(arr, med) {
  if (arr.length === 0) return 0;
  let sumAbs = 0;
  for (const v of arr) sumAbs += Math.abs(v - med);
  return sumAbs / arr.length;
}

/**
 * Builds context features from a base feature dict and a rolling history.
 *
 * @param {object} baseFeatures  Current frame's base features
 * @param {object[]} history     Ring buffer of previous base features (oldest last, at most 30 frames)
 * @param {string[]} [featureOrder]  If provided, only exports features in this order
 * @returns {object} Flat context feature dictionary
 */
export function buildContextFeatures(baseFeatures, history, featureOrder) {
  const ctx = {};

  // Compute peakProminence: logBandFlux_150_6000.current - median(last 30 frames)
  const flux150History = history.slice(0, 30).map(h => safe(h.logBandFlux_150_6000 ?? 0));
  const medFlux = median(flux150History);
  const currentFlux = safe(baseFeatures.logBandFlux_150_6000);
  const peakProm = safe(currentFlux - medFlux);

  // Create extended base with computed peakProminence
  const bf = { ...baseFeatures, peakProminence: peakProm };

  function getHistVal(i, feat) {
    return history[i] ? safe(history[i][feat] ?? 0) : 0.0;
  }

  // ── Full context features ────────────────────────────────────────────────
  for (const feat of FULL_CONTEXT_FEATURES) {
    ctx[`${feat}.current`] = safe(bf[feat] ?? 0);
    ctx[`${feat}.previous_1`] = getHistVal(0, feat);
    ctx[`${feat}.previous_2`] = getHistVal(1, feat);
    ctx[`${feat}.previous_3`] = getHistVal(2, feat);

    const last5 = [safe(bf[feat] ?? 0), ...history.slice(0, 4).map(h => safe(h[feat] ?? 0))];
    ctx[`${feat}.mean_last_5`] = last5.reduce((s, v) => s + v, 0) / last5.length;
    ctx[`${feat}.max_last_5`] = Math.max(...last5);

    const last30 = [safe(bf[feat] ?? 0), ...history.slice(0, 29).map(h => safe(h[feat] ?? 0))];
    const med30 = median(last30);
    ctx[`${feat}.median_last_30`] = med30;
    ctx[`${feat}.mad_last_30`] = mad(last30, med30);
  }

  // ── Short history features ────────────────────────────────────────────────
  for (const feat of SHORT_HISTORY_FEATURES) {
    if (`${feat}.current` in ctx) continue; // already added by full context
    ctx[`${feat}.current`] = safe(bf[feat] ?? 0);
    ctx[`${feat}.previous_1`] = getHistVal(0, feat);
    ctx[`${feat}.previous_2`] = getHistVal(1, feat);
    ctx[`${feat}.previous_3`] = getHistVal(2, feat);
  }

  // ── Current-only features ─────────────────────────────────────────────────
  for (const feat of CURRENT_ONLY_FEATURES) {
    if (`${feat}.current` in ctx) continue;
    ctx[`${feat}.current`] = safe(bf[feat] ?? 0);
    // isOnset, gateXxx are booleans – already converted to 0/1 in extractXGBoostFrameFeatures
  }

  // If a featureOrder is provided, filter and reorder output
  if (featureOrder) {
    const ordered = {};
    for (const key of featureOrder) {
      ordered[key] = key in ctx ? ctx[key] : 0.0;
    }
    return ordered;
  }

  return ctx;
}
