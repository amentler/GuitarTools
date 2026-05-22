import { noteToFrequency } from '../../shared/audio/guitarPitchDetection.js';
import {
  makeCrosshairLine,
  registerCursorLabel,
  resetCrosshairRegistry,
  setAnalysisData,
} from './audioAnalyseSVGCrosshair.js';
import { buildTimeSeriesSpecs } from './audioAnalyseSVGSeries.js';
export { setCrosshairFromFraction, initCrosshair } from './audioAnalyseSVGCrosshair.js';

const CHART_W = 1000;
const PAD_L = 58;   // Platz für Y-Achsen-Labels
const PAD_R = 12;
const PAD_T = 10;
const PAD_B = 26;   // Platz für X-Achsen-Labels

const PLOT_W = CHART_W - PAD_L - PAD_R;

const COLOR_ONSET    = '#e74c3c';
const COLOR_TAGGED_ONSET = '#1f8b4c';
const COLOR_CURRENT_ONSET = '#f39c12';
const COLOR_INVALID  = '#bbbbbb'; // Farbe für Frames mit isValid=false
const COLOR_GRID     = '#e8d8c0';
const COLOR_AXIS     = '#8a7a6a';
const MIN_VISIBLE_RANGE_SEC = 0.01;

const GUITAR_STRINGS = [
  { label: 'E2', hz: 82.41 },
  { label: 'A2', hz: 110.00 },
  { label: 'D3', hz: 146.83 },
  { label: 'G3', hz: 196.00 },
  { label: 'B3', hz: 246.94 },
  { label: 'E4', hz: 329.63 },
];

let _playheadLines = [];
let _analysisFrames = [];
let _analysisDuration = 1;
let _analysisRangeStart = 0;
let _analysisRangeEnd = 1;

function svgEl(tag, attrs = {}) {
  const el = document.createElementNS('http://www.w3.org/2000/svg', tag);
  for (const [k, v] of Object.entries(attrs)) {
    el.setAttribute(k, v);
  }
  return el;
}

function makeSvg(height) {
  const svg = svgEl('svg', {
    viewBox: `0 0 ${CHART_W} ${height}`,
    preserveAspectRatio: 'none',
    class: 'analysis-chart-svg',
  });
  // Explicit width/height as attributes so mobile browsers don't fall back
  // to the 1000px intrinsic viewBox width when CSS hasn't yet resolved.
  svg.setAttribute('width', '100%');
  svg.setAttribute('height', '100%');
  return svg;
}

function makePlayheadLine(svg, height) {
  const line = svgEl('line', {
    x1: PAD_L, y1: PAD_T, x2: PAD_L, y2: height - PAD_B,
    stroke: '#f39c12',
    'stroke-width': '1.5',
    opacity: '0',
    'pointer-events': 'none',
    class: 'analysis-playhead',
  });
  svg.appendChild(line);
  _playheadLines.push(line);
  return line;
}

function timeToX(t, rangeStart, rangeEnd) {
  const range = Math.max(MIN_VISIBLE_RANGE_SEC, rangeEnd - rangeStart);
  return PAD_L + ((t - rangeStart) / range) * PLOT_W;
}

function appendOnsetMarkers(svg, markerSets, rangeStart, rangeEnd, chartH) {
  for (const markerSet of markerSets) {
    if (!markerSet.visible) continue;
    for (const t of markerSet.onsets) {
      if (t < rangeStart || t > rangeEnd) continue;
      const x = timeToX(t, rangeStart, rangeEnd);
      svg.appendChild(svgEl('line', {
        x1: x, y1: PAD_T, x2: x, y2: chartH - PAD_B,
        stroke: markerSet.color,
        'stroke-width': markerSet.strokeWidth ?? '1.2',
        'stroke-dasharray': markerSet.dasharray ?? '5 3',
        opacity: markerSet.opacity ?? '0.7',
        class: markerSet.className,
      }));
    }
  }
}

