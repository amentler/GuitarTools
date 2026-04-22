import {
  generateBars, getFilteredNotes, getTimeSignatureConfig,
  EndlessBarGenerator, calcScrollTarget,
} from './sheetMusicLogic.js';
import { renderScore, appendRow } from './sheetMusicSVG.js';
import { PlaybackController } from './playbackController.js';
import { PlaybackBar } from './playbackBar.js';
import { wireStringToggles, syncStringToggles, wireFretSlider, syncFretSlider } from '../../utils/settings.js';

const LS_BPM     = 'sheetMusic_bpm';
const LS_TIMESIG = 'sheetMusic_timeSig';
const LS_TAB     = 'sheetMusic_showTab';
const LS_ENDLESS = 'sheetMusic_endless';

// Number of bars per rendered row (matches the 4-bar VexFlow layout).
const BARS_PER_ROW = 4;
// How many rows ahead of the current position to keep pre-rendered.
const LOOKAHEAD_ROWS = 2;
// Minimum notes in the pool before showing the "too few notes" warning.
const MIN_POOL_SIZE = 3;

export function createSheetMusicExercise() {
  let wired = false;

  let state = {
    bars:    [],
    showTab: localStorage.getItem(LS_TAB) === 'true',
    bpm:     parseInt(localStorage.getItem(LS_BPM), 10) || 80,
    timeSig: localStorage.getItem(LS_TIMESIG) || '4/4',
    endless: localStorage.getItem(LS_ENDLESS) === 'true',
    settings: {
      maxFret: 3,
      activeStrings: [0, 1, 2, 3, 4, 5],
    },
  };

  // ── Playback state ──────────────────────────────────────────────────────
  const playback    = new PlaybackController();
  const playbackBar = new PlaybackBar(); // used in normal mode only
  let   isPlaying   = false;

  // ── Endless mode state ──────────────────────────────────────────────────
  let endlessGen       = null;
  let allRowDivs       = [];
  let allPlaybackBars  = [];
  let allStaveLayouts  = [];

  function getNotesPool() {
    return getFilteredNotes(state.settings.maxFret, state.settings.activeStrings);
  }

  function getTimeSigConfig() {
    return getTimeSignatureConfig(state.timeSig) || getTimeSignatureConfig('4/4');
  }

  // ── Pool warning ────────────────────────────────────────────────────────
  function updatePoolWarning() {
    const el = document.getElementById('sheet-music-pool-warning');
    if (el) el.hidden = getNotesPool().length >= MIN_POOL_SIZE;
  }

  // ── Score rendering (normal mode) ───────────────────────────────────────
  function regenerate() {
    updatePoolWarning();
    const config = getTimeSigConfig();
    state.bars = generateBars(BARS_PER_ROW, config.beatsPerBar, getNotesPool());

    const result = renderScore(
      document.getElementById('score-container'),
      state.bars,
      state.showTab,
      state.timeSig,
    );

    // Rebuild the playback bar overlay over the new notation SVG
    if (result?.notationDiv && result?.staveLayout) {
      playbackBar.render(result.notationDiv, result.staveLayout, result.vw);
      if (!isPlaying) playbackBar.hide();
    }
  }

  // ── Endless mode helpers ────────────────────────────────────────────────
  function appendEndlessRow() {
    const bars      = endlessGen.nextBatch(BARS_PER_ROW);
    const container = document.getElementById('score-container');
    const { notationDiv, staveLayout, rowDiv, vw } = appendRow(
      container, bars, state.showTab, state.timeSig,
    );
    const bar = new PlaybackBar();
    bar.render(notationDiv, staveLayout, vw);
    bar.hide();
    allRowDivs.push(rowDiv);
    allPlaybackBars.push(bar);
    allStaveLayouts.push(staveLayout);
  }

  function cleanupEndlessState() {
    allPlaybackBars.forEach(bar => bar.destroy());
    allRowDivs      = [];
    allPlaybackBars = [];
    allStaveLayouts = [];
    endlessGen      = null;
    const container = document.getElementById('score-container');
    if (container) {
      container.classList.remove('score-container--endless');
      container.scrollTop = 0;
    }
  }

  // ── BPM adjustment (used by keyboard shortcuts) ─────────────────────────
  function adjustBpm(delta) {
    const newBpm = Math.min(240, Math.max(40, state.bpm + delta));
    if (newBpm === state.bpm) return;
    state.bpm = newBpm;
    const bpmSlider = document.getElementById('sheet-music-bpm-slider');
    const bpmLabel  = document.getElementById('sheet-music-bpm-label');
    if (bpmSlider) bpmSlider.value = String(newBpm);
    if (bpmLabel)  bpmLabel.textContent = String(newBpm);
    localStorage.setItem(LS_BPM, String(newBpm));
    playback.setBpm(newBpm);
  }

  // ── Playback control – normal mode ──────────────────────────────────────
  function startPlayback() {
    if (isPlaying) return;
    isPlaying = true;

    const btn = document.getElementById('btn-sheet-play');
    if (btn) { btn.textContent = '⏹ Stop'; btn.classList.add('active'); }

    const config     = getTimeSigConfig();
    const totalBeats = BARS_PER_ROW * config.beatsPerBar;

    playback.onBeat(({ barIndex, beatIndex }) => {
      playbackBar.moveToBeat(barIndex, beatIndex, config.beatsPerBar);
    });

    playbackBar.show();
    playback.start(state.bpm, config.beatsPerBar, totalBeats);
  }

  // ── Playback control – endless mode ─────────────────────────────────────
  function startEndlessPlayback() {
    if (isPlaying) return;
    isPlaying = true;

    const btn = document.getElementById('btn-sheet-play');
    if (btn) { btn.textContent = '⏹ Stop'; btn.classList.add('active'); }

    const container = document.getElementById('score-container');
    container.innerHTML = '';
    container.classList.add('score-container--endless');

    // Reset endless state
    allRowDivs      = [];
    allPlaybackBars = [];
    allStaveLayouts = [];

    const config = getTimeSigConfig();
    endlessGen = new EndlessBarGenerator(config.beatsPerBar, getNotesPool());

    // Pre-render initial rows
    for (let i = 0; i < 1 + LOOKAHEAD_ROWS; i++) appendEndlessRow();

    // Show first row's playback bar
    allPlaybackBars[0].show();

    playback.onBeat(({ barIndex, beatIndex }) => {
      const rowIndex   = Math.floor(barIndex / BARS_PER_ROW);
      const barInRow   = barIndex % BARS_PER_ROW;

      // Show only the current row's playback bar
      allPlaybackBars.forEach((bar, i) => {
        if (i === rowIndex) bar.show(); else bar.hide();
      });

      // Move the playback bar within the current row
      if (allPlaybackBars[rowIndex]) {
        allPlaybackBars[rowIndex].moveToBeat(
          barInRow, beatIndex, config.beatsPerBar,
        );
      }

      // Auto-scroll when entering a new row
      if (barInRow === 0 && beatIndex === 0 && rowIndex > 0) {
        const rowDiv         = allRowDivs[rowIndex];
        const firstRowHeight = allRowDivs[0]?.offsetHeight || 240;
        if (rowDiv) {
          const scrollTarget = calcScrollTarget(
            rowIndex, firstRowHeight, container.clientHeight,
          );
          container.scrollTo({ top: scrollTarget, behavior: 'smooth' });
        }
      }

      // Pre-generate: ensure LOOKAHEAD_ROWS rows are rendered ahead
      while (allRowDivs.length <= rowIndex + LOOKAHEAD_ROWS) {
        appendEndlessRow();
      }
    });

    // 0 = no wrap (play forever)
    playback.start(state.bpm, config.beatsPerBar, 0);
  }

  function stopPlayback() {
    if (!isPlaying) return;
    isPlaying = false;
    playback.stop();

    if (state.endless) {
      cleanupEndlessState();
    } else {
      playbackBar.hide();
    }

    const btn = document.getElementById('btn-sheet-play');
    if (btn) { btn.textContent = '▶ Play'; btn.classList.remove('active'); }
  }

  function togglePlayback() {
    if (isPlaying) {
      stopPlayback();
      // After stopping endless mode, restore the normal 4-bar view
      if (state.endless) regenerate();
    } else {
      if (state.endless) startEndlessPlayback(); else startPlayback();
    }
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

    const endlessBtn = document.getElementById('btn-endless-mode');
    if (endlessBtn) endlessBtn.classList.toggle('active', state.endless);

    updatePoolWarning();
  }

  // ── Exercise lifecycle ──────────────────────────────────────────────────
  function mount() {
    regenerate();

    if (!wired) {
      // New bars
      document.getElementById('btn-new-bars').addEventListener('click', () => {
        stopPlayback();
        if (state.endless) cleanupEndlessState();
        regenerate();
      });

      // Tab toggle
      document.getElementById('btn-show-tab').addEventListener('click', () => {
        state.showTab = !state.showTab;
        localStorage.setItem(LS_TAB, String(state.showTab));
        document.getElementById('btn-show-tab')
          .classList.toggle('active', state.showTab);
        if (!isPlaying) {
          renderScore(
            document.getElementById('score-container'),
            state.bars,
            state.showTab,
            state.timeSig,
          );
        }
      });

      // Endless mode toggle
      document.getElementById('btn-endless-mode').addEventListener('click', () => {
        stopPlayback();
        if (state.endless) cleanupEndlessState();
        state.endless = !state.endless;
        localStorage.setItem(LS_ENDLESS, String(state.endless));
        document.getElementById('btn-endless-mode')
          .classList.toggle('active', state.endless);
        regenerate();
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
        if (state.endless) cleanupEndlessState();
        regenerate();
      });

      // Fret range slider
      const slider = document.getElementById('sheet-music-fret-range-slider');
      const label  = document.getElementById('sheet-music-fret-range-label');
      wireFretSlider(slider, label, state.settings, () => {
        stopPlayback();
        if (state.endless) cleanupEndlessState();
        regenerate();
      });

      // String toggles
      wireStringToggles(
        document.querySelectorAll('#sheet-music-string-toggles .btn-string'),
        state.settings.activeStrings,
        () => {
          syncSettingsUI();
          stopPlayback();
          if (state.endless) cleanupEndlessState();
          regenerate();
        },
      );

      // Keyboard shortcuts (scoped to active view)
      document.addEventListener('keydown', e => {
        if (!document.getElementById('view-sheet-music')?.classList.contains('active')) return;
        if (['INPUT', 'SELECT', 'TEXTAREA'].includes(e.target.tagName)) return;
        switch (e.code) {
          case 'Space':
            e.preventDefault();
            togglePlayback();
            break;
          case 'ArrowUp':
            e.preventDefault();
            adjustBpm(5);
            break;
          case 'ArrowDown':
            e.preventDefault();
            adjustBpm(-5);
            break;
          case 'KeyR':
            document.getElementById('btn-new-bars')?.click();
            break;
          case 'KeyT':
            document.getElementById('btn-show-tab')?.click();
            break;
          case 'KeyE':
            document.getElementById('btn-endless-mode')?.click();
            break;
        }
      });

      // Pause when the browser tab loses focus (avoids desync)
      document.addEventListener('visibilitychange', () => {
        if (document.hidden && isPlaying) {
          stopPlayback();
          if (state.endless) regenerate();
        }
      });

      wired = true;
    }

    syncSettingsUI();
  }

  function unmount() {
    stopPlayback();
    if (state.endless) cleanupEndlessState();
  }

  return {
    mount,
    unmount,
    startExercise: mount,
    stopExercise: unmount,
  };
}

export const createSheetMusicFeature = createSheetMusicExercise;
