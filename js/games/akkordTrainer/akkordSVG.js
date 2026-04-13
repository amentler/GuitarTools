/**
 * akkordSVG.js
 * Interactive chord diagram renderer using SVG (Horizontal Orientation).
 */

const SVG_NS = 'http://www.w3.org/2000/svg';

// Layout Constants (Horizontal Diagram - like Tabs)
const VB_W = 450;
const VB_H = 300;

const MARGIN_LEFT = 60;
const MARGIN_TOP = 50;
const DIAGRAM_W = 340;
const DIAGRAM_H = 180;

const NUM_STRINGS = 6;
const NUM_FRETS = 5;

const STRING_SPACING = DIAGRAM_H / (NUM_STRINGS - 1);
const FRET_SPACING = DIAGRAM_W / NUM_FRETS;

function el(tag, attrs = {}, children = []) {
  const e = document.createElementNS(SVG_NS, tag);
  for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v);
  for (const child of children) e.appendChild(child);
  return e;
}

function txt(content, attrs = {}) {
  const e = document.createElementNS(SVG_NS, 'text');
  for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v);
  e.textContent = content;
  return e;
}

/**
 * Renders an interactive horizontal chord diagram.
 * @param {HTMLElement} container - The DOM element to render into.
 * @param {Array} userPositions - [{string, fret, muted, finger?}]
 * @param {Array} referencePositions - [{string, fret, muted}] (for feedback)
 * @param {'correct'|'wrong'|null} feedback - Game feedback state.
 * @param {Function} onTogglePosition - Callback (string, fret, isMutedToggle)
 * @param {boolean} [showFingers=false] - If true, renders finger numbers inside fretted dots.
 */
