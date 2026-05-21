// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../js/shared/globalSettings.js', () => ({
  getSetting: vi.fn(() => false),
  SETTING_KEYS: { SRS_ENABLED: 'gt_srs_enabled', FRETBOARD_SHUFFLE_NOTES: 'gt_fretboard_shuffle_notes' },
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

import { createFretboardToneRecognitionFeature } from '../../js/games/fretboardToneRecognition/fretboardExercise.js';
import * as settingsMod from '../../js/utils/settings.js';

function buildDom() {
  document.body.innerHTML = `
    <div id="view-fretboard">
      <gt-fretboard id="fretboard-svg"></gt-fretboard>
      <gt-string-toggles id="string-toggles"></gt-string-toggles>
      <div id="note-buttons"></div>
      <span id="feedback-text"></span>
      <span id="score-correct">0</span>
      <span id="score-total">0</span>
      <span id="chances-display"></span>
      <input id="fret-range-slider" type="range" value="4" min="0" max="12" />
      <span id="fret-range-label">4</span>
      <input id="shuffle-notes-checkbox" type="checkbox" />
    </div>
  `;
  // Minimal gt-string-toggles stub
  const toggles = document.getElementById('string-toggles');
  toggles.activeStrings = [1, 2, 3, 4, 5, 6];
  return document.getElementById('view-fretboard');
}

describe('FretboardToneRecognition controller', () => {
  let root;
  let feature;

  beforeEach(() => {
    root = buildDom();
    feature = createFretboardToneRecognitionFeature();
  });

  afterEach(() => {
    feature.unmount();
    document.body.innerHTML = '';
    vi.clearAllMocks();
  });

  it('mounts and renders note buttons', () => {
    feature.mount(root);
    const buttons = root.querySelectorAll('.btn-note');
    expect(buttons.length).toBeGreaterThan(0);
  });

  it('score starts at 0/0', () => {
    feature.mount(root);
    expect(root.querySelector('#score-correct').textContent).toBe('0');
    expect(root.querySelector('#score-total').textContent).toBe('0');
  });

  it('mount/unmount/remount lifecycle works', () => {
    feature.mount(root);
    feature.unmount();
    feature.mount(root);
    expect(root.querySelectorAll('.btn-note').length).toBeGreaterThan(0);
  });

  it('wires the fret slider on first mount', () => {
    feature.mount(root);
    expect(settingsMod.wireFretSlider).toHaveBeenCalledTimes(1);
  });

  it('unmount clears pending feedback timeout', () => {
    vi.useFakeTimers();
    feature.mount(root);
    // Click a note button to potentially trigger a feedback timeout
    const btn = root.querySelector('.btn-note');
    if (btn) btn.click();
    feature.unmount();
    // Should not throw when timers fire after unmount
    expect(() => vi.runAllTimers()).not.toThrow();
    vi.useRealTimers();
  });
});