function makeMarkerSets(onsets, options = {}) {
  return [
    {
      onsets,
      visible: options.showDetectedOnsets !== false,
      color: COLOR_ONSET,
      className: 'analysis-marker-detected',
      dasharray: '5 3',
      strokeWidth: '1.2',
      opacity: '0.72',
    },
    {
      onsets: options.taggedOnsets ?? [],
      visible: options.showTaggedOnsets !== false,
      color: COLOR_TAGGED_ONSET,
      className: 'analysis-marker-tagged',
      dasharray: '2 2',
      strokeWidth: '1.5',
      opacity: '0.82',
    },
    {
      onsets: Number.isFinite(options.currentOnsetSec) ? [options.currentOnsetSec] : [],
      visible: Number.isFinite(options.currentOnsetSec),
      color: COLOR_CURRENT_ONSET,
      className: 'analysis-marker-current',
      dasharray: '',
      strokeWidth: '2',
      opacity: '0.92',
    },
  ];
}

function filterFramesToRange(frames, rangeStart, rangeEnd) {
  return frames.filter(frame => frame.t >= rangeStart && frame.t <= rangeEnd);
}

function resolveChartRange(duration, options = {}) {
  const maxStart = Math.max(0, duration - MIN_VISIBLE_RANGE_SEC);
  const rangeStart = Math.max(0, Math.min(maxStart, options.rangeStart ?? 0));
  const requestedEnd = Number.isFinite(options.rangeEnd) ? options.rangeEnd : duration;
  const rangeEnd = Math.max(
    Math.min(duration, rangeStart + MIN_VISIBLE_RANGE_SEC),
    Math.min(duration, requestedEnd),
  );
  return {
    rangeStart,
    rangeEnd: Math.min(duration, Math.max(rangeStart + MIN_VISIBLE_RANGE_SEC, rangeEnd)),
  };
}

function resolveYRange(values, options, fallbackMax = 1) {
  const normalized = options.normalizeY !== false;
  const yMin = options.yMin ?? 0;
  if (!normalized && Number.isFinite(options.yMax)) {
    return { yMin, yMax: options.yMax };
  }
  const dataMax = values.length ? Math.max(...values) : fallbackMax;
  const dataMin = values.length ? Math.min(...values) : yMin;
  if (normalized) {
    if (dataMin < 0) {
      const maxAbs = Math.max(Math.abs(dataMin), Math.abs(dataMax), Number.EPSILON);
      return { yMin: -maxAbs, yMax: maxAbs };
    }
    return { yMin: 0, yMax: Math.max(dataMax * 1.05, Number.EPSILON) };
  }
  return { yMin, yMax: Number.isFinite(options.yMax) ? options.yMax : (dataMax * 1.05 || fallbackMax) };
}

function makeTicks(yMin, yMax, requestedTicks) {
  if (requestedTicks?.length) {
    return requestedTicks.filter(tick => tick >= yMin && tick <= yMax);
  }
  if (yMin < 0) return [yMin, 0, yMax];
  return [yMin, yMax];
}

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

