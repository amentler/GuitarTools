import { computeDbSpectrum } from './dbSpectrum.js';

/**
 * Sammelt { samples, frequencyData } pro Frame offline.
 *
 * Bevorzugter Pfad: OfflineAudioContext + AnalyserNode.getFloatFrequencyData() –
 * identisch zur Live-Analyse in sheetMusicReading.js.
 * Fallback: computeDbSpectrum (JS-FFT) wenn OfflineAudioContext.prototype.suspend
 * nicht verfügbar ist (z. B. Firefox).
 *
 * @param {Float32Array} samples   – mono, normalisiert [-1, 1]
 * @param {number} sampleRate
 * @param {number} fftSize         – Potenz von 2
 * @param {number} hopSize         – Schrittweite (= fftSize für kein Overlap)
 * @returns {Promise<Array<{ samples: Float32Array, frequencyData: Float32Array }>>}
 */
export async function collectFrameData(samples, sampleRate, fftSize, hopSize) {
  const frameCount = Math.floor((samples.length - fftSize) / hopSize) + 1;

  if (typeof OfflineAudioContext === 'undefined' || typeof OfflineAudioContext.prototype.suspend !== 'function') {
    return Array.from({ length: frameCount }, (_, i) => {
      const frame = samples.slice(i * hopSize, i * hopSize + fftSize);
      return {
        samples: frame,
        frequencyData: computeDbSpectrum(frame, fftSize),
      };
    });
  }

  const totalLength = Math.max(samples.length, frameCount * hopSize + fftSize);

  const offCtx = new OfflineAudioContext(1, totalLength, sampleRate);
  const audioBuffer = offCtx.createBuffer(1, samples.length, sampleRate);
  audioBuffer.copyToChannel(samples, 0);

  const analyser = offCtx.createAnalyser();
  analyser.fftSize = fftSize;
  analyser.smoothingTimeConstant = 0;

  const source = offCtx.createBufferSource();
  source.buffer = audioBuffer;
  source.connect(analyser);
  analyser.connect(offCtx.destination);

  const frameTimeDomain = new Array(frameCount);
  const frameFreq = new Array(frameCount);

  for (let i = 0; i < frameCount; i++) {
    const suspendTime = (i * hopSize + fftSize) / sampleRate;
    offCtx.suspend(suspendTime).then(() => {
      const td = new Float32Array(fftSize);
      const fd = new Float32Array(analyser.frequencyBinCount);
      analyser.getFloatTimeDomainData(td);
      analyser.getFloatFrequencyData(fd);
      frameTimeDomain[i] = td;
      frameFreq[i] = fd;
      offCtx.resume();
    });
  }

  source.start(0);
  await offCtx.startRendering();

  return frameTimeDomain.map((td, i) => ({
    samples: td,
    frequencyData: frameFreq[i],
  }));
}
