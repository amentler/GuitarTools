/**
 * audioAnalyseSVG.js
 *
 * SVG-basierte Chart-Bibliothek für das Audio-Analyse Werkzeug.
 * Alle Charts teilen sich die gleiche X-Achse (Zeit in Sekunden).
 * Onset-Marker erscheinen als vertikale rote gestrichelte Linien auf allen Charts.
 * Ein synchroner Crosshair-Indikator zeigt beim Hover die Werte des nächsten Frames.
 *
 * Koordinatensystem:
 *   viewBox: "0 0 CHART_W {H}"
 *   Plot-Bereich X: PAD_L .. CHART_W - PAD_R
 *   Plot-Bereich Y: PAD_T .. H - PAD_B
 */

import { noteToFrequency } from '../../shared/audio/guitarPitchDetection.js';

// ── Gemeinsame Layout-Konstanten ─────────────────────────────────────────────

const CHART_W = 1000;
const PAD_L = 58;   // Platz für Y-Achsen-Labels
const PAD_R = 12;
const PAD_T = 10;
const PAD_B = 26;   // Platz für X-Achsen-Labels

const PLOT_W = CHART_W - PAD_L - PAD_R;

const COLOR_ONSET    = '#e74c3c';
const COLOR_CROSS    = '#7c4dff';
const COLOR_INVALID  = '#bbbbbb'; // Farbe für Frames mit isValid=false
const COLOR_GRID     = '#e8d8c0';
const COLOR_AXIS     = '#8a7a6a';

// Gitarren-Saiten Referenzfrequenzen
const GUITAR_STRINGS = [
  { label: 'E2', hz: 82.41 },
  { label: 'A2', hz: 110.00 },
  { label: 'D3', hz: 146.83 },
  { label: 'G3', hz: 196.00 },
  { label: 'B3', hz: 246.94 },
  { label: 'E4', hz: 329.63 },
];

// Registry aller Crosshair-Linien (alle Charts, aktualisiert beim Hover)
let _crosshairLines = [];
// Registry aller Playhead-Linien (alle Charts, aktualisiert während Wiedergabe)
let _playheadLines = [];
// Registry der Inline-Cursor-Labels (eines pro Chart)
let _cursorLabels = [];
let _analysisFrames = [];
let _analysisDuration = 1;

// ── SVG-Hilfsfunktionen ──────────────────────────────────────────────────────

function svgEl(tag, attrs = {}) {
  const el = document.createElementNS('http://www.w3.org/2000/svg', tag);
  for (const [k, v] of Object.entries(attrs)) {
    el.setAttribute(k, v);
  }
  return el;
}

function makeSvg(height) {
  return svgEl('svg', {
    viewBox: `0 0 ${CHART_W} ${height}`,
    preserveAspectRatio: 'none',
    class: 'analysis-chart-svg',
  });
}

function makeCrosshairLine(svg, height) {
  const line = svgEl('line', {
    x1: PAD_L, y1: PAD_T, x2: PAD_L, y2: height - PAD_B,
    stroke: COLOR_CROSS,
    'stroke-width': '1',
    'stroke-dasharray': '4 3',
    opacity: '0',
    'pointer-events': 'none',
  });
  svg.appendChild(line);
  _crosshairLines.push(line);
  return line;
}

function makePlayheadLine(svg, height) {
  const line = svgEl('line', {
    x1: PAD_L, y1: PAD_T, x2: PAD_L, y2: height - PAD_B,
    stroke: '#f39c12',
    'stroke-width': '1.5',
    opacity: '0',
    'pointer-events': 'none',
  });
  svg.appendChild(line);
  _playheadLines.push(line);
  return line;
}

/** Konvertiert Zeit in Sekunden zur SVG-X-Koordinate. */
function timeToX(t, duration) {
  return PAD_L + (t / duration) * PLOT_W;
}

