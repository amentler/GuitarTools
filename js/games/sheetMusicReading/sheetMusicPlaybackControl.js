import { EndlessBarGenerator, ArpeggioBarGenerator } from './sheetMusicLogic.js';
import { updateBeatDot, clearBeatDots, setPlaybackButtonState } from './sheetMusicReadingUI.js';
import { saveSheetMusicBpm } from './sheetMusicReadingStorage.js';

const ENDLESS_VISIBLE_ROWS = 3;

export function createPlaybackControl({
  state, getUI, playback, playbackBar, endlessS,
  appendEndlessRow, clearEndlessShiftTimeout, shiftEndlessWindowToRow, cleanupEndlessState,
  getNotesPool, getTimeSigConfig, onTimedBeat, regenerate, BARS_PER_ROW,
}) {
  let isPlaying = false;

  function startPlayback() {
    if (isPlaying) return;
    isPlaying = true;
    const ui = getUI();
    setPlaybackButtonState(ui.playBtn, true);

    const config = getTimeSigConfig();
    const totalBeats = state.bars.length * config.beatsPerBar;

    playback.onBeat(({ barIndex, beatIndex, globalBeat }) => {
      if (state.active) onTimedBeat({ barIndex, beatIndex, globalBeat, totalBeats });
      playbackBar.moveToBeat(barIndex, beatIndex, config.beatsPerBar);
    });

    playback.onTick(({ beatIndex }) => updateBeatDot(getUI(), beatIndex));

    // Immediately snap cursor to the first note so it's visible during count-in.
    playbackBar.show();
    playbackBar.moveToBeat(0, 0, config.beatsPerBar);
    playback.start(state.bpm, config.beatsPerBar, totalBeats, config.beatsPerBar);
  }

  function startEndlessPlayback() {
    if (isPlaying) return;
    isPlaying = true;
    const ui = getUI();
    setPlaybackButtonState(ui.playBtn, true);

    const container = document.getElementById('score-container');
    container.innerHTML = '';
    container.classList.add('score-container--endless');

    endlessS.rowDivs = [];
    endlessS.playbackBars = [];
    endlessS.staveLayouts = [];
    endlessS.firstRowIndex = 0;
    clearEndlessShiftTimeout();

    const config = getTimeSigConfig();
    endlessS.gen = state.arpeggioMode
      ? new ArpeggioBarGenerator(config.beatsPerBar, getNotesPool(), state.settings.key)
      : new EndlessBarGenerator(config.beatsPerBar, getNotesPool());

    for (let i = 0; i < ENDLESS_VISIBLE_ROWS; i++) appendEndlessRow();

    endlessS.playbackBars[0].show();
    endlessS.playbackBars[0].moveToBeat(0, 0, config.beatsPerBar);

    playback.onBeat(({ barIndex, beatIndex }) => {
      const rowIndex = Math.floor(barIndex / BARS_PER_ROW);
      const barInRow = barIndex % BARS_PER_ROW;
      const visibleRowIndex = rowIndex - endlessS.firstRowIndex;

      endlessS.playbackBars.forEach((bar, i) => {
        if (i === visibleRowIndex) bar.show(); else bar.hide();
      });

      if (endlessS.playbackBars[visibleRowIndex]) {
        endlessS.playbackBars[visibleRowIndex].moveToBeat(barInRow, beatIndex, config.beatsPerBar);
      }

      if (barInRow === 0 && beatIndex === 0 && rowIndex > endlessS.firstRowIndex) {
        shiftEndlessWindowToRow(rowIndex);
      }
    });

    playback.onTick(({ beatIndex }) => updateBeatDot(getUI(), beatIndex));

    // 0 = no wrap (play forever)
    playback.start(state.bpm, config.beatsPerBar, 0, config.beatsPerBar);
  }

  function stopPlayback() {
    if (!isPlaying) return;
    isPlaying = false;
    playback.stop();
    clearBeatDots(getUI());

    if (state.endless) {
      cleanupEndlessState();
    } else {
      playbackBar.hide();
    }

    setPlaybackButtonState(getUI().playBtn, false);
  }

  function togglePlayback() {
    if (isPlaying) {
      stopPlayback();
      if (state.endless) regenerate();
    } else {
      if (state.endless && !state.active) startEndlessPlayback(); else startPlayback();
    }
  }

  function adjustBpm(delta) {
    const newBpm = Math.min(240, Math.max(40, state.bpm + delta));
    if (newBpm === state.bpm) return;
    state.bpm = newBpm;
    const ui = getUI();
    if (ui.bpmSlider) ui.bpmSlider.value = String(newBpm);
    if (ui.bpmLabel) ui.bpmLabel.textContent = String(newBpm);
    saveSheetMusicBpm(newBpm);
    playback.setBpm(newBpm);
  }

  return {
    startPlayback,
    startEndlessPlayback,
    stopPlayback,
    togglePlayback,
    adjustBpm,
    isPlaying: () => isPlaying,
  };
}
