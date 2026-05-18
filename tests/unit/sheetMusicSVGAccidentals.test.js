// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';

const staveNotes = [];
const accidentals = [];

vi.mock('https://cdn.jsdelivr.net/npm/vexflow@4.2.2/+esm', () => {
  class Renderer {
    static Backends = { SVG: 'svg' };

    constructor(container) {
      const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      container.appendChild(svg);
    }

    resize() {}

    getContext() {
      return {
        setFillStyle() {},
        setStrokeStyle() {},
      };
    }
  }

  class Stave {
    constructor() {
      this.noteStartX = 10;
    }

    addClef() { return this; }
    addTimeSignature() { return this; }
    setContext() { return this; }
    draw() { return this; }
    setEndBarType() {}
    getNoteStartX() { return this.noteStartX; }
  }

  class StaveNote {
    constructor(options) {
      this.options = options;
      this.modifiers = [];
      this.styles = [];
      staveNotes.push(this);
    }

    addModifier(modifier, index) {
      this.modifiers.push({ modifier, index });
      return this;
    }

    setStyle(style) {
      this.styles.push(style);
      return this;
    }

    setKeyStyle(index, style) {
      this.styles.push({ index, style });
      return this;
    }
  }

  class Accidental {
    constructor(type) {
      this.type = type;
      accidentals.push(this);
    }
  }

  class Voice {
    static Mode = { SOFT: 'soft' };

    constructor() {
      this.tickables = [];
    }

    setMode() {}

    addTickables(tickables) {
      this.tickables.push(...tickables);
    }

    draw() {}
  }

  class Formatter {
    joinVoices() { return this; }
    format() { return this; }
  }

  return { Renderer, Stave, StaveNote, Accidental, Voice, Formatter };
});

describe('sheetMusicSVG accidentals', () => {
  beforeEach(() => {
    staveNotes.length = 0;
    accidentals.length = 0;
    document.body.innerHTML = '';
    document.documentElement.style.setProperty('--color-text', '#111111');
  });

  it.each([
    ['sharp', 'F#', 'f#/3', '#'],
    ['flat', 'Bb', 'bb/3', 'b'],
  ])('adds a %s accidental when rendering an altered note key', async (_label, name, vfKey, expectedAccidental) => {
    const { renderScore } = await import('../../js/games/sheetMusicReading/sheetMusicSVG.js');
    const container = document.createElement('div');
    const bars = [[
      { name, octave: 2, vfKey, string: 6, fret: 2 },
    ]];

    renderScore(container, bars, false, '4/4');

    expect(staveNotes).toHaveLength(1);
    expect(accidentals.map(accidental => accidental.type)).toContain(expectedAccidental);
    expect(staveNotes[0].modifiers).toEqual([
      { modifier: accidentals[0], index: 0 },
    ]);
  });
});
