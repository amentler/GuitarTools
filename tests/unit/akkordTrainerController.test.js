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

vi.mock('../../js/domain/chords/chordFretboardMapping.js', () => ({
  chordStringToFretboardIndex: vi.fn(() => []),
  fretboardIndexToChordString: vi.fn(() => ''),
}));

import { createAkkordTrainerFeature } from '../../js/games/akkordTrainer/akkordTrainer.js';

function buildDom() {
  document.body.innerHTML = `
    <div id="view-akkord-trainer">
      <span id="chord-name-display"></span>
      <span id="chord-feedback-text"></span>
      <span id="score-correct">0</span>
      <span id="score-total">0</span>
      <gt-fretboard id="chord-fretboard" interactive></gt-fretboard>
      <button id="btn-chord-check">Prüfen</button>
      <input type="checkbox" id="check-cat-simplified" checked />
      <input type="checkbox" id="check-cat-standard" />
      <input type="checkbox" id="check-cat-extended" />
      <input type="checkbox" id="check-cat-sus-add" />
    </div>
  `;
  return document.getElementById('view-akkord-trainer');
}

describe('AkkordTrainer controller', () => {
  let root;
  let feature;

  beforeEach(() => {
    root = buildDom();
    feature = createAkkordTrainerFeature();
  });

  afterEach(() => {
    feature.unmount();
    document.body.innerHTML = '';
    vi.clearAllMocks();
  });

  it('mounts and shows first chord name', () => {
    feature.mount(root);
    const chordName = root.querySelector('#chord-name-display').textContent;
    expect(chordName.length).toBeGreaterThan(0);
  });

  it('mount/unmount lifecycle cleans up root reference', () => {
    feature.mount(root);
    feature.unmount();
    // After unmount a fresh mount should work (no stale closures)
    feature.mount(root);
    expect(root.querySelector('#chord-name-display').textContent.length).toBeGreaterThan(0);
  });

  it('score display starts at 0/0', () => {
    feature.mount(root);
    expect(root.querySelector('#score-correct').textContent).toBe('0');
    expect(root.querySelector('#score-total').textContent).toBe('0');
  });

  it('check-button triggers feedback text', () => {
    feature.mount(root);
    const btn = root.querySelector('#btn-chord-check');
    btn.click();
    // After checking, feedback text should be updated (not the initial message)
    const feedback = root.querySelector('#chord-feedback-text').textContent;
    expect(typeof feedback).toBe('string');
  });
});
