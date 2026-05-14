/**
 * onsetTaggerWaveform.js
 *
 * SVG waveform rendering for the Onset Tagger.
 * Draws an amplitude envelope + time axis + cursor/onset/playhead markers.
 */

import { clamp, computeEnvelope, timeToPixel } from './onsetTaggerLogic.js';

const PAD_L  = 4;
const PAD_R  = 4;
const PAD_T  = 6;
const PAD_B  = 20;  // space for time axis labels

const SVG_NS = 'http://www.w3.org/2000/svg';

function el(tag, attrs = {}) {
  const e = document.createElementNS(SVG_NS, tag);
  for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v);
  return e;
}

function plotWidth(svgEl)  { return svgEl.viewBox.baseVal.width  - PAD_L - PAD_R; }
function plotHeight(svgEl) { return svgEl.viewBox.baseVal.height - PAD_T - PAD_B; }

/**
 * Renders the waveform SVG into container (replaces existing SVG).
 *
 * @param {Element} container
 * @param {Float32Array} samples
 * @param {number} sampleRate
 * @param {number} rangeStart  seconds
 * @param {number} rangeEnd    seconds
 * @param {{ plotWidth?: number, plotHeight?: number, onsetsMs?: number[], cursorSec?: number, selectedOnsetIndex?: number }} [options]
 * @returns {SVGElement}
 */
export function renderWaveform(container, samples, sampleRate, rangeStart, rangeEnd, options = {}) {
  const W = options.plotWidth  ?? 1000;
  const H = options.plotHeight ?? 150;
  const totalW = W + PAD_L + PAD_R;
  const totalH = H + PAD_T + PAD_B;

  const svg = el('svg', {
    viewBox: `0 0 ${totalW} ${totalH}`,
    preserveAspectRatio: 'none',
    'data-onset-waveform': '1',
  });
  svg.style.width  = '100%';
  svg.style.height = `${totalH}px`;
  svg.style.display = 'block';

  // ── Background ──────────────────────────────────────────────────────────────
  svg.appendChild(el('rect', {
    x: PAD_L, y: PAD_T, width: W, height: H,
    fill: 'var(--color-surface, #1a1a2e)',
  }));

  // ── Amplitude envelope ───────────────────────────────────────────────────────
  const buckets = W;
  const { mins, maxs } = computeEnvelope(samples, sampleRate, rangeStart, rangeEnd, buckets);
  const mid = PAD_T + H / 2;
  let peak = 0;
  for (let b = 0; b < buckets; b++) {
    peak = Math.max(peak, Math.abs(mins[b] ?? 0), Math.abs(maxs[b] ?? 0));
  }
  const scale = peak > 0.000001 ? (H / 2) / peak : 0;

  const polyMax = [];
  const polyMin = [];
  for (let b = 0; b < buckets; b++) {
    const x = PAD_L + b + 0.5;
    const yMax = mid - maxs[b] * scale;
    const yMin = mid - mins[b] * scale;
    polyMax.push(`${x},${yMax.toFixed(1)}`);
    polyMin.push(`${x},${yMin.toFixed(1)}`);
  }

  // Draw as filled polygon: top line (max) + bottom line (min, reversed)
  if (polyMax.length > 0) {
    const points = [...polyMax, ...[...polyMin].reverse()].join(' ');
    svg.appendChild(el('polygon', {
      points,
      fill: 'var(--color-accent, #7c4dff)',
      opacity: '0.7',
    }));
  }

  // Centre line
  svg.appendChild(el('line', {
    x1: PAD_L, y1: mid, x2: PAD_L + W, y2: mid,
    stroke: 'var(--color-border, #444)',
    'stroke-width': '0.5',
  }));

  // ── Time axis ────────────────────────────────────────────────────────────────
  const numTicks = 5;
  for (let i = 0; i <= numTicks; i++) {
    const t = rangeStart + (i / numTicks) * (rangeEnd - rangeStart);
    const x = PAD_L + (i / numTicks) * W;
    svg.appendChild(el('line', {
      x1: x, y1: PAD_T + H, x2: x, y2: PAD_T + H + 4,
      stroke: 'var(--color-text-muted, #888)',
      'stroke-width': '1',
    }));
    const label = el('text', {
      x, y: PAD_T + H + 14,
      'text-anchor': 'middle',
      'font-size': '9',
      fill: 'var(--color-text-muted, #888)',
    });
    label.textContent = `${t.toFixed(2)}s`;
    svg.appendChild(label);
  }

  // ── Onset markers (red) ──────────────────────────────────────────────────────
  const onsetsMs = options.onsetsMs ?? [];
  const selectedOnsetIndex = options.selectedOnsetIndex ?? -1;
  const onsetGroup = el('g', { 'data-layer': 'onsets' });
  for (let i = 0; i < onsetsMs.length; i++) {
    const ms = onsetsMs[i];
    const sec = ms / 1000;
    if (sec < rangeStart || sec > rangeEnd) continue;
    const x = PAD_L + timeToPixel(sec, rangeStart, rangeEnd, W);
    const selected = i === selectedOnsetIndex;
    onsetGroup.appendChild(el('line', {
      x1: x, y1: PAD_T, x2: x, y2: PAD_T + H,
      stroke: selected ? '#2ecc71' : '#e74c3c',
      'stroke-width': selected ? '3' : '1.5',
      'data-onset-sec': sec,
      'data-selected': selected ? '1' : '0',
    }));
  }
  svg.appendChild(onsetGroup);

  // ── Cursor marker (green) ────────────────────────────────────────────────────
  const cursorSec = options.cursorSec ?? rangeStart;
  const cursorX = PAD_L + timeToPixel(cursorSec, rangeStart, rangeEnd, W);
  svg.appendChild(el('line', {
    x1: cursorX, y1: PAD_T, x2: cursorX, y2: PAD_T + H,
    stroke: '#2ecc71',
    'stroke-width': '2',
    'data-layer': 'cursor',
  }));

  // ── Playhead (orange, initially hidden) ──────────────────────────────────────
  svg.appendChild(el('line', {
    x1: PAD_L, y1: PAD_T, x2: PAD_L, y2: PAD_T + H,
    stroke: '#f39c12',
    'stroke-width': '2',
    'data-layer': 'playhead',
    visibility: 'hidden',
  }));

  // Replace existing SVG
  const old = container.querySelector('[data-onset-waveform]');
  if (old) old.remove();
  container.appendChild(svg);
  return svg;
}