/** Zeichnet Onset-Marker auf einem SVG. */
function appendOnsetMarkers(svg, onsets, duration, chartH) {
  for (const t of onsets) {
    const x = timeToX(t, duration);
    svg.appendChild(svgEl('line', {
      x1: x, y1: PAD_T, x2: x, y2: chartH - PAD_B,
      stroke: COLOR_ONSET,
      'stroke-width': '1.2',
      'stroke-dasharray': '5 3',
      opacity: '0.7',
    }));
  }
}

/** Zeichnet horizontale Gitternetzlinien + Y-Achsen-Labels. */
function appendYGrid(svg, chartH, ticks, { yMin, yMax, format, color = COLOR_GRID }) {
  const plotH = chartH - PAD_T - PAD_B;
  for (const v of ticks) {
    const y = PAD_T + plotH * (1 - (v - yMin) / (yMax - yMin));
    svg.appendChild(svgEl('line', {
      x1: PAD_L, y1: y, x2: CHART_W - PAD_R, y2: y,
      stroke: color, 'stroke-width': '0.5',
    }));
    svg.appendChild(Object.assign(
      svgEl('text', {
        x: PAD_L - 4, y: y + 4,
        'text-anchor': 'end',
        'font-size': '9',
        fill: COLOR_AXIS,
      }),
      { textContent: format ? format(v) : String(v) },
    ));
  }
}

/** Zeichnet X-Achse mit Zeit-Labels. */
function appendXAxis(svg, duration, chartH) {
  const y = chartH - PAD_B + 10;
  const tickCount = 6;
  for (let i = 0; i <= tickCount; i++) {
    const t = (i / tickCount) * duration;
    const x = timeToX(t, duration);
    svg.appendChild(svgEl('line', {
      x1: x, y1: chartH - PAD_B, x2: x, y2: chartH - PAD_B + 4,
      stroke: COLOR_AXIS, 'stroke-width': '0.5',
    }));
    svg.appendChild(Object.assign(
      svgEl('text', {
        x, y,
        'text-anchor': 'middle',
        'font-size': '8',
        fill: COLOR_AXIS,
      }),
      { textContent: `${t.toFixed(1)}s` },
    ));
  }
}

/** Zeichnet den Y-Achsen-Rahmen. */
function appendAxes(svg, chartH) {
  // Y-Achse
  svg.appendChild(svgEl('line', {
    x1: PAD_L, y1: PAD_T, x2: PAD_L, y2: chartH - PAD_B,
    stroke: COLOR_AXIS, 'stroke-width': '0.8',
  }));
  // X-Achse
  svg.appendChild(svgEl('line', {
    x1: PAD_L, y1: chartH - PAD_B, x2: CHART_W - PAD_R, y2: chartH - PAD_B,
    stroke: COLOR_AXIS, 'stroke-width': '0.8',
  }));
}

/**
 * Erstellt einen Chart-Abschnitt mit Titel, SVG und optionalem Cursor-Label.
 * @param {string} title
 * @param {SVGElement} svg
 * @param {number} chartH
 * @param {{ getValue: (frame: object) => string }|null} cursorConfig
 */
function createSection(title, svg, chartH, cursorConfig = null) {
  const wrap = document.createElement('div');
  wrap.className = 'analysis-chart-block';

  const header = document.createElement('div');
  header.className = 'analysis-chart-label';
  header.textContent = title;
  wrap.appendChild(header);

  // Feste Pixelhöhe: proportional zur viewBox-Höhe
  const svgWrap = document.createElement('div');
  svgWrap.className = 'analysis-chart-svg-wrap';
  svgWrap.style.setProperty('--chart-aspect', `${CHART_W} / ${chartH}`);
  svgWrap.appendChild(svg);
  wrap.appendChild(svgWrap);

  if (cursorConfig) {
    const valueEl = document.createElement('div');
    valueEl.className = 'analysis-cursor-value';
    wrap.appendChild(valueEl);
    _cursorLabels.push({ el: valueEl, getValue: cursorConfig.getValue });
  }

  return wrap;
}

