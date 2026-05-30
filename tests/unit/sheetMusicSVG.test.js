// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('https://cdn.jsdelivr.net/npm/vexflow@4.2.2/+esm', () => {
  class Renderer {
    static Backends = { SVG: 'svg' };

    constructor(container) {
      this.container = container;
      this.svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      this.container.appendChild(this.svg);
    }

    resize(width, height) {
      this.svg.setAttribute('width', String(width));
      this.svg.setAttribute('height', String(height));
    }

    getContext() {
      return {
        setFillStyle() {},
        setStrokeStyle() {},
      };
    }
  }

  class Stave {
    constructor(x, y, width) {
      this.x = x;
      this.y = y;
      this.width = width;
      this.hasTimeSignature = false;
    }

    addClef() {
      return this;
    }

    addTimeSignature() {
      this.hasTimeSignature = true;
      return this;
    }

    setEndBarType() {
      return this;
    }

    setContext() {
      return this;
    }

    draw() {
      return this;
    }

    getNoteStartX() {
      return this.x + (this.hasTimeSignature ? 90 : 10);
    }
  }

  class StaveNote {
    addModifier() {}
    setStyle() {}
    setKeyStyle() {}
  }

  class Voice {
    static Mode = { SOFT: 'soft' };

    constructor() {}
    setMode() {}
    addTickables() {}
    draw() {}
  }

  class Formatter {
    joinVoices() {
      return this;
    }

    format() {
      return this;
    }
  }

  class Accidental {
    constructor(value) {
      this.value = value;
    }
  }

  return { Renderer, Stave, StaveNote, Voice, Formatter, Accidental };
});

describe('sheetMusicSVG tab rendering', () => {
  beforeEach(() => {
    document.body.innerHTML = '<div id="target"></div>';
  });

  it('renders larger tabs and keeps tab bar lines aligned with notation bar widths', async () => {
    const { renderScore } = await import('../../js/games/sheetMusicReading/sheetMusicSVG.js');
    const container = document.getElementById('target');
    const bars = [
      [{ vfKey: 'e/3', string: 6, fret: 0 }, { vfKey: 'f/3', string: 6, fret: 1 }, { vfKey: 'g/3', string: 6, fret: 3 }, { vfKey: 'a/3', string: 5, fret: 0 }],
      [{ vfKey: 'b/3', string: 5, fret: 2 }, { vfKey: 'c/4', string: 5, fret: 3 }, { vfKey: 'd/4', string: 4, fret: 0 }, { vfKey: 'e/4', string: 4, fret: 2 }],
      [{ vfKey: 'f/4', string: 4, fret: 3 }, { vfKey: 'g/4', string: 3, fret: 0 }, { vfKey: 'a/4', string: 3, fret: 2 }, { vfKey: 'b/4', string: 2, fret: 0 }],
      [{ vfKey: 'c/5', string: 2, fret: 1 }, { vfKey: 'd/5', string: 2, fret: 3 }, { vfKey: 'e/5', string: 1, fret: 0 }, { vfKey: 'f/5', string: 1, fret: 1 }],
    ];

    const { vw, staveLayout } = renderScore(container, bars, true, '4/4');

    const tabSvg = container.querySelector('.tab-wrapper svg');
    expect(tabSvg).not.toBeNull();
    expect(tabSvg.getAttribute('viewBox')).toBe(`0 0 ${vw} 143`);

    const verticalLines = [...tabSvg.querySelectorAll('line')]
      .filter(line => line.getAttribute('x1') === line.getAttribute('x2'));
    expect(verticalLines.map(line => Number(line.getAttribute('x1')))).toEqual([0, 208, 336, 464, 592]);
    expect(verticalLines[0].getAttribute('stroke-width')).toBe('2.75');
    expect(verticalLines[1].getAttribute('stroke-width')).toBe('1.75');

    const fretText = [...tabSvg.querySelectorAll('text')].find(text => text.textContent === '0' && text.getAttribute('font-family') === 'monospace');
    expect(fretText?.getAttribute('font-size')).toBe('16');
    expect(staveLayout).toEqual([
      { barStartX: 0, barEndX: 208, noteStartX: 90, noteEndX: 208 },
      { barStartX: 208, barEndX: 336, noteStartX: 218, noteEndX: 336 },
      { barStartX: 336, barEndX: 464, noteStartX: 346, noteEndX: 464 },
      { barStartX: 464, barEndX: 592, noteStartX: 474, noteEndX: 592 },
    ]);
  });

  it('appends endless rows with the same aligned tab layout', async () => {
    const { appendRow } = await import('../../js/games/sheetMusicReading/sheetMusicSVG.js');
    const container = document.getElementById('target');
    const bars = Array.from({ length: 4 }, () => Array.from({ length: 4 }, () => ({
      vfKey: 'e/3',
      string: 6,
      fret: 0,
    })));

    const { rowDiv, vw } = appendRow(container, bars, true, '4/4');

    expect(container.firstElementChild).toBe(rowDiv);
    const tabSvg = rowDiv.querySelector('.tab-wrapper svg');
    expect(tabSvg?.getAttribute('viewBox')).toBe(`0 0 ${vw} 143`);
    const horizontalLines = [...tabSvg.querySelectorAll('line')]
      .filter(line => line.getAttribute('y1') === line.getAttribute('y2'));
    expect(horizontalLines).toHaveLength(6);
    expect(horizontalLines[0].getAttribute('stroke-width')).toBe('1.75');
  });
});
