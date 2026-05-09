import { updateMatchState } from '../../shared/audio/fastNoteMatcher.js';

export const SHEET_MUSIC_CENTS_TOLERANCE = 70;
export const SHEET_MUSIC_ACCEPT_STREAK = 1;

function parsePitch(pitch) {
  const match = /^([A-G]#?)(-?\d+)$/.exec(pitch ?? '');
  if (!match) return null;
  return { name: match[1], octave: Number.parseInt(match[2], 10) };
}

export function softenSheetMusicFrameResult(frameResult, targetPitch) {
  if (frameResult.status === 'correct') return frameResult;
  if (frameResult.status !== 'wrong' || !frameResult.detectedPitch) return frameResult;

  const target = parsePitch(targetPitch);
  const detected = parsePitch(frameResult.detectedPitch);
  if (target && detected && target.name === detected.name && detected.octave === target.octave - 1) {
    return { ...frameResult, status: 'correct' };
  }
  return frameResult;
}

export function updateSheetMusicMatchState(matchState, frameResult) {
  if (SHEET_MUSIC_ACCEPT_STREAK <= 1 && frameResult.status === 'correct') {
    return {
      nextState: {
        ...matchState,
        correctStreak: 1,
        wrongStreak: 0,
        accepted: true,
      },
      event: 'accept',
    };
  }
  return updateMatchState(matchState, frameResult);
}