// ── Öffentliche Render-Funktionen ────────────────────────────────────────────

/**
 * Rendert die Wellenform (Envelope: min/max pro Bin).
 * @param {HTMLElement} container
 * @param {Float32Array} samples
 * @param {number} sampleRate
 * @param {number[]} onsets  Onset-Zeitpunkte in Sekunden
 */
export function renderWaveform(container, samples, sampleRate, onsets) {
  const chartH = 130;
  const plotH = chartH - PAD_T - PAD_B;
  const duration = samples.length / sampleRate;
  const bins = Math.min(PLOT_W, 1400); // max Datenpunkte
  const binSize = Math.ceil(samples.length / bins);

  const svg = makeSvg(chartH);

  // Hintergrund ungültiger Bereiche (sehr leise Stellen) entfällt für Wellenform –
  // hier wird einfach das Signal gezeigt.

  appendAxes(svg, chartH);
  appendXAxis(svg, duration, chartH);

  // Y-Achsen-Label ±1
  for (const v of [1, 0.5, 0, -0.5, -1]) {
    const y = PAD_T + plotH * (0.5 - v / 2);
    svg.appendChild(svgEl('line', {
      x1: PAD_L, y1: y, x2: CHART_W - PAD_R, y2: y,
      stroke: COLOR_GRID, 'stroke-width': v === 0 ? '0.8' : '0.4',
    }));
    svg.appendChild(Object.assign(
      svgEl('text', { x: PAD_L - 4, y: y + 4, 'text-anchor': 'end', 'font-size': '8', fill: COLOR_AXIS }),
      { textContent: v === 0 ? '0' : v.toFixed(1) },
    ));
  }

  // Envelope als gefüllte Polygon-Fläche (min/max pro Bin)
  const topPts = [];
  const botPts = [];
  for (let b = 0; b < bins; b++) {
    const start = b * binSize;
    const end = Math.min(start + binSize, samples.length);
    let mn = Infinity; let mx = -Infinity;
    for (let i = start; i < end; i++) {
      const v = samples[i];
      if (v < mn) mn = v;
      if (v > mx) mx = v;
    }
    mn = Math.max(-1, mn);
    mx = Math.min(1, mx);
    const x = PAD_L + (b / bins) * PLOT_W;
    const midT = ((b + 0.5) * binSize) / samples.length * duration;
    topPts.push([x, PAD_T + plotH * (0.5 - mx / 2), midT]);
    botPts.push([x, PAD_T + plotH * (0.5 - mn / 2), midT]);
  }

  const polyPts = [
    ...topPts.map(([x, y]) => `${x},${y}`),
    ...botPts.slice().reverse().map(([x, y]) => `${x},${y}`),
  ].join(' ');

  svg.appendChild(svgEl('polygon', {
    points: polyPts,
    fill: '#ff6b35',
    opacity: '0.6',
  }));

  appendOnsetMarkers(svg, onsets, duration, chartH);
  makeCrosshairLine(svg, chartH);
  makePlayheadLine(svg, chartH);

  container.appendChild(createSection('Wellenform', svg, chartH, {
    getValue: (frame) => `${frame.t.toFixed(3)} s`,
  }));
}

/**
 * Rendert eine generische Zeitreihe (z.B. RMS, Flux, Ratios).
 * @param {HTMLElement} container
 * @param {import('./audioAnalyseEngine.js').FrameData[]} frames
 * @param {string} valueKey  Schlüssel in FrameData
 * @param {{
 *   title: string,
 *   yMin?: number,
 *   yMax?: number,
 *   color?: string,
 *   ticks?: number[],
 *   format?: (v:number)=>string,
 *   duration: number,
 *   onsets: number[],
 * }} options
 */
