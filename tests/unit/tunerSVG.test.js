// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest';
import { initTunerSVG, updateTunerDisplay } from '../../js/tools/guitarTuner/tunerSVG.js';
import { frequencyToNote, noteToFrequency } from '../../js/tools/guitarTuner/pitchLogic.js';
import { smoothCents } from '../../js/tools/guitarTuner/tunerLogic.js';

// MAX_DEG mirrored from tunerSVG.js (not exported, verified by reading the source)
const MAX_DEG = 60;

function getTransformAngle(el) {
  const attr = el.getAttribute('transform');
  // format: "rotate(DEG, PIVOT_X, PIVOT_Y)"
  const m = attr.match(/rotate\(([-\d.]+),/);
  return m ? parseFloat(m[1]) : null;
}

describe('initTunerSVG', () => {
  let container;

  beforeEach(() => {
    document.body.innerHTML = '<div id="tuner-display"></div>';
    container = document.getElementById('tuner-display');
    initTunerSVG(container);
  });

  it('creates an SVG element inside the container', () => {
    expect(container.querySelector('svg')).not.toBeNull();
  });

  it('creates the needle element with id "tuner-needle"', () => {
    expect(container.querySelector('#tuner-needle')).not.toBeNull();
  });

  it('creates the in-tune dot with id "tuner-dot"', () => {
    expect(container.querySelector('#tuner-dot')).not.toBeNull();
  });

  it('creates the note text with id "tuner-note"', () => {
    expect(container.querySelector('#tuner-note')).not.toBeNull();
  });

  it('creates the cents text with id "tuner-cents"', () => {
    expect(container.querySelector('#tuner-cents')).not.toBeNull();
  });

  it('initialises the note text to "–"', () => {
    expect(container.querySelector('#tuner-note').textContent).toBe('–');
  });

  it('sets the needle transform to rotate(0, …) by default', () => {
    const needle = container.querySelector('#tuner-needle');
    expect(getTransformAngle(needle)).toBe(0);
  });

  it('clears the container before building (idempotent re-init)', () => {
    initTunerSVG(container);
    expect(container.querySelectorAll('svg').length).toBe(1);
  });
});

describe('updateTunerDisplay – needle rotation', () => {
  let container;

  beforeEach(() => {
    document.body.innerHTML = '<div id="tuner-display"></div>';
    container = document.getElementById('tuner-display');
    initTunerSVG(container);
  });

  it('places the needle at 0° for 0 cents', () => {
    updateTunerDisplay({ cents: 0, note: 'A', octave: 2, isActive: true, isInTune: false, isStandardNote: false });
    const angle = getTransformAngle(document.getElementById('tuner-needle'));
    expect(angle).toBeCloseTo(0, 1);
  });

  it('rotates needle to +60° for +50 cents (sharp limit)', () => {
    updateTunerDisplay({ cents: 50, note: 'A', octave: 2, isActive: true, isInTune: false, isStandardNote: false });
    const angle = getTransformAngle(document.getElementById('tuner-needle'));
    expect(angle).toBeCloseTo(MAX_DEG, 1);
  });

  it('rotates needle to -60° for -50 cents (flat limit)', () => {
    updateTunerDisplay({ cents: -50, note: 'A', octave: 2, isActive: true, isInTune: false, isStandardNote: false });
    const angle = getTransformAngle(document.getElementById('tuner-needle'));
    expect(angle).toBeCloseTo(-MAX_DEG, 1);
  });

  it('rotates to +24° for +20 cents', () => {
    updateTunerDisplay({ cents: 20, note: 'A', octave: 2, isActive: true, isInTune: false, isStandardNote: false });
    const angle = getTransformAngle(document.getElementById('tuner-needle'));
    // (20 / 50) * 60 = 24
    expect(angle).toBeCloseTo(24, 1);
  });

  it('rotates to -36° for -30 cents', () => {
    updateTunerDisplay({ cents: -30, note: 'A', octave: 2, isActive: true, isInTune: false, isStandardNote: false });
    const angle = getTransformAngle(document.getElementById('tuner-needle'));
    // (-30 / 50) * 60 = -36
    expect(angle).toBeCloseTo(-36, 1);
  });

  it('clamps to +60° for cents > 50', () => {
    updateTunerDisplay({ cents: 100, note: 'A', octave: 2, isActive: true, isInTune: false, isStandardNote: false });
    const angle = getTransformAngle(document.getElementById('tuner-needle'));
    expect(angle).toBeCloseTo(MAX_DEG, 1);
  });

  it('clamps to -60° for cents < -50', () => {
    updateTunerDisplay({ cents: -100, note: 'A', octave: 2, isActive: true, isInTune: false, isStandardNote: false });
    const angle = getTransformAngle(document.getElementById('tuner-needle'));
    expect(angle).toBeCloseTo(-MAX_DEG, 1);
  });

  it('resets needle to 0° when isActive is false', () => {
    updateTunerDisplay({ cents: 40, note: 'A', octave: 2, isActive: true, isInTune: false, isStandardNote: false });
    updateTunerDisplay({ cents: 0, note: null, octave: null, isActive: false, isInTune: false, isStandardNote: false });
    const angle = getTransformAngle(document.getElementById('tuner-needle'));
    expect(angle).toBe(0);
  });
});

describe('updateTunerDisplay – green dot', () => {
  beforeEach(() => {
    document.body.innerHTML = '<div id="tuner-display"></div>';
    initTunerSVG(document.getElementById('tuner-display'));
  });

  it('lights the dot when isInTune and isStandardNote are both true', () => {
    updateTunerDisplay({ cents: 2, note: 'E', octave: 2, isActive: true, isInTune: true, isStandardNote: true });
    const dot = document.getElementById('tuner-dot');
    expect(dot.getAttribute('fill')).toBe('var(--color-correct)');
  });

  it('does not light the dot when isInTune is true but isStandardNote is false', () => {
    updateTunerDisplay({ cents: 2, note: 'C#', octave: 3, isActive: true, isInTune: true, isStandardNote: false });
    const dot = document.getElementById('tuner-dot');
    expect(dot.getAttribute('fill')).toBe('var(--color-surface)');
  });

  it('does not light the dot when isStandardNote is true but isInTune is false', () => {
    updateTunerDisplay({ cents: 30, note: 'E', octave: 2, isActive: true, isInTune: false, isStandardNote: true });
    const dot = document.getElementById('tuner-dot');
    expect(dot.getAttribute('fill')).toBe('var(--color-surface)');
  });

  it('resets the dot to unlit when inactive', () => {
    updateTunerDisplay({ cents: 2, note: 'E', octave: 2, isActive: true, isInTune: true, isStandardNote: true });
    updateTunerDisplay({ cents: 0, note: null, octave: null, isActive: false, isInTune: false, isStandardNote: false });
    const dot = document.getElementById('tuner-dot');
    expect(dot.getAttribute('fill')).toBe('var(--color-surface)');
  });
});

describe('updateTunerDisplay – text labels', () => {
  beforeEach(() => {
    document.body.innerHTML = '<div id="tuner-display"></div>';
    initTunerSVG(document.getElementById('tuner-display'));
  });

  it('shows note and octave in the note text', () => {
    updateTunerDisplay({ cents: 0, note: 'A', octave: 2, isActive: true, isInTune: false, isStandardNote: false });
    expect(document.getElementById('tuner-note').textContent).toBe('A2');
  });

  it('shows "–" when note is null', () => {
    updateTunerDisplay({ cents: 0, note: null, octave: null, isActive: true, isInTune: false, isStandardNote: false });
    expect(document.getElementById('tuner-note').textContent).toBe('–');
  });

  it('shows positive cents with a + prefix and "ct" suffix', () => {
    updateTunerDisplay({ cents: 12.5, note: 'A', octave: 2, isActive: true, isInTune: false, isStandardNote: false });
    expect(document.getElementById('tuner-cents').textContent).toBe('+12.5 ct');
  });

  it('shows negative cents without a + prefix', () => {
    updateTunerDisplay({ cents: -8.3, note: 'A', octave: 2, isActive: true, isInTune: false, isStandardNote: false });
    expect(document.getElementById('tuner-cents').textContent).toBe('-8.3 ct');
  });

  it('clears cents text when inactive', () => {
    updateTunerDisplay({ cents: 0, note: null, octave: null, isActive: false, isInTune: false, isStandardNote: false });
    expect(document.getElementById('tuner-cents').textContent).toBe('');
  });

  it('clears cents text when cents is null (warm-up phase)', () => {
    updateTunerDisplay({ cents: null, note: 'A', octave: 2, isActive: true, isInTune: false, isStandardNote: false });
    expect(document.getElementById('tuner-cents').textContent).toBe('');
  });
});

describe('end-to-end: frequencyToNote → smoothCents → needle angle', () => {
  beforeEach(() => {
    document.body.innerHTML = '<div id="tuner-display"></div>';
    initTunerSVG(document.getElementById('tuner-display'));
  });

  it('A4 exactly in tune produces a needle at 0°', () => {
    const { cents } = frequencyToNote(440);
    const smoothed = smoothCents(null, cents); // first frame: pass-through

    updateTunerDisplay({ cents: smoothed, note: 'A', octave: 4, isActive: true, isInTune: true, isStandardNote: false });
    const angle = getTransformAngle(document.getElementById('tuner-needle'));
    expect(Math.abs(angle)).toBeLessThan(0.5);
  });

  it('A4 sharp by +20 cents produces a needle near +24°', () => {
    const targetFreq = noteToFrequency('A', 4);
    const sharpFreq = targetFreq * Math.pow(2, 20 / 1200);
    const { cents } = frequencyToNote(sharpFreq);
    const smoothed = smoothCents(null, cents);

    updateTunerDisplay({ cents: smoothed, note: 'A', octave: 4, isActive: true, isInTune: false, isStandardNote: false });
    const angle = getTransformAngle(document.getElementById('tuner-needle'));
    // (20 / 50) * 60 = 24°
    expect(angle).toBeCloseTo(24, 0);
  });

  it('A4 flat by -30 cents produces a needle near -36°', () => {
    const targetFreq = noteToFrequency('A', 4);
    const flatFreq = targetFreq * Math.pow(2, -30 / 1200);
    const { cents } = frequencyToNote(flatFreq);
    const smoothed = smoothCents(null, cents);

    updateTunerDisplay({ cents: smoothed, note: 'A', octave: 4, isActive: true, isInTune: false, isStandardNote: false });
    const angle = getTransformAngle(document.getElementById('tuner-needle'));
    // (-30 / 50) * 60 = -36°
    expect(angle).toBeCloseTo(-36, 0);
  });

  it('EMA smoothing moves the needle toward the new value (not a jump)', () => {
    // Simulate two consecutive frames: first at +40 cents, then at 0 cents.
    // After one EMA step the needle should be between the two values.
    let smoothed = smoothCents(null, 40); // first frame: 40
    smoothed = smoothCents(smoothed, 0);  // second frame: EMA blend

    // EMA_ALPHA=0.4 → 0.4*0 + 0.6*40 = 24
    expect(smoothed).toBeCloseTo(24, 1);

    updateTunerDisplay({ cents: smoothed, note: 'A', octave: 4, isActive: true, isInTune: false, isStandardNote: false });
    const angle = getTransformAngle(document.getElementById('tuner-needle'));
    // (24 / 50) * 60 = 28.8°
    expect(angle).toBeCloseTo(28.8, 0);
  });
});
