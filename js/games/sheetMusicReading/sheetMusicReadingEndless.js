import { appendRow } from './sheetMusicSVG.js';
import { PlaybackBar } from './playbackBar.js';

export function createEndlessHelpers(s, getState, getUI, BARS_PER_ROW, SCROLL_TARGET_FRACTION, SCROLL_SHIFT_DELAY_MS) {
  function buildEndlessRow(container) {
    const target = container ?? getUI()?.container;
    const state = getState();
    const bars = s.gen.nextBatch(BARS_PER_ROW);
    const { notationDiv, staveLayout, rowDiv, vw } = appendRow(
      target, bars, state.showTab, state.timeSig,
    );
    const bar = new PlaybackBar();
    bar.render(notationDiv, staveLayout, vw);
    bar.hide();
    return { rowDiv, playbackBar: bar, staveLayout };
  }

  function appendEndlessRow(container) {
    const asset = buildEndlessRow(container);
    s.rowDivs.push(asset.rowDiv);
    s.playbackBars.push(asset.playbackBar);
    s.staveLayouts.push(asset.staveLayout);
    return asset;
  }

  function disposePendingEndlessRowAsset() {
    if (!s.pendingAsset) return;
    s.pendingAsset.playbackBar.destroy();
    s.pendingAsset.rowDiv.remove();
    s.pendingAsset = null;
  }

  function clearEndlessShiftTimeout() {
    if (!s.shiftTimeoutId) return;
    clearTimeout(s.shiftTimeoutId);
    s.shiftTimeoutId = null;
    disposePendingEndlessRowAsset();
  }

  function getEndlessScrollTarget(container, rowDiv) {
    if (!container || !rowDiv) return 0;
    const target = rowDiv.offsetTop - container.clientHeight * SCROLL_TARGET_FRACTION;
    return Math.max(0, target);
  }

  function shiftEndlessWindowToRow(absoluteRowIndex) {
    if (s.shiftTimeoutId) return;
    if (absoluteRowIndex <= s.firstRowIndex) return;

    const localRowIndex = absoluteRowIndex - s.firstRowIndex;
    const currentRowDiv = s.rowDivs[localRowIndex];
    const container = getUI()?.container;
    if (!container || !currentRowDiv) return;

    const scratch = document.createElement('div');
    s.pendingAsset = buildEndlessRow(scratch);

    container.scrollTo({
      top: getEndlessScrollTarget(container, currentRowDiv),
      behavior: 'smooth',
    });

    s.shiftTimeoutId = setTimeout(() => {
      s.shiftTimeoutId = null;

      const nextAsset = s.pendingAsset;
      s.pendingAsset = null;
      if (!nextAsset) return;

      const removedRowDiv = s.rowDivs.shift() ?? null;
      const removedPlaybackBar = s.playbackBars.shift() ?? null;
      s.staveLayouts.shift();

      const removedHeight = removedRowDiv?.offsetHeight ?? 0;
      removedPlaybackBar?.destroy();
      removedRowDiv?.remove();

      container.appendChild(nextAsset.rowDiv);
      s.rowDivs.push(nextAsset.rowDiv);
      s.playbackBars.push(nextAsset.playbackBar);
      s.staveLayouts.push(nextAsset.staveLayout);
      s.firstRowIndex += 1;

      if (removedHeight > 0) {
        container.scrollTop = Math.max(0, container.scrollTop - removedHeight);
      }
    }, SCROLL_SHIFT_DELAY_MS);
  }

  function cleanupEndlessState() {
    clearEndlessShiftTimeout();
    s.playbackBars.forEach(bar => bar.destroy());
    s.rowDivs = [];
    s.playbackBars = [];
    s.staveLayouts = [];
    s.gen = null;
    s.firstRowIndex = 0;
    const container = getUI()?.container;
    if (container) {
      container.classList.remove('score-container--endless');
      container.scrollTop = 0;
    }
  }

  return {
    buildEndlessRow,
    appendEndlessRow,
    disposePendingEndlessRowAsset,
    clearEndlessShiftTimeout,
    getEndlessScrollTarget,
    shiftEndlessWindowToRow,
    cleanupEndlessState,
  };
}