export function renderTimeSeries(container, frames, valueKey, options) {
  const chartH = 100;
  const plotH = chartH - PAD_T - PAD_B;
  const {
    title, duration, onsets,
    color = '#7c4dff',
    ticks = [],
    format,
  } = options;

  // Y-Range: feste Werte oder aus Daten berechnen
  const values = frames.map(f => f[valueKey]).filter(v => Number.isFinite(v));
  const dataMax = values.length ? Math.max(...values) : 1;
  const yMin = options.yMin ?? 0;
  const yMax = options.yMax ?? (dataMax * 1.05 || 1);

  const svg = makeSvg(chartH);
  appendAxes(svg, chartH);
  appendXAxis(svg, duration, chartH);

  // Ungültige Frames grau hinterlegen
  let inInvalid = false;
  let invalidStart = PAD_L;
  for (let i = 0; i <= frames.length; i++) {
    const frame = frames[i];
    const isInvalid = frame ? !frame.isValid : false;
    const x = frame ? timeToX(frame.t, duration) : CHART_W - PAD_R;
    if (!inInvalid && isInvalid) {
      inInvalid = true;
      invalidStart = x;
    } else if (inInvalid && !isInvalid) {
      inInvalid = false;
      svg.appendChild(svgEl('rect', {
        x: invalidStart, y: PAD_T, width: x - invalidStart, height: plotH,
        fill: '#e0e0e0', opacity: '0.4',
      }));
    }
  }

  // Gitternetz + Y-Labels
  const effectiveTicks = ticks.length ? ticks : [yMin, yMax];
  appendYGrid(svg, chartH, effectiveTicks, { yMin, yMax, format });

  // Datenlinie
  const points = frames
    .map(f => {
      const v = f[valueKey];
      if (!Number.isFinite(v)) return null;
      const x = timeToX(f.t, duration);
      const y = PAD_T + plotH * (1 - (v - yMin) / (yMax - yMin));
      return `${x},${Math.max(PAD_T, Math.min(chartH - PAD_B, y))}`;
    })
    .filter(Boolean)
    .join(' ');

  if (points) {
    svg.appendChild(svgEl('polyline', {
      points,
      fill: 'none',
      stroke: color,
      'stroke-width': '1.5',
      'stroke-linejoin': 'round',
      'stroke-linecap': 'round',
    }));
  }

  appendOnsetMarkers(svg, onsets, duration, chartH);
  makeCrosshairLine(svg, chartH);
  makePlayheadLine(svg, chartH);

  container.appendChild(createSection(title, svg, chartH, {
    getValue: (frame) => {
      const v = frame[valueKey];
      return (v !== null && v !== undefined && Number.isFinite(v))
        ? (format ? format(v) : v.toFixed(4))
        : '—';
    },
  }));
}

/**
 * Rendert den Frequenz-Chart (logarithmische Y-Achse, Gitarrensaiten-Hilfslinien).
 * @param {HTMLElement} container
 * @param {import('./audioAnalyseEngine.js').FrameData[]} frames
 * @param {number[]} onsets
 * @param {number} duration
 */
