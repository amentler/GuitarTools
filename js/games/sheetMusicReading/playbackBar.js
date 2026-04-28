/**
 * playbackBar.js
 * 
 * Manages the visual playhead (moving bar) for sheet music.
 */

import { calcBeatX as logicCalcBeatX } from './playbackLogic.js';

export const calcBeatX = logicCalcBeatX;

export function createPlaybackBarFeature() {
  let playheadEl = null;
  let staveLayout = [];

  function createPlayheadSVG(height) {
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('class', 'playback-bar-svg');
    svg.setAttribute('width', '100%');
    svg.setAttribute('height', '100%');
    svg.style.position = 'absolute';
    svg.style.top = '0';
    svg.style.left = '0';
    svg.style.pointerEvents = 'none';
    svg.style.zIndex = '10';

    const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
    rect.setAttribute('class', 'playback-rect');
    rect.setAttribute('y', '0');
    rect.setAttribute('width', '3');
    rect.setAttribute('height', height);
    rect.setAttribute('fill', 'var(--color-accent)');
    rect.style.transition = 'none';

    svg.appendChild(rect);
    return { svg, rect };
  }

  return {
    render(container, layout, vw, height = 240) {
      this.destroy();
      staveLayout = layout;
      const { svg, rect } = createPlayheadSVG(height);
      playheadEl = rect;
      container.appendChild(svg);
    },

    destroy() {
      if (playheadEl && playheadEl.parentNode) {
        playheadEl.parentNode.parentNode.removeChild(playheadEl.parentNode);
      }
      playheadEl = null;
    },

    hide() {
      if (playheadEl && playheadEl.parentNode) {
        playheadEl.parentNode.classList.add('playback-bar-hidden');
      }
    },

    show() {
      if (playheadEl && playheadEl.parentNode) {
        playheadEl.parentNode.classList.remove('playback-bar-hidden');
      }
    },

    moveToBeat(barIndex, beatIndex, beatsPerBar, bpm = 80) {
      if (!playheadEl || !staveLayout[barIndex]) return;

      const x = calcBeatX(staveLayout, barIndex, beatIndex, beatsPerBar);
      if (x === null) return;
      
      // Snap to current position
      playheadEl.style.transition = 'none';
      playheadEl.setAttribute('x', String(x));

      // Schedule animation for next beat
      const beatDuration = 60 / bpm;
      requestAnimationFrame(() => {
        if (playheadEl) {
          playheadEl.style.transition = `x ${beatDuration * 0.8}s linear`;
        }
      });
    },

    // For testing
    get _rect() { return playheadEl; }
  };
}

// Keep class for compatibility with existing code
export class PlaybackBar {
  constructor() {
    this._feature = createPlaybackBarFeature();
  }
  render(c, l, v) { this._feature.render(c, l, v); }
  destroy() { this._feature.destroy(); }
  hide() { this._feature.hide(); }
  show() { this._feature.show(); }
  moveToBeat(bar, beat, bpb) { this._feature.moveToBeat(bar, beat, bpb); }
  get _rect() { return this._feature._rect; }
}