function appendXAxis(svg, rangeStart, rangeEnd, chartH) {
  const y = chartH - PAD_B + 10;
  const tickCount = 6;
  for (let i = 0; i <= tickCount; i++) {
    const t = rangeStart + (i / tickCount) * (rangeEnd - rangeStart);
    const x = timeToX(t, rangeStart, rangeEnd);
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

function appendAxes(svg, chartH) {
  svg.appendChild(svgEl('line', {
    x1: PAD_L, y1: PAD_T, x2: PAD_L, y2: chartH - PAD_B,
    stroke: COLOR_AXIS, 'stroke-width': '0.8',
  }));
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
    registerCursorLabel(valueEl, cursorConfig.getValue);
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
 * @param {{ rangeStart?: number, rangeEnd?: number, normalizeY?: boolean, taggedOnsets?: number[], showDetectedOnsets?: boolean, showTaggedOnsets?: boolean }} [options]
 */
export function renderWaveform(container, samples, sampleRate, onsets, options = {}) {
  const chartH = 130;
  const plotH = chartH - PAD_T - PAD_B;
  const duration = samples.length / sampleRate;
  const { rangeStart, rangeEnd } = resolveChartRange(duration, options);
  const markerSets = makeMarkerSets(onsets, options);
  const bins = Math.min(PLOT_W, 1400); // max Datenpunkte
  const startSample = Math.max(0, Math.floor(rangeStart * sampleRate));
  const endSample = Math.min(samples.length, Math.ceil(rangeEnd * sampleRate));
  const visibleLength = Math.max(1, endSample - startSample);
  const binSize = Math.ceil(visibleLength / bins);

  const svg = makeSvg(chartH);

  // Hintergrund ungültiger Bereiche (sehr leise Stellen) entfällt für Wellenform –
  // hier wird einfach das Signal gezeigt.

  appendAxes(svg, chartH);
  appendXAxis(svg, rangeStart, rangeEnd, chartH);

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

  let peak = 1;
  if (options.normalizeY !== false) {
    peak = Number.EPSILON;
    for (let i = startSample; i < endSample; i++) {
      peak = Math.max(peak, Math.abs(samples[i] ?? 0));
    }
  }

  // Envelope als gefüllte Polygon-Fläche (min/max pro Bin)
  const topPts = [];
  const botPts = [];
  for (let b = 0; b < bins; b++) {
    const start = startSample + b * binSize;
    const end = Math.min(start + binSize, endSample);
    let mn = Infinity; let mx = -Infinity;
    for (let i = start; i < end; i++) {
      const v = samples[i];
      if (v < mn) mn = v;
      if (v > mx) mx = v;
    }
    mn = Math.max(-peak, mn);
    mx = Math.min(peak, mx);
    const x = PAD_L + (b / bins) * PLOT_W;
    topPts.push([x, PAD_T + plotH * (0.5 - mx / (2 * peak))]);
    botPts.push([x, PAD_T + plotH * (0.5 - mn / (2 * peak))]);
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

  appendOnsetMarkers(svg, markerSets, rangeStart, rangeEnd, chartH);
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
 *   rangeStart?: number,
 *   rangeEnd?: number,
 *   normalizeY?: boolean,
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
    thresholds = [],
  } = options;
  const { rangeStart, rangeEnd } = resolveChartRange(duration, options);
  const visibleFrames = filterFramesToRange(frames, rangeStart, rangeEnd);
  const markerSets = makeMarkerSets(onsets, options);

  // Y-Range: feste Werte oder aus Daten berechnen
  const values = visibleFrames.map(f => f[valueKey]).filter(v => Number.isFinite(v));
  const { yMin, yMax } = resolveYRange(values, options, 1);

  const svg = makeSvg(chartH);
  appendAxes(svg, chartH);
  appendXAxis(svg, rangeStart, rangeEnd, chartH);

  // Ungültige Frames grau hinterlegen
  let inInvalid = false;
  let invalidStart = PAD_L;
  for (let i = 0; i <= visibleFrames.length; i++) {
    const frame = visibleFrames[i];
    const isInvalid = frame ? !frame.isValid : false;
    const x = frame ? timeToX(frame.t, rangeStart, rangeEnd) : CHART_W - PAD_R;
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
  const effectiveTicks = makeTicks(yMin, yMax, ticks);
  appendYGrid(svg, chartH, effectiveTicks, { yMin, yMax, format });

  // Datenlinie
  const points = visibleFrames
    .map(f => {
      const v = f[valueKey];
      if (!Number.isFinite(v)) return null;
      const x = timeToX(f.t, rangeStart, rangeEnd);
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

  for (const th of thresholds) {
    if (!Number.isFinite(th.value)) continue;
    const ty = PAD_T + plotH * (1 - (th.value - yMin) / (yMax - yMin));
    if (ty < PAD_T || ty > chartH - PAD_B) continue;
    svg.appendChild(svgEl('line', {
      x1: PAD_L, y1: ty, x2: CHART_W - PAD_R, y2: ty,
      stroke: th.color ?? '#e74c3c',
      'stroke-width': '1',
      'stroke-dasharray': '4 3',
      opacity: '0.7',
    }));
    if (th.label) {
      svg.appendChild(Object.assign(
        svgEl('text', {
          x: CHART_W - PAD_R - 2, y: ty - 2,
          'text-anchor': 'end',
          'font-size': '8',
          fill: th.color ?? '#e74c3c',
          opacity: '0.9',
        }),
        { textContent: th.label },
      ));
    }
  }

  appendOnsetMarkers(svg, markerSets, rangeStart, rangeEnd, chartH);
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
export function renderFrequencyChart(container, frames, onsets, duration, options = {}) {
  const chartH = 250;
  const plotH = chartH - PAD_T - PAD_B;
  const minHz = 70;
  const maxHz = 1100;
  const logMin = Math.log(minHz);
  const logMax = Math.log(maxHz);

  function hzToY(hz) {
    return PAD_T + plotH * (1 - (Math.log(hz) - logMin) / (logMax - logMin));
  }
  const { rangeStart, rangeEnd } = resolveChartRange(duration, options);
  const visibleFrames = filterFramesToRange(frames, rangeStart, rangeEnd);
  const markerSets = makeMarkerSets(onsets, options);

  const svg = makeSvg(chartH);
  appendAxes(svg, chartH);
  appendXAxis(svg, rangeStart, rangeEnd, chartH);

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
  for (const frame of visibleFrames) {
    if (frame.hz === null || !Number.isFinite(frame.hz)) continue;
    const x = timeToX(frame.t, rangeStart, rangeEnd);
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

  appendOnsetMarkers(svg, markerSets, rangeStart, rangeEnd, chartH);
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
export function renderNoteChart(container, frames, onsets, duration, options = {}) {
  const { rangeStart, rangeEnd } = resolveChartRange(duration, options);
  const visibleFrames = filterFramesToRange(frames, rangeStart, rangeEnd);
  const markerSets = makeMarkerSets(onsets, options);
  // Alle erkannten Noten einsammeln und nach Frequenz sortieren
  const noteMap = new Map();
  for (const f of visibleFrames) {
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
  appendXAxis(svg, rangeStart, rangeEnd, chartH);

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
  for (const frame of visibleFrames) {
    if (frame.note === null) continue;
    const label = `${frame.note}${frame.octave}`;
    const x = timeToX(frame.t, rangeStart, rangeEnd);
    const y = noteToY(label);
    svg.appendChild(svgEl('circle', {
      cx: x, cy: y, r: '4',
      fill: frame.isValid ? '#2ecc71' : COLOR_INVALID,
      opacity: frame.isValid ? '0.85' : '0.4',
    }));
  }

  appendOnsetMarkers(svg, markerSets, rangeStart, rangeEnd, chartH);
  makeCrosshairLine(svg, chartH);
  makePlayheadLine(svg, chartH);

  container.appendChild(createSection('Erkannte Note', svg, chartH, {
    getValue: (frame) => frame.note ? `${frame.note}${frame.octave}` : '—',
  }));
}

/**
 * Rendert einen Gate-Status-Chart mit 4 booleschen Lanes.
 * @param {HTMLElement} container
 * @param {import('./audioAnalyseEngine.js').FrameData[]} frames
 * @param {number[]} onsets
 * @param {number} duration
 */
export function renderGateChart(container, frames, onsets, duration, options = {}) {
  const LANES = [
    { key: 'gateRelativeRms',      label: 'Rel. RMS',    color: '#2ecc71' },
    { key: 'gateRelativeFlux',     label: 'Rel. Flux',   color: '#3498db' },
    { key: 'gateConfirmed',        label: 'Confirmed',   color: '#9b59b6' },
    { key: 'gateCooldownOverride', label: 'CD Override', color: '#e67e22' },
    { key: 'gateBroadbandOr',      label: 'Broadband OR', color: '#1abc9c' },
  ];
  const laneH = 16;
  const chartH = LANES.length * laneH + PAD_T + PAD_B;
  const { rangeStart, rangeEnd } = resolveChartRange(duration, options);
  const visibleFrames = filterFramesToRange(frames, rangeStart, rangeEnd);
  const markerSets = makeMarkerSets(onsets, options);

  const svg = makeSvg(chartH);
  appendAxes(svg, chartH);
  appendXAxis(svg, rangeStart, rangeEnd, chartH);

  LANES.forEach(({ key, label, color }, i) => {
    const y = PAD_T + i * laneH;
    // Lane background
    svg.appendChild(svgEl('rect', {
      x: PAD_L, y, width: PLOT_W, height: laneH,
      fill: '#f5f0e8', opacity: '0.3',
    }));
    // Lane label
    svg.appendChild(Object.assign(
      svgEl('text', {
        x: PAD_L - 4, y: y + laneH * 0.7,
        'text-anchor': 'end', 'font-size': '8', fill: COLOR_AXIS,
      }),
      { textContent: label },
    ));
    // Active frames as filled rects
    for (const frame of visibleFrames) {
      if (!frame[key]) continue;
      const x = timeToX(frame.t, rangeStart, rangeEnd);
      svg.appendChild(svgEl('rect', {
        x: x - 1, y: y + 1, width: 3, height: laneH - 2,
        fill: color, opacity: '0.85',
      }));
    }
  });

  appendOnsetMarkers(svg, markerSets, rangeStart, rangeEnd, chartH);
  makeCrosshairLine(svg, chartH);
  makePlayheadLine(svg, chartH);

  container.appendChild(createSection('Gate-Status (welche Bedingungen feuern)', svg, chartH, {
    getValue: (frame) => {
      const active = LANES.filter(l => frame[l.key]).map(l => l.label);
      return active.length ? active.join(' + ') : '—';
    },
  }));
}

// ── Alle Charts rendern ──────────────────────────────────────────────────────

/**
 * Rendert alle Charts für ein AnalysisResult in den gegebenen Container.
 * @param {HTMLElement} container
 * @param {Float32Array} samples
 * @param {import('./audioAnalyseEngine.js').AnalysisResult} result
 * @param {{ rangeStart?: number, rangeEnd?: number, normalizeY?: boolean, showDetectedOnsets?: boolean, showTaggedOnsets?: boolean, taggedOnsets?: number[], currentOnsetSec?: number }} [options]
 */
export function renderAllCharts(container, samples, result, options = {}) {
  const { frames, onsets, duration, sampleRate, onsetOptions } = result;
  const { rangeStart, rangeEnd } = resolveChartRange(duration, options);
  const chartOptions = {
    ...options,
    rangeStart,
    rangeEnd,
  };

  // Reset Crosshair- und Playhead-Registry für diesen Renderdurchlauf
  resetCrosshairRegistry();
  setAnalysisData(filterFramesToRange(frames, rangeStart, rangeEnd), duration, { rangeStart, rangeEnd });
  _playheadLines = [];
  _analysisFrames = frames;
  _analysisDuration = duration;
  _analysisRangeStart = rangeStart;
  _analysisRangeEnd = rangeEnd;

  container.innerHTML = '';

  renderWaveform(container, samples, sampleRate, onsets, chartOptions);

  for (const [key, title, color, format, extra] of buildTimeSeriesSpecs(onsetOptions)) {
    renderTimeSeries(container, frames, key, { ...chartOptions, ...extra, title, color, format, duration, onsets });
  }

  renderGateChart(container, frames, onsets, duration, chartOptions);

  renderFrequencyChart(container, frames, onsets, duration, chartOptions);
  renderNoteChart(container, frames, onsets, duration, chartOptions);

  renderTimeSeries(container, frames, 'clippingRatio', {
    ...chartOptions,
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
  const absoluteTime = Math.max(0, Math.min(1, fraction)) * _analysisDuration;
  const range = Math.max(MIN_VISIBLE_RANGE_SEC, _analysisRangeEnd - _analysisRangeStart);
  const visibleFraction = Math.max(0, Math.min(1, (absoluteTime - _analysisRangeStart) / range));
  const svgX = PAD_L + visibleFraction * PLOT_W;
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