export function renderFrequencyChart(container, frames, onsets, duration) {
  const chartH = 250;
  const plotH = chartH - PAD_T - PAD_B;
  const minHz = 70;
  const maxHz = 1100;
  const logMin = Math.log(minHz);
  const logMax = Math.log(maxHz);

  function hzToY(hz) {
    return PAD_T + plotH * (1 - (Math.log(hz) - logMin) / (logMax - logMin));
  }

  const svg = makeSvg(chartH);
  appendAxes(svg, chartH);
  appendXAxis(svg, duration, chartH);

  // Gitarrensaiten-Referenzlinien
  for (const { label, hz } of GUITAR_STRINGS) {
    const y = hzToY(hz);
    svg.appendChild(svgEl('line', {
      x1: PAD_L, y1: y, x2: CHART_W - PAD_R, y2: y,
      stroke: '#7c4dff', 'stroke-width': '0.6', opacity: '0.4',
      'stroke-dasharray': '6 4',
    }));
    svg.appendChild(Object.assign(
      svgEl('text', { x: PAD_L - 3, y: y + 4, 'text-anchor': 'end', 'font-size': '8', fill: '#7c4dff', opacity: '0.7' }),
      { textContent: label },
    ));
  }

  // Datenpunkte (Kreise) – gültige Hz-Werte
  for (const frame of frames) {
    if (frame.hz === null || !Number.isFinite(frame.hz)) continue;
    const x = timeToX(frame.t, duration);
    const y = hzToY(frame.hz);
    svg.appendChild(svgEl('circle', {
      cx: x, cy: y, r: '3',
      fill: '#ff6b35',
      opacity: frame.isValid ? '0.85' : '0.3',
    }));
  }

  // Y-Achsen-Label Hz (log-Ticks)
  for (const hz of [80, 100, 150, 200, 300, 500, 800]) {
    if (hz < minHz || hz > maxHz) continue;
    const y = hzToY(hz);
    svg.appendChild(svgEl('line', {
      x1: PAD_L, y1: y, x2: PAD_L - 3, y2: y,
      stroke: COLOR_AXIS, 'stroke-width': '0.5',
    }));
    svg.appendChild(Object.assign(
      svgEl('text', { x: PAD_L - 5, y: y + 3, 'text-anchor': 'end', 'font-size': '8', fill: COLOR_AXIS }),
      { textContent: `${hz}` },
    ));
  }

  appendOnsetMarkers(svg, onsets, duration, chartH);
  makeCrosshairLine(svg, chartH);
  makePlayheadLine(svg, chartH);

  container.appendChild(createSection('Frequenz (Hz, log)', svg, chartH, {
    getValue: (frame) => frame.hz ? `${frame.hz.toFixed(1)} Hz` : '—',
  }));
}

/**
 * Rendert den Noten-Chart (diskrete Y-Achse, frequenzsortiert).
 * @param {HTMLElement} container
 * @param {import('./audioAnalyseEngine.js').FrameData[]} frames
 * @param {number[]} onsets
 * @param {number} duration
 */
export function renderNoteChart(container, frames, onsets, duration) {
  // Alle erkannten Noten einsammeln und nach Frequenz sortieren
  const noteMap = new Map();
  for (const f of frames) {
    if (f.note === null) continue;
    const key = `${f.note}${f.octave}`;
    if (!noteMap.has(key)) {
      noteMap.set(key, noteToFrequency(f.note, f.octave));
    }
  }
  if (noteMap.size === 0) {
    return; // Keine Noten erkannt – Chart weglassen
  }

  const sortedNotes = [...noteMap.entries()]
    .sort((a, b) => a[1] - b[1]) // Aufsteigend nach Frequenz (tief → hoch)
    .map(([label]) => label);

  const rowH = 22;
  const chartH = sortedNotes.length * rowH + PAD_T + PAD_B;
  const plotH = chartH - PAD_T - PAD_B;

  function noteToY(noteLabel) {
    const idx = sortedNotes.indexOf(noteLabel);
    // Idx 0 = tiefste Note = unten; Idx n-1 = höchste = oben
    return PAD_T + plotH * (1 - (idx + 0.5) / sortedNotes.length);
  }

  const svg = makeSvg(chartH);
  appendAxes(svg, chartH);
  appendXAxis(svg, duration, chartH);

  // Y-Achsen-Labels + Gitternetzlinien
  for (const label of sortedNotes) {
    const y = noteToY(label);
    svg.appendChild(svgEl('line', {
      x1: PAD_L, y1: y, x2: CHART_W - PAD_R, y2: y,
      stroke: COLOR_GRID, 'stroke-width': '0.5',
    }));
    svg.appendChild(Object.assign(
      svgEl('text', { x: PAD_L - 4, y: y + 4, 'text-anchor': 'end', 'font-size': '9', fill: COLOR_AXIS }),
      { textContent: label },
    ));
  }

  // Datenpunkte
  for (const frame of frames) {
    if (frame.note === null) continue;
    const label = `${frame.note}${frame.octave}`;
    const x = timeToX(frame.t, duration);
    const y = noteToY(label);
    svg.appendChild(svgEl('circle', {
      cx: x, cy: y, r: '4',
      fill: frame.isValid ? '#2ecc71' : COLOR_INVALID,
      opacity: frame.isValid ? '0.85' : '0.4',
    }));
  }

  appendOnsetMarkers(svg, onsets, duration, chartH);
  makeCrosshairLine(svg, chartH);
  makePlayheadLine(svg, chartH);

  container.appendChild(createSection('Erkannte Note', svg, chartH, {
    getValue: (frame) => frame.note ? `${frame.note}${frame.octave}` : '—',
  }));
}

