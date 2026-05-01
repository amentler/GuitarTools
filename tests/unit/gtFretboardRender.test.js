// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest';
import { renderFretboard } from '../../js/components/fretboard/gt-fretboard-render.js';

describe('renderFretboard – maxFret=0 (nur leer)', () => {
  let container;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
  });

  it('zeigt keinen Bundnummer-Text wenn maxFret=0', () => {
    renderFretboard(container, { maxFret: 0 });

    const texts = [...container.querySelectorAll('text')];
    const fretNumbers = texts.filter(t => /^\d+$/.test(t.textContent.trim()));
    expect(fretNumbers).toHaveLength(0);
  });

  it('zeichnet nur den Sattel (1 senkrechte Linie), keinen Bund 1', () => {
    renderFretboard(container, { maxFret: 0 });

    // Nur der Sattel (breite stroke-width) und keine weiteren Bundstriche
    const lines = [...container.querySelectorAll('line')].filter(
      l => l.getAttribute('x1') === l.getAttribute('x2') // senkrechte Linien
    );
    // 1 senkrechte Linie = Sattel
    expect(lines).toHaveLength(1);
  });

  it('erstellt nur Bund-0-Zonen im interaktiven Modus (maxFret=0)', () => {
    renderFretboard(container, { maxFret: 0, interactive: true, onSelect: () => {} });

    const zones = [...container.querySelectorAll('rect[data-fret]')];
    const fretValues = new Set(zones.map(r => r.getAttribute('data-fret')));
    expect(fretValues.has('1')).toBe(false);
    expect(fretValues.has('0')).toBe(true);
  });
});
