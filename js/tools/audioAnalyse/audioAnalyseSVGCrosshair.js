// Layout constants mirrored from audioAnalyseSVG.js (must stay in sync)
const CHART_W = 1000;
const PAD_L = 58;
const PAD_T = 10;
const PAD_B = 26;
const PLOT_W = 930; // CHART_W - PAD_L - PAD_R (PAD_R = 12)
const COLOR_CROSS = '#7c4dff';

let _crosshairLines = [];
let _cursorLabels = [];
let _analysisFrames = [];
let _analysisDuration = 1;
let _analysisRangeStart = 0;
let _analysisRangeEnd = 1;

export function makeCrosshairLine(svg, height) {
  const ns = 'http://www.w3.org/2000/svg';
  const line = document.createElementNS(ns, 'line');
  line.setAttribute('x1', PAD_L);
  line.setAttribute('y1', PAD_T);
  line.setAttribute('x2', PAD_L);
  line.setAttribute('y2', height - PAD_B);
  line.setAttribute('stroke', COLOR_CROSS);
  line.setAttribute('stroke-width', '1');
  line.setAttribute('stroke-dasharray', '4 3');
  line.setAttribute('opacity', '0');
  line.setAttribute('pointer-events', 'none');
  svg.appendChild(line);
  _crosshairLines.push(line);
  return line;
}

export function registerCursorLabel(el, getValue) {
  _cursorLabels.push({ el, getValue });
}

export function resetCrosshairRegistry() {
  _crosshairLines = [];
  _cursorLabels = [];
}

export function setAnalysisData(frames, duration, options = {}) {
  _analysisFrames = frames;
  _analysisDuration = duration;
  _analysisRangeStart = options.rangeStart ?? 0;
  _analysisRangeEnd = options.rangeEnd ?? duration;
}

function _updateCrosshairAtFraction(fraction) {
  const svgX    = PAD_L + Math.max(0, Math.min(1, fraction)) * PLOT_W;
  const leftPct = (svgX / CHART_W) * 100;

  for (const line of _crosshairLines) {
    line.setAttribute('x1', svgX);
    line.setAttribute('x2', svgX);
    line.setAttribute('opacity', '0.85');
  }

  const t = _analysisRangeStart + fraction * Math.max(0.001, _analysisRangeEnd - _analysisRangeStart);
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

export function setCrosshairFromFraction(fraction) {
  const absoluteTime = Math.max(0, Math.min(1, fraction)) * _analysisDuration;
  const visibleFraction = (absoluteTime - _analysisRangeStart)
    / Math.max(0.001, _analysisRangeEnd - _analysisRangeStart);
  _updateCrosshairAtFraction(Math.max(0, Math.min(1, visibleFraction)));
}

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
