import { describe, it, expect } from 'vitest';
import { computeSheetMicLayout, SHEET_MIC_REST_BAR_W } from '../../js/games/sheetMusicMic/sheetMusicMicLayout.js';

describe('Sheet-Mic spacing', () => {
  it('computes bar 0 so its note area equals bars 1-3 note area', () => {
    const tsw = 90;
    const marginW = 10;
    const { firstBarW, uniformNoteArea } = computeSheetMicLayout(4, tsw, marginW, SHEET_MIC_REST_BAR_W);

    const bar0NoteArea = firstBarW - tsw;
    const otherBarNoteArea = SHEET_MIC_REST_BAR_W - marginW;

    expect(uniformNoteArea).toBe(otherBarNoteArea);
    expect(bar0NoteArea).toBe(otherBarNoteArea);
  });

  it('computes expected total virtual width for 4 bars', () => {
    const tsw = 90;
    const marginW = 10;
    const { firstBarW, actualVW } = computeSheetMicLayout(4, tsw, marginW, SHEET_MIC_REST_BAR_W);

    expect(firstBarW).toBe(208);
    expect(actualVW).toBe(592);
  });
});
