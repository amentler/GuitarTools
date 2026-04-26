// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest';
import '../../js/components/fretboard/gt-fretboard.js';

describe('GtFretboard', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  it('renders clickable fret positions when interactive', () => {
    document.body.innerHTML = '<gt-fretboard interactive frets="3"></gt-fretboard>';
    const element = document.querySelector('gt-fretboard');

    const svg = element.querySelector('svg');
    expect(svg).not.toBeNull();
    // In unified style, interaction is on rect zones
    expect(element.querySelectorAll('rect[style*="cursor:pointer"]').length).toBeGreaterThan(0);
  });

  it('dispatches fret-select with the computed note name', () => {
    document.body.innerHTML = '<gt-fretboard interactive frets="3"></gt-fretboard>';
    const element = document.querySelector('gt-fretboard');

    const events = [];
    element.addEventListener('fret-select', event => events.push(event.detail));

    // rect zones: Nut (string 0-5), Fret 1 (string 0-5), ...
    // StringIndex is 5-s where s is row. Row 0 is top (high E), Row 5 is bottom (low E).
    // stringIndex 0 (low E) is s=5. 
    // Nut is f=0.
    const clickTargets = element.querySelectorAll('rect[style*="cursor:pointer"]');
    // Targets[0] is string 0, fret 0.
    // Targets[1] is string 0, fret 1. -> E2 + 1 = F
    clickTargets[1].dispatchEvent(new MouseEvent('click', { bubbles: true }));

    expect(events).toEqual([
      { stringIndex: 0, fret: 1, note: 'F' },
    ]);
  });

  it('re-renders when JS-only properties change', () => {
    document.body.innerHTML = '<gt-fretboard frets="3"></gt-fretboard>';
    const element = document.querySelector('gt-fretboard');

    element.activeStrings = [0, 1];
    element.positions = [{ stringIndex: 1, fret: 2, state: 'selected' }];

    // Highlighted circle
    expect(element.querySelectorAll('circle[fill="#ff6b35"]').length).toBe(1);
    // Active strings lines
    expect(element.querySelectorAll('line[opacity="1"]').length).toBe(2);
  });
});