// ── Alle Charts rendern ──────────────────────────────────────────────────────

/**
 * Rendert alle Charts für ein AnalysisResult in den gegebenen Container.
 * @param {HTMLElement} container
 * @param {Float32Array} samples
 * @param {import('./audioAnalyseEngine.js').AnalysisResult} result
 */
export function renderAllCharts(container, samples, result) {
  const { frames, onsets, duration, sampleRate } = result;

  // Reset Crosshair- und Playhead-Registry für diesen Renderdurchlauf
  _crosshairLines = [];
  _playheadLines = [];
  _cursorLabels = [];
  _analysisFrames = frames;
  _analysisDuration = duration;

  container.innerHTML = '';

  renderWaveform(container, samples, sampleRate, onsets);

  renderTimeSeries(container, frames, 'rms', {
    title: 'RMS (Energie)',
    yMin: 0, yMax: 0.5,
    ticks: [0, 0.1, 0.2, 0.3, 0.4, 0.5],
    color: '#ff6b35',
    format: v => v.toFixed(2),
    duration, onsets,
  });

  renderTimeSeries(container, frames, 'broadbandFlux', {
    title: 'Spektralfluss (Broadband Flux)',
    yMin: 0,
    ticks: [0, 0.02, 0.05, 0.1],
    color: '#e74c3c',
    format: v => v.toFixed(3),
    duration, onsets,
  });

  renderTimeSeries(container, frames, 'bandRatio', {
    title: 'Band-Ratio (Anteil wachsender Bins)',
    yMin: 0, yMax: 1,
    ticks: [0, 0.25, 0.5, 0.75, 1],
    color: '#e67e22',
    format: v => v.toFixed(2),
    duration, onsets,
  });

  renderTimeSeries(container, frames, 'activeBandRatio', {
    title: 'Aktive Bänder (Anteil aktiver Spektral-Bins)',
    yMin: 0, yMax: 1,
    ticks: [0, 0.25, 0.5, 0.75, 1],
    color: '#f39c12',
    format: v => v.toFixed(2),
    duration, onsets,
  });

  renderTimeSeries(container, frames, 'confidence', {
    title: 'Onset-Konfidenz',
    yMin: 0, yMax: 1,
    ticks: [0, 0.25, 0.5, 0.75, 1],
    color: '#e74c3c',
    format: v => v.toFixed(2),
    duration, onsets,
  });

  renderFrequencyChart(container, frames, onsets, duration);
  renderNoteChart(container, frames, onsets, duration);

  renderTimeSeries(container, frames, 'clippingRatio', {
    title: 'Clipping-Rate (Übersteuerung)',
    yMin: 0, yMax: 0.05,
    ticks: [0, 0.01, 0.02, 0.05],
    color: '#c0392b',
    format: v => (v * 100).toFixed(1) + '%',
    duration, onsets,
  });
}

