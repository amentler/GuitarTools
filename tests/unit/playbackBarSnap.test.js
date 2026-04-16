// @vitest-environment jsdom
/**
 * PlaybackBar.moveToBeat – cursor timing tests.
 *
 * Bug: moveToBeat was setting `transition: x <duration>s linear` THEN
 * setting `x`, causing the cursor to animate FROM the previous beat's
 * position TO the new one.  The cursor was always one beat behind:
 *   beat 0 (accent) fired  →  cursor visually at beat 3 ("beat 4" to the user)
 *
 * Fix: cursor must snap to beat N's position the instant beat N fires.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { PlaybackBar, calcBeatX } from '../../js/games/sheetMusicReading/playbackBar.js';

const LAYOUT = [
  { noteStartX: 90,  noteEndX: 208 },
  { noteStartX: 218, noteEndX: 336 },
  { noteStartX: 346, noteEndX: 464 },
  { noteStartX: 474, noteEndX: 592 },
];

function makeContainer() {
  const div = document.createElement('div');
  document.body.appendChild(div);
  return div;
}

describe('PlaybackBar.moveToBeat – cursor snaps to current beat (no lag)', () => {
  let pb;
  let container;

  beforeEach(() => {
    pb = new PlaybackBar();
    container = makeContainer();
    pb.render(container, LAYOUT);
  });

  it('sets rect x to the exact position of the requested beat (RED: already passes for attribute)', () => {
    pb.moveToBeat(0, 0, 4, 0.5);
    const expected = calcBeatX(LAYOUT, 0, 0, 4);
    expect(Number(pb._rect.getAttribute('x'))).toBeCloseTo(expected);
  });

  it('cursor has no CSS transition delay when beat fires – snaps instead of animating from previous (RED: currently fails)', () => {
    // Move to beat 3 first (simulates end-of-bar state)
    pb.moveToBeat(0, 3, 4, 0.5);
    // Beat 0 (accent) fires – cursor must snap, not transition from beat 3
    pb.moveToBeat(0, 0, 4, 0.5);
    // transition should be 'none' so the cursor is visually at beat 0 immediately
    // Current code sets 'x 0.4s linear', which delays the visual by one beat
    expect(pb._rect.style.transition).toBe('none');
  });

  it('x attribute equals beat 2 position after moveToBeat(0, 2)', () => {
    pb.moveToBeat(0, 2, 4, 0.75);
    const expected = calcBeatX(LAYOUT, 0, 2, 4);
    expect(Number(pb._rect.getAttribute('x'))).toBeCloseTo(expected);
  });

  it('x attribute equals beat 0 of bar 1 after moveToBeat(1, 0)', () => {
    pb.moveToBeat(1, 0, 4, 0.5);
    const expected = calcBeatX(LAYOUT, 1, 0, 4);
    expect(Number(pb._rect.getAttribute('x'))).toBeCloseTo(expected);
  });

  it('x attribute is correct in 3/4 time for beat 2', () => {
    pb.moveToBeat(0, 2, 3, 0.5);
    const expected = calcBeatX(LAYOUT, 0, 2, 3);
    expect(Number(pb._rect.getAttribute('x'))).toBeCloseTo(expected);
  });
});