/**
 * Updates the playhead line position (no re-render of envelope).
 *
 * @param {SVGElement} svgEl
 * @param {number|null} playheadSec  null = hide
 * @param {number} rangeStart
 * @param {number} rangeEnd
 */
export function updatePlayhead(svgEl, playheadSec, rangeStart, rangeEnd) {
  const line = svgEl.querySelector('[data-layer="playhead"]');
  if (!line) return;
  if (playheadSec === null) {
    line.setAttribute('visibility', 'hidden');
    return;
  }
  const W = plotWidth(svgEl);
  const x = PAD_L + timeToPixel(playheadSec, rangeStart, rangeEnd, W);
  line.setAttribute('x1', x);
  line.setAttribute('x2', x);
  line.setAttribute('visibility', 'visible');
}

/**
 * Updates the cursor line position.
 *
 * @param {SVGElement} svgEl
 * @param {number} cursorSec
 * @param {number} rangeStart
 * @param {number} rangeEnd
 */
export function updateCursor(svgEl, cursorSec, rangeStart, rangeEnd) {
  const line = svgEl.querySelector('[data-layer="cursor"]');
  if (!line) return;
  const W = plotWidth(svgEl);
  const x = PAD_L + timeToPixel(cursorSec, rangeStart, rangeEnd, W);
  line.setAttribute('x1', x);
  line.setAttribute('x2', x);
}

/**
 * Converts a pointer x-position on the SVG to an absolute time.
 *
 * @param {SVGElement} svgEl
 * @param {number} clientX
 * @param {number} rangeStart
 * @param {number} rangeEnd
 * @returns {number}
 */
export function clientXToTime(svgEl, clientX, rangeStart, rangeEnd) {
  const W = plotWidth(svgEl);
  let svgX;
  if (typeof svgEl.createSVGPoint === 'function' && svgEl.getScreenCTM()) {
    const pt = svgEl.createSVGPoint();
    pt.x = clientX;
    pt.y = 0;
    svgX = pt.matrixTransform(svgEl.getScreenCTM().inverse()).x;
  } else {
    const rect = svgEl.getBoundingClientRect();
    const totalW = svgEl.viewBox.baseVal.width || rect.width;
    const fraction = rect.width > 0 ? (clientX - rect.left) / rect.width : 0;
    svgX = fraction * totalW;
  }
  const plotX = clamp(svgX - PAD_L, 0, W);
  const fraction = W > 0 ? plotX / W : 0;
  return rangeStart + fraction * (rangeEnd - rangeStart);
}

/**
 * Redraws all onset markers.
 *
 * @param {SVGElement} svgEl
 * @param {number[]} onsetsMs
 * @param {number} rangeStart
 * @param {number} rangeEnd
 * @param {number} [selectedOnsetIndex]
 */
export function updateOnsetMarkers(svgEl, onsetsMs, rangeStart, rangeEnd, selectedOnsetIndex = -1) {
  const group = svgEl.querySelector('[data-layer="onsets"]');
  if (!group) return;
  group.innerHTML = '';
  const W = plotWidth(svgEl);
  const H = plotHeight(svgEl);
  for (let i = 0; i < onsetsMs.length; i++) {
    const ms = onsetsMs[i];
    const sec = ms / 1000;
    if (sec < rangeStart || sec > rangeEnd) continue;
    const x = PAD_L + timeToPixel(sec, rangeStart, rangeEnd, W);
    const selected = i === selectedOnsetIndex;
    const line = el('line', {
      x1: x, y1: PAD_T, x2: x, y2: PAD_T + H,
      stroke: selected ? '#2ecc71' : '#e74c3c',
      'stroke-width': selected ? '3' : '1.5',
      'data-selected': selected ? '1' : '0',
    });
    group.appendChild(line);
  }
}
