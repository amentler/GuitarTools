// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderChordDiagram } from '../../js/games/akkordTrainer/akkordSVG.js';

describe('renderChordDiagram', () => {
  beforeEach(() => {
    document.body.innerHTML = '<div id="root"></div>';
  });

  it('renders one svg diagram with visible markers for user positions', () => {
    const root = document.getElementById('root');

    renderChordDiagram(root, [
      { string: 1, fret: 0 },
      { string: 2, fret: 1, finger: 1 },
      { string: 6, muted: true },
    ], null, null, vi.fn(), true);

    expect(root.querySelectorAll('svg')).toHaveLength(1);
    expect(root.querySelectorAll('circle').length).toBeGreaterThan(1);
    expect(root.textContent).toContain('1');
  });

  it('wires interaction overlays to the provided callback', () => {
    const root = document.getElementById('root');
    const onToggle = vi.fn();

    renderChordDiagram(root, [], null, null, onToggle);

    const clickTargets = root.querySelectorAll('rect[cursor="pointer"]');
    clickTargets[0].dispatchEvent(new MouseEvent('click', { bubbles: true }));
    clickTargets[1].dispatchEvent(new MouseEvent('click', { bubbles: true }));

    expect(onToggle).toHaveBeenNthCalledWith(1, 1, 0, true);
    expect(onToggle).toHaveBeenNthCalledWith(2, 1, 1, false);
  });
});
