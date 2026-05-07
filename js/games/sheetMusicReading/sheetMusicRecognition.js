import { updateMatchState } from '../../shared/audio/fastNoteMatcher.js';

export const SHEET_MUSIC_CENTS_TOLERANCE = 70;
export const SHEET_MUSIC_ACCEPT_STREAK = 1;

function getPitchClass(pitch) {
  return /^([A-G]#?)-?\d+$/.exec(pitch ?? '')?.[1] ?? null;
}

export function softenSheetMusicFrameResult(frameResult, targetPitch) {
  if (frameResult.status === 'correct') return frameResult;
  if (frameResult.status !== 'wrong' || !frameResult.detectedPitch) return frameResult;

  const targetClass = getPitchClass(targetPitch);
  const detectedClass = getPitchClass(frameResult.detectedPitch);
  if (targetClass && targetClass === detectedClass) {
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