// ── Playhead ─────────────────────────────────────────────────────────────────

/**
 * Setzt den Playhead auf die gegebene Zeitfraktion (0..1) und zeigt ihn an.
 * @param {number} fraction  0 = Anfang, 1 = Ende
 */
export function updatePlayhead(fraction) {
  const svgX = PAD_L + Math.max(0, Math.min(1, fraction)) * PLOT_W;
  for (const line of _playheadLines) {
    line.setAttribute('x1', svgX);
    line.setAttribute('x2', svgX);
    line.setAttribute('opacity', '1');
  }
}

/**
 * Versteckt den Playhead (z.B. nach Stop).
 */
export function resetPlayhead() {
  for (const line of _playheadLines) {
    line.setAttribute('x1', PAD_L);
    line.setAttribute('x2', PAD_L);
    line.setAttribute('opacity', '0');
  }
}

/**
 * Gibt den Frame-Daten-Eintrag für eine gegebene Zeitfraktion zurück.
 * @param {number} fraction  0..1
 * @returns {object|null}
 */
export function getFrameAtFraction(fraction) {
  if (!_analysisFrames.length || _analysisDuration === 0) return null;
  const t = fraction * _analysisDuration;
  return _analysisFrames.reduce((best, f) =>
    Math.abs(f.t - t) < Math.abs(best.t - t) ? f : best,
    _analysisFrames[0],
  );
}

// ── Crosshair + Inline-Labels ────────────────────────────────────────────────

/**
 * Berechnet zu einer Fraktion den nächsten Frame und aktualisiert:
 * – Crosshair-Linien auf allen Charts
 * – Inline-Cursor-Label jedes Charts
 * @param {number} fraction  0..1
 */
function _updateCrosshairAtFraction(fraction) {
  const svgX    = PAD_L + Math.max(0, Math.min(1, fraction)) * PLOT_W;
  const leftPct = (svgX / CHART_W) * 100;

  for (const line of _crosshairLines) {
    line.setAttribute('x1', svgX);
    line.setAttribute('x2', svgX);
    line.setAttribute('opacity', '0.85');
  }

  const t = fraction * _analysisDuration;
  const frame = _analysisFrames.length
    ? _analysisFrames.reduce((best, f) =>
        Math.abs(f.t - t) < Math.abs(best.t - t) ? f : best,
        _analysisFrames[0])
    : null;

  for (const label of _cursorLabels) {
    label.el.style.left = `${leftPct}%`;
    if (frame) {
      label.el.textContent = label.getValue(frame);
      label.el.style.opacity = '1';
    } else {
      label.el.style.opacity = '0';
    }
  }
}

/**
 * Setzt den Crosshair von außen (z.B. Slider-Seek oder Pause-Position).
 * @param {number} fraction  0..1
 */
export function setCrosshairFromFraction(fraction) {
  _updateCrosshairAtFraction(fraction);
}

/**
 * Initialisiert den synchronen Crosshair-Indikator für alle Charts.
 * Muss nach renderAllCharts() aufgerufen werden.
 *
 * @param {HTMLElement} wrapper  Wrapper-Div der Chart-Sektion
 */
export function initCrosshair(wrapper) {
  wrapper.addEventListener('pointermove', (e) => {
    if (_crosshairLines.length === 0 || _analysisDuration === 0) return;

    const rect = wrapper.getBoundingClientRect();
    const fraction = Math.max(0, Math.min(1,
      (e.clientX - rect.left - (rect.width * PAD_L / CHART_W))
      / (rect.width * PLOT_W / CHART_W),
    ));

    _updateCrosshairAtFraction(fraction);
  });

  wrapper.addEventListener('pointerleave', () => {
    for (const line of _crosshairLines) {
      line.setAttribute('opacity', '0');
    }
    for (const label of _cursorLabels) {
      label.el.style.opacity = '0';
    }
  });
}
