/**
 * akkordSVG.js
 * Interactive chord diagram renderer using SVG.
 */

const SVG_NS = 'http://www.w3.org/2000/svg';

// Layout Constants (Vertical Diagram)
const VB_W = 300;
const VB_H = 400;

const MARGIN_TOP = 60;
const MARGIN_LEFT = 50;
const DIAGRAM_W = 200;
const DIAGRAM_H = 250;

const NUM_STRINGS = 6;
const NUM_FRETS = 5;

const STRING_SPACING = DIAGRAM_W / (NUM_STRINGS - 1);
const FRET_SPACING = DIAGRAM_H / NUM_FRETS;

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
 * Renders an interactive chord diagram.
 * @param {HTMLElement} container - The DOM element to render into.
 * @param {Array} userPositions - [{string, fret, muted}]
 * @param {Array} referencePositions - [{string, fret, muted}] (for feedback)
 * @param {'correct'|'wrong'|null} feedback - Game feedback state.
 * @param {Function} onTogglePosition - Callback (string, fret, isMutedToggle)
 */
export function renderChordDiagram(container, userPositions, referencePositions, feedback, onTogglePosition) {
  container.innerHTML = '';

  const svg = el('svg', {
    viewBox: `0 0 ${VB_W} ${VB_H}`,
    xmlns: SVG_NS,
    class: 'chord-diagram-svg',
    style: 'width: 100%; height: auto; max-width: 400px; display: block; margin: 0 auto;'
  });

  // 1. Draw Frets
  for (let f = 0; f <= NUM_FRETS; f++) {
    const y = MARGIN_TOP + f * FRET_SPACING;
    const isNut = f === 0;
    svg.appendChild(el('line', {
      x1: MARGIN_LEFT,
      y1: y,
      x2: MARGIN_LEFT + DIAGRAM_W,
      y2: y,
      stroke: isNut ? '#f5e6c8' : '#c0c0c0',
      'stroke-width': isNut ? '8' : '3'
    }));
  }

  // 2. Draw Strings
  for (let s = 0; s < NUM_STRINGS; s++) {
    const x = MARGIN_LEFT + s * STRING_SPACING;
    svg.appendChild(el('line', {
      x1: x,
      y1: MARGIN_TOP,
      x2: x,
      y2: MARGIN_TOP + DIAGRAM_H,
      stroke: '#d4a017',
      'stroke-width': 2 + (NUM_STRINGS - 1 - s) * 0.5
    }));

    // String labels (E, A, D, G, B, E) at the bottom
    const labels = ['E', 'A', 'D', 'G', 'B', 'e'];
    svg.appendChild(txt(labels[s], {
      x: x,
      y: MARGIN_TOP + DIAGRAM_H + 30,
      'text-anchor': 'middle',
      fill: '#8892a4',
      'font-size': '14',
      'font-weight': 'bold'
    }));
  }

  // 3. Interaction Overlays (Invisible rectangles for clicking)
  // Top area for Mute/Open toggle (Fret 0 area)
  for (let s = 0; s < NUM_STRINGS; s++) {
    const x = MARGIN_LEFT + s * STRING_SPACING;
    const stringNum = 6 - s; // 6 is low E, 1 is high E

    // Mute/Open toggle area
    const toggleZone = el('rect', {
      x: x - STRING_SPACING / 2,
      y: MARGIN_TOP - 40,
      width: STRING_SPACING,
      height: 40,
      fill: 'transparent',
      cursor: 'pointer'
    });
    toggleZone.addEventListener('click', () => onTogglePosition(stringNum, 0, true));
    svg.appendChild(toggleZone);

    // Fret click areas
    for (let f = 1; f <= NUM_FRETS; f++) {
      const y = MARGIN_TOP + (f - 1) * FRET_SPACING;
      const fretZone = el('rect', {
        x: x - STRING_SPACING / 2,
        y: y,
        width: STRING_SPACING,
        height: FRET_SPACING,
        fill: 'transparent',
        cursor: 'pointer'
      });
      fretZone.addEventListener('click', () => onTogglePosition(stringNum, f, false));
      svg.appendChild(fretZone);
    }
  }

  // 4. Render User Markers & Mutes
  userPositions.forEach(pos => {
    const sIdx = 6 - pos.string;
    const x = MARGIN_LEFT + sIdx * STRING_SPACING;
    
    if (pos.muted) {
      // Draw X for muted
      const size = 10;
      svg.appendChild(el('line', {
        x1: x - size, y1: MARGIN_TOP - 30,
        x2: x + size, y2: MARGIN_TOP - 10,
        stroke: feedback === 'wrong' ? '#f44336' : (feedback === 'correct' ? '#4caf50' : '#8892a4'),
        'stroke-width': '3'
      }));
      svg.appendChild(el('line', {
        x1: x + size, y1: MARGIN_TOP - 30,
        x2: x - size, y2: MARGIN_TOP - 10,
        stroke: feedback === 'wrong' ? '#f44336' : (feedback === 'correct' ? '#4caf50' : '#8892a4'),
        'stroke-width': '3'
      }));
    } else if (pos.fret === 0) {
      // Draw O for open
      svg.appendChild(el('circle', {
        cx: x, cy: MARGIN_TOP - 20, r: '8',
        fill: 'none',
        stroke: feedback === 'wrong' ? '#f44336' : (feedback === 'correct' ? '#4caf50' : '#8892a4'),
        'stroke-width': '3'
      }));
    } else {
      // Draw Dot for fretted
      const y = MARGIN_TOP + (pos.fret - 0.5) * FRET_SPACING;
      let dotFill = '#f5a623';
      if (feedback === 'correct') dotFill = '#4caf50';
      if (feedback === 'wrong') dotFill = '#f44336';
      
      svg.appendChild(el('circle', {
        cx: x, cy: y, r: '12',
        fill: dotFill
      }));
    }
  });

  // 5. Render Reference Ghosting (if wrong)
  if (feedback === 'wrong' && referencePositions) {
    referencePositions.forEach(ref => {
      // Only show if user didn't get it right
      const userMatch = userPositions.find(up => up.string === ref.string && up.fret === ref.fret && up.muted === ref.muted);
      if (!userMatch) {
        const sIdx = 6 - ref.string;
        const x = MARGIN_LEFT + sIdx * STRING_SPACING;
        
        if (ref.muted) {
          const size = 8;
          svg.appendChild(el('line', {
            x1: x - size, y1: MARGIN_TOP - 30,
            x2: x + size, y2: MARGIN_TOP - 10,
            stroke: '#8892a4', opacity: '0.5', 'stroke-width': '2'
          }));
          svg.appendChild(el('line', {
            x1: x + size, y1: MARGIN_TOP - 30,
            x2: x - size, y2: MARGIN_TOP - 10,
            stroke: '#8892a4', opacity: '0.5', 'stroke-width': '2'
          }));
        } else if (ref.fret === 0) {
          svg.appendChild(el('circle', {
            cx: x, cy: MARGIN_TOP - 20, r: '6',
            fill: 'none', stroke: '#8892a4', opacity: '0.5', 'stroke-width': '2'
          }));
        } else {
          const y = MARGIN_TOP + (ref.fret - 0.5) * FRET_SPACING;
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