export function renderChordDiagram(container, userPositions, referencePositions, feedback, onTogglePosition, showFingers = false) {
  container.innerHTML = '';

  const svg = el('svg', {
    viewBox: `0 0 ${VB_W} ${VB_H}`,
    xmlns: SVG_NS,
    class: 'chord-diagram-svg',
    style: 'width: 100%; height: auto; max-width: 600px; display: block; margin: 0 auto;'
  });

  // 1. Draw Strings (Horizontal lines)
  // String 1 (high E) is at the top, String 6 (low E) at the bottom
  const labels = ['e', 'B', 'G', 'D', 'A', 'E'];
  for (let s = 0; s < NUM_STRINGS; s++) {
    const y = MARGIN_TOP + s * STRING_SPACING;

    svg.appendChild(el('line', {
      x1: MARGIN_LEFT,
      y1: y,
      x2: MARGIN_LEFT + DIAGRAM_W,
      y2: y,
      stroke: '#d4a017',
      'stroke-width': 1 + (s * 0.5) // thicker for low strings
    }));

    // String labels at the left
    svg.appendChild(txt(labels[s], {
      x: MARGIN_LEFT - 35,
      y: y + 5,
      'text-anchor': 'middle',
      fill: '#8892a4',
      'font-size': '16',
      'font-weight': 'bold',
      'font-family': 'monospace'
    }));
  }

  // 2. Draw Frets (Vertical lines)
  for (let f = 0; f <= NUM_FRETS; f++) {
    const x = MARGIN_LEFT + f * FRET_SPACING;
    const isNut = f === 0;
    svg.appendChild(el('line', {
      x1: x,
      y1: MARGIN_TOP,
      x2: x,
      y2: MARGIN_TOP + DIAGRAM_H,
      stroke: isNut ? '#f5e6c8' : '#c0c0c0',
      'stroke-width': isNut ? '8' : '3',
      'stroke-linecap': 'round'
    }));
    
    // Fret numbers at the bottom
    if (f > 0) {
      svg.appendChild(txt(f.toString(), {
        x: x - FRET_SPACING / 2,
        y: MARGIN_TOP + DIAGRAM_H + 30,
        'text-anchor': 'middle',
        fill: '#8892a4',
        'font-size': '14'
      }));
    }
  }

  // 3. Interaction Overlays
  for (let s = 0; s < NUM_STRINGS; s++) {
    const y = MARGIN_TOP + s * STRING_SPACING;
    const stringNum = s + 1;

    // Mute/Open toggle area (Nut area)
    const toggleZone = el('rect', {
      x: MARGIN_LEFT - 50,
      y: y - STRING_SPACING / 2,
      width: 50,
      height: STRING_SPACING,
      fill: 'transparent',
      cursor: 'pointer'
    });
    toggleZone.addEventListener('click', () => onTogglePosition(stringNum, 0, true));
    svg.appendChild(toggleZone);

    // Fret click areas
    for (let f = 1; f <= NUM_FRETS; f++) {
      const x = MARGIN_LEFT + (f - 1) * FRET_SPACING;
      const fretZone = el('rect', {
        x: x,
        y: y - STRING_SPACING / 2,
        width: FRET_SPACING,
        height: STRING_SPACING,
        fill: 'transparent',
        cursor: 'pointer'
      });
      fretZone.addEventListener('click', () => onTogglePosition(stringNum, f, false));
      svg.appendChild(fretZone);
    }
  }

  // 4. Render User Markers & Mutes
  userPositions.forEach(pos => {
    const sIdx = pos.string - 1;
    const y = MARGIN_TOP + sIdx * STRING_SPACING;
    
    if (pos.muted) {
      // Draw X for muted (left of nut)
      const size = 10;
      const x = MARGIN_LEFT - 20;
      svg.appendChild(el('line', {
        x1: x - size, y1: y - size,
        x2: x + size, y2: y + size,
        stroke: feedback === 'wrong' ? '#f44336' : (feedback === 'correct' ? '#4caf50' : '#8892a4'),
        'stroke-width': '3'
      }));
      svg.appendChild(el('line', {
        x1: x + size, y1: y - size,
        x2: x - size, y2: y + size,
        stroke: feedback === 'wrong' ? '#f44336' : (feedback === 'correct' ? '#4caf50' : '#8892a4'),
        'stroke-width': '3'
      }));
    } else if (pos.fret === 0) {
      // Draw O for open (left of nut)
      const x = MARGIN_LEFT - 20;
      svg.appendChild(el('circle', {
        cx: x, cy: y, r: '8',
        fill: 'none',
        stroke: feedback === 'wrong' ? '#f44336' : (feedback === 'correct' ? '#4caf50' : '#8892a4'),
        'stroke-width': '3'
      }));
    } else {
      // Draw Dot for fretted
      const x = MARGIN_LEFT + (pos.fret - 0.5) * FRET_SPACING;
      let dotFill = '#f5a623';
      if (feedback === 'correct') dotFill = '#4caf50';
      if (feedback === 'wrong') dotFill = '#f44336';
      
      svg.appendChild(el('circle', {
        cx: x, cy: y, r: '12',
        fill: dotFill
      }));

      if (showFingers && pos.finger) {
        svg.appendChild(txt(pos.finger.toString(), {
          x: x,
          y: y + 5,
          'text-anchor': 'middle',
          fill: '#ffffff',
          'font-size': '13',
          'font-weight': 'bold',
          'font-family': 'sans-serif',
          'pointer-events': 'none'
        }));
      }
    }
  });

  // 5. Render Reference Ghosting (if wrong)
  if (feedback === 'wrong' && referencePositions) {
    referencePositions.forEach(ref => {
      const userMatch = userPositions.find(up => up.string === ref.string && up.fret === ref.fret && up.muted === ref.muted);
      if (!userMatch) {
        const sIdx = ref.string - 1;
        const y = MARGIN_TOP + sIdx * STRING_SPACING;
        
        if (ref.muted) {
          const size = 8;
          const x = MARGIN_LEFT - 20;
          svg.appendChild(el('line', {
            x1: x - size, y1: y - size,
            x2: x + size, y2: y + size,
            stroke: '#8892a4', opacity: '0.5', 'stroke-width': '2'
          }));
          svg.appendChild(el('line', {
            x1: x + size, y1: y - size,
            x2: x - size, y2: y + size,
            stroke: '#8892a4', opacity: '0.5', 'stroke-width': '2'
          }));
        } else if (ref.fret === 0) {
          const x = MARGIN_LEFT - 20;
          svg.appendChild(el('circle', {
            cx: x, cy: y, r: '6',
            fill: 'none', stroke: '#8892a4', opacity: '0.5', 'stroke-width': '2'
          }));
        } else {
          const x = MARGIN_LEFT + (ref.fret - 0.5) * FRET_SPACING;
          svg.appendChild(el('circle', {
            cx: x, cy: y, r: '10',
            fill: '#8892a4', opacity: '0.4'
          }));
        }
      }
    });
  }

  container.appendChild(svg);
}
