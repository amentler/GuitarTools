// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../js/shared/globalSettings.js', () => ({
  getSetting: vi.fn(() => false),
  SETTING_KEYS: { SRS_ENABLED: 'gt_srs_enabled' },
}));

vi.mock('../../js/shared/learning/srsLogic.js', () => ({
  createSrsStore: vi.fn(() => null),
  pickNextItem: vi.fn((_, pool) => pool[0]),
  recordResult: vi.fn(),
}));

vi.mock('../../js/utils/settings.js', () => ({
  wireFretSlider: vi.fn(),
  syncFretSlider: vi.fn(),
}));

import { createTonFinderFeature } from '../../js/games/tonFinder/tonFinder.js';
import * as settingsMod from '../../js/utils/settings.js';

function buildDom() {
  document.body.innerHTML = `
    <div id="view-ton-finder">
      <gt-fretboard id="ton-finder-svg" interactive></gt-fretboard>
      <gt-string-toggles id="ton-finder-string-toggles"></gt-string-toggles>
      <input id="ton-finder-fret-range-slider" type="range" value="4" min="0" max="12" />
      <span id="ton-finder-fret-range-label">4</span>
      <select id="ton-finder-difficulty"><option value="easy">Easy</option></select>
      <span id="ton-finder-target-note"></span>
      <span id="ton-finder-feedback"></span>
      <span id="score-points">0</span>
      <span id="score-rounds">0</span>
      <button id="btn-ton-finder-finish">Fertig</button>
      <button id="btn-ton-finder-next">Weiter</button>
    </div>
  `;
  // Minimal gt-string-toggles stub
  const toggles = document.getElementById('ton-finder-string-toggles');
  toggles.activeStrings = [1, 2, 3, 4, 5, 6];
  return document.getElementById('view-ton-finder');
}

describe('TonFinder controller', () => {
  let root;
  let feature;

  beforeEach(() => {
    root = buildDom();
    feature = createTonFinderFeature();
  });

  afterEach(() => {
    feature.unmount();
    document.body.innerHTML = '';
    vi.clearAllMocks();
  });

  it('mounts and sets a target note', () => {
    feature.mount(root);
    const target = root.querySelector('#ton-finder-target-note').textContent;
    expect(target.length).toBeGreaterThan(0);
  });

  it('mount/unmount/remount lifecycle works', () => {
    feature.mount(root);
    feature.unmount();
    feature.mount(root);
    expect(root.querySelector('#ton-finder-target-note').textContent.length).toBeGreaterThan(0);
  });

  it('score starts at 0/0', () => {
    feature.mount(root);
    expect(root.querySelector('#score-points').textContent).toBe('0');
    expect(root.querySelector('#score-rounds').textContent).toBe('0');
  });

  it('wires the fret slider on first mount', () => {
    feature.mount(root);
    expect(settingsMod.wireFretSlider).toHaveBeenCalledTimes(1);
  });
});
