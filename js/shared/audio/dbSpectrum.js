const SILENCE_DB = -200;

function fftInPlace(re, im) {
  const n = re.length;
  let j = 0;

  for (let i = 1; i < n; i++) {
    let bit = n >> 1;
    for (; j & bit; bit >>= 1) j ^= bit;
    j ^= bit;
    if (i < j) {
      let tmp = re[i];
      re[i] = re[j];
      re[j] = tmp;
      tmp = im[i];
      im[i] = im[j];
      im[j] = tmp;
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

export function computeDbSpectrum(samples, fftSize = samples.length) {
  const re = new Float64Array(fftSize);
  const im = new Float64Array(fftSize);
  const n = Math.min(samples.length, fftSize);
  const windowDenominator = Math.max(1, fftSize - 1);

  for (let i = 0; i < n; i++) {
    const window = 0.5 * (1 - Math.cos((2 * Math.PI * i) / windowDenominator));
    re[i] = samples[i] * window;
  }

  fftInPlace(re, im);

  const bins = fftSize >> 1;
  const norm = fftSize >> 1;
  const spectrum = new Float32Array(bins);

  for (let i = 0; i < bins; i++) {
    const mag = Math.hypot(re[i], im[i]) / norm;
    spectrum[i] = mag > 1e-9 ? 20 * Math.log10(mag) : SILENCE_DB;
  }

  return spectrum;
}
