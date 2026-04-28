# Plan: Phase 6 – Dynamic Sheet Music

## Goal
Transform the "Noten lesen" (Sheet Music Reading) exercise from a static display into a dynamic, metronome-guided practice tool with a moving playhead and an endless mode.

## 1. Foundation: Metronome & Playback Logic
- **Standardized Integration**: Use `MetronomeLogic` within the `createSheetMusicReadingFeature` factory.
- **New Logic**: Create `js/games/sheetMusicReading/playbackLogic.js` to:
  - Map metronome beats to specific bars and note positions.
  - Calculate durations and timing for CSS-based animations.
  - Support multiple time signatures (2/4, 3/4, 4/4, 6/8).
- **Audio Session**: Ensure it uses `audioSessionService` for clean `AudioContext` management.

## 2. Visual Playhead (Moving Bar)
- **SVG Overlay**: Update `sheetMusicSVG.js` to render a vertical "playhead" bar.
- **Smooth Animation**: 
  - Use CSS transitions (`transition: x 0.5s linear`) to move the bar between notes.
  - Sync the transition duration with the current BPM.
- **Note Highlighting**: Add visual feedback (color/scale change) for the "active" note under the playhead.

## 3. Extended Notation Support
- **Flexible Time Signatures**: Update `sheetMusicLogic.js` and `sheetMusicSVG.js` to support:
  - 3/4 (3 beats, quarter notes).
  - 6/8 (2 groups of 3 eighth notes, including VexFlow beaming).
- **Settings Integration**: Add a time signature selector and BPM slider to the UI.

## 4. Endless Mode & Auto-Scrolling
- **Continuous Generation**: 
  - Extend `sheetMusicLogic.js` to allow appending new bars to the existing state without resetting.
  - Automatically generate new bars when the playhead approaches the end of the current view.
- **Auto-Scroll**:
  - Implement a scrollable container for the sheet music.
  - Use `container.scrollTo()` or CSS transforms to keep the active bar in the upper third of the viewport.
- **Virtualization**: (Optional/Refinement) Remove off-screen bars from the DOM to maintain performance during long sessions.

## 5. UI/UX Refinement
- **Standardized Layout**:
  - Ensure the page uses `<gt-exercise-header>`.
  - Use utility classes (`.u-hidden`, `.u-invisible`) for all visibility toggling.
  - Use German labels for UI and English for code.
- **State Persistence**: Save BPM, Time Signature, and Endless Mode toggle to `localStorage`.

## Execution Steps (TDD)
1. **Draft Logic**: Implement `playbackLogic.js` with 100% test coverage.
2. **Extend Generator**: Update `sheetMusicLogic.js` for new signatures and verify with unit tests.
3. **Enhance Rendering**: Add playhead and time-signature support to `sheetMusicSVG.js`.
4. **Endless Logic**: Implement the continuous bar buffer and scrolling.
5. **Page Smoke Test**: Add/Update `sheetMusicReadingPageSmoke.test.js` for the new lifecycle.

## Completion Criteria
- Metronome audio is perfectly synced with the visual playhead.
- User can practice in 4/4, 3/4, and 6/8 time.
- Endless mode provides a non-stop stream of notes without manual "refresh".
- All code follows Phase 5 conventions (English code, Factory pattern, no inline styles).
