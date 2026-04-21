import { calcFirstBarWidth } from '../sheetMusicReading/sheetMusicLogic.js';

export const SHEET_MIC_REST_BAR_W = 128;

/**
 * Computes bar widths and note-area width for the Sheet-Mic score layout.
 *
 * @param {number} barsLength
 * @param {number} tsw - Clef + time-signature width (bar 0 note start x)
 * @param {number} marginW - Bare stave leading margin (bars 1..N note start x)
 * @param {number} [restBarW=SHEET_MIC_REST_BAR_W]
 * @returns {{ firstBarW: number, actualVW: number, uniformNoteArea: number }}
 */
export function computeSheetMicLayout(barsLength, tsw, marginW, restBarW = SHEET_MIC_REST_BAR_W) {
  const firstBarW = calcFirstBarWidth(tsw, restBarW, marginW);
  const actualVW = firstBarW + (barsLength - 1) * restBarW;
  const uniformNoteArea = restBarW - marginW;
  return { firstBarW, actualVW, uniformNoteArea };
}
