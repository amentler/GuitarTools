export function buildTimeSeriesSpecs(onsetOptions) {
  const relativeReattackFactor = onsetOptions?.relativeReattackFactor ?? 4;
  const relativeFluxFactor = onsetOptions?.relativeFluxFactor ?? 1.4;
  const spectralNoveltyMinBins = onsetOptions?.spectralNoveltyMinBins ?? 36;
  const confirmedSpectralNoveltyMinBins = onsetOptions?.confirmedSpectralNoveltyMinBins ?? 14;

  return [
    ['rms', 'RMS (Energie)', '#ff6b35', v => v.toFixed(2), { yMin: 0, yMax: 0.5, ticks: [0, 0.1, 0.2, 0.3, 0.4, 0.5] }],
    ['broadbandFlux', 'Spektralfluss (Broadband Flux)', '#e74c3c', v => v.toFixed(3), { yMin: 0, ticks: [0, 0.02, 0.05, 0.1] }],
    ['bandRatio', 'Band-Ratio (Anteil wachsender Bins)', '#e67e22', v => v.toFixed(2), { yMin: 0 }],
    ['activeBandRatio', 'Aktive Bänder (Anteil aktiver Spektral-Bins)', '#f39c12', v => v.toFixed(2), { yMin: 0 }],
    ['confidence', 'Onset-Konfidenz', '#e74c3c', v => v.toFixed(2), { yMin: 0 }],
    ['relativeRms', 'Relative RMS (RMS / Sustain-Floor)', '#27ae60', v => v.toFixed(2), {
      yMin: 0,
      ticks: [0, 1],
      thresholds: [{ value: relativeReattackFactor, color: '#e74c3c', label: `×${relativeReattackFactor}` }],
    }],
    ['relativeFlux', 'Relative Flux (Flux / Flux-History)', '#2980b9', v => v.toFixed(2), {
      yMin: 0,
      ticks: [0, 1],
      thresholds: [{ value: relativeFluxFactor, color: '#e74c3c', label: `×${relativeFluxFactor}` }],
    }],
    ['spectralNoveltyBins', 'Spektrale Novelty Bins', '#8e44ad', v => String(Math.round(v)), {
      yMin: 0,
      ticks: [0],
      thresholds: [
        { value: spectralNoveltyMinBins, color: '#e74c3c', label: `min ${spectralNoveltyMinBins}` },
        { value: confirmedSpectralNoveltyMinBins, color: '#e67e22', label: `conf. ${confirmedSpectralNoveltyMinBins}` },
      ],
    }],
    ['hfc', 'HFC (High-Frequency Content)', '#16a085', v => v.toFixed(3), { yMin: 0 }],
    ['hfcDelta', 'HFC-Delta', '#1abc9c', v => v.toFixed(3), {}],
    ['spectralCentroidDelta', 'Centroid-Delta (Helligkeit)', '#2c7fb8', v => `${v.toFixed(0)} Hz`, {}],
    ['spectralRolloffDelta', 'Rolloff-Delta', '#41b6c4', v => `${v.toFixed(0)} Hz`, {}],
    ['spectralFlatness', 'Spectral Flatness', '#6a51a3', v => v.toFixed(3), { yMin: 0 }],
    ['crestFactor', 'Crest Factor', '#b15928', v => v.toFixed(2), { yMin: 0 }],
    ['subbandFluxLow', 'Subband Flux Low (80-220 Hz)', '#386cb0', v => v.toFixed(3), { yMin: 0 }],
    ['subbandFluxLowMid', 'Subband Flux Low-Mid (220-600 Hz)', '#7fc97f', v => v.toFixed(3), { yMin: 0 }],
    ['subbandFluxPresence', 'Subband Flux Presence (2-6 kHz)', '#fdc086', v => v.toFixed(3), { yMin: 0 }],
  ];
}
