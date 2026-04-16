import { registerExercise } from '../../exerciseRegistry.js';
import { generateBars, getFilteredNotes, getTimeSignatureConfig } from './sheetMusicLogic.js';
import { renderScore }  from './sheetMusicSVG.js';
import { PlaybackController } from './playbackController.js';
import { PlaybackBar } from './playbackBar.js';
import { wireStringToggles, syncStringToggles, wireFretSlider, syncFretSlider } from '../../utils/settings.js';

const LS_BPM     = 'sheetMusic_bpm';
const LS_TIMESIG = 'sheetMusic_timeSig';
const LS_TAB     = 'sheetMusic_showTab';

export function createSheetMusicExercise() {
  let wired = false;

  let state = {
    bars:    [],
    showTab: localStorage.getItem(LS_TAB) === 'true',
    bpm:     parseInt(localStorage.getItem(LS_BPM), 10) || 80,
    timeSig: localStorage.getItem(LS_TIMESIG) || '4/4',
    settings: {
      maxFret: 3,
      activeStrings: [0, 1, 2, 3, 4, 5],
    },
  };

  // ── Playback state ──────────────────────────────────────────────────────
  const playback    = new PlaybackController();
  const playbackBar = new PlaybackBar();
  let   isPlaying   = false;

  function getNotesPool() {
    return getFilteredNotes(state.settings.maxFret, state.settings.activeStrings);
  }

  function getTimeSigConfig() {
    return getTimeSignatureConfig(state.timeSig) || getTimeSignatureConfig('4/4');
  }

  // ── Score rendering ─────────────────────────────────────────────────────
  function regenerate() {
    const config = getTimeSigConfig();
    state.bars = generateBars(4, config.beatsPerBar, getNotesPool());

    const result = renderScore(
      document.getElementById('score-container'),
      state.bars,
      state.showTab,
    );

    // Rebuild the playback bar overlay over the new notation SVG
    if (result?.notationDiv && result?.staveLayout) {
      playbackBar.render(result.notationDiv, result.staveLayout);
      if (!isPlaying) playbackBar.hide();
    }
  }

  // ── Playback control ────────────────────────────────────────────────────
  function startPlayback() {
    if (isPlaying) return;
    isPlaying = true;

    const btn = document.getElementById('btn-sheet-play');
    if (btn) { btn.textContent = '⏹ Stop'; btn.classList.add('active'); }

    const config = getTimeSigConfig();
    const totalBeats = 4 * config.beatsPerBar; // 4 bars

    playback.onBeat(({ barIndex, beatIndex }) => {
      const secondsPerBeat = 60 / state.bpm;
      playbackBar.moveToBeat(barIndex, beatIndex, config.beatsPerBar, secondsPerBeat);
    });

    playbackBar.show();
    playback.start(state.bpm, config.beatsPerBar, totalBeats);
  }

  function stopPlayback() {
    if (!isPlaying) return;
    isPlaying = false;
    playback.stop();
    playbackBar.hide();

    const btn = document.getElementById('btn-sheet-play');
    if (btn) { btn.textContent = '▶ Play'; btn.classList.remove('active'); }
  }

  function togglePlayback() {
    if (isPlaying) stopPlayback(); else startPlayback();
  }

  // ── Settings sync ───────────────────────────────────────────────────────
  function syncSettingsUI() {
    const slider = document.getElementById('sheet-music-fret-range-slider');
    const label  = document.getElementById('sheet-music-fret-range-label');
    syncFretSlider(slider, label, state.settings.maxFret);
    syncStringToggles(
      document.querySelectorAll('#sheet-music-string-toggles .btn-string'),
      state.settings.activeStrings,
    );

    const bpmSlider = document.getElementById('sheet-music-bpm-slider');
    const bpmLabel  = document.getElementById('sheet-music-bpm-label');
    if (bpmSlider) bpmSlider.value = String(state.bpm);
    if (bpmLabel)  bpmLabel.textContent = String(state.bpm);

    const timeSigSel = document.getElementById('sheet-music-time-sig');
    if (timeSigSel) timeSigSel.value = state.timeSig;

    const showTabBtn = document.getElementById('btn-show-tab');
    if (showTabBtn) showTabBtn.classList.toggle('active', state.showTab);
  }

  // ── Exercise lifecycle ──────────────────────────────────────────────────
  function startExercise() {
    regenerate();

    if (!wired) {
      // New bars
      document.getElementById('btn-new-bars').addEventListener('click', () => {
        stopPlayback();
        regenerate();
      });

      // Tab toggle
      document.getElementById('btn-show-tab').addEventListener('click', () => {
        state.showTab = !state.showTab;
        localStorage.setItem(LS_TAB, String(state.showTab));
        document.getElementById('btn-show-tab')
          .classList.toggle('active', state.showTab);
        renderScore(
          document.getElementById('score-container'),
          state.bars,
          state.showTab,
        );
      });

      // Play / Stop
      document.getElementById('btn-sheet-play').addEventListener('click', togglePlayback);

      // BPM slider
      const bpmSlider = document.getElementById('sheet-music-bpm-slider');
      const bpmLabel  = document.getElementById('sheet-music-bpm-label');
      bpmSlider.addEventListener('input', () => {
        state.bpm = parseInt(bpmSlider.value, 10);
        if (bpmLabel) bpmLabel.textContent = String(state.bpm);
        localStorage.setItem(LS_BPM, String(state.bpm));
        playback.setBpm(state.bpm);
      });

      // Time signature selector
      document.getElementById('sheet-music-time-sig').addEventListener('change', e => {
        state.timeSig = e.target.value;
        localStorage.setItem(LS_TIMESIG, state.timeSig);
        stopPlayback();
        regenerate();
      });

      // Fret range slider
      const slider = document.getElementById('sheet-music-fret-range-slider');
      const label  = document.getElementById('sheet-music-fret-range-label');
      wireFretSlider(slider, label, state.settings, () => { stopPlayback(); regenerate(); });

      // String toggles
      wireStringToggles(
        document.querySelectorAll('#sheet-music-string-toggles .btn-string'),
        state.settings.activeStrings,
        () => { syncSettingsUI(); stopPlayback(); regenerate(); },
      );

      wired = true;
    }

    syncSettingsUI();
  }

  function stopExercise() {
    stopPlayback();
  }

  return { startExercise, stopExercise };
}

// ── Self-registration ─────────────────────────────────────────────────────────
const sheetMusicExercise = createSheetMusicExercise();
registerExercise('sheetMusic', {
  viewId:    'view-sheet-music',
  btnStartId: 'btn-start-sheet-music',
  btnBackId:  'btn-back-sheet-music',
  start: sheetMusicExercise.startExercise,
  stop:  sheetMusicExercise.stopExercise,
});
