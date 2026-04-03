# Plan: Metronome Tool (COMPLETED ✅)

Implementation of a precise metronome tool for the GuitarTools app.

## Status: Completed
- **Directory Structure:** Created `js/tools/metronome/` with `metronome.js`, `metronomeLogic.js`, `metronomeSVG.js`, and `CLAUDE.md`.
- **UI Components:** Added to `index.html` (Menu card + Metronome view).
- **Navigation:** Wired in `js/app.js`.
- **Implementation:** High-precision Web Audio API timing, SVG visuals, and BPM controls.
- **Verification:** Precision and UI responsiveness verified.

---

## AI Collaboration & Mandate

**IMPORTANT FOR ALL AGENTS (Claude, Gemini, Codex):**
- **Update .md files:** After completing a task or implementing a feature, you MUST update all relevant `.md` files (root `CLAUDE.md`, root `GEMINI.md`, this plan, and any other relevant documentation).
- **Keep Plans Current:** If this plan is part of an ongoing task, update the status and next steps after each work session.
- **Consistency:** Maintain the project's "Vanilla JS" and SVG-focused architecture.

---

## 1. Directory Structure

Create `js/tools/metronome/` with:
- `metronome.js`: Main controller, handles DOM events and state.
- `metronomeLogic.js`: Core timing logic using the Web Audio API.
- `metronomeSVG.js`: Visual feedback (pendulum or beat indicators).
- `CLAUDE.md`: Tool-specific documentation.

## 2. UI Components (`index.html`)

### Menu Card
Add a new `article.exercise-card` to `#view-menu`:
- Icon: ⏱️
- Title: Metronom
- Description: Verbessere dein Timing mit einem präzisen Metronom.
- Button: `btn-start-metronome`

### Metronome View
Add `<section id="view-metronome" class="view">`:
- Header with "Zurück zum Menü" button (`btn-back-metronome`).
- SVG Container for visual feedback (`metronome-display`).
- BPM Controls:
  - Large BPM display.
  - Slider (40–240 BPM).
  - +/- 1 and +/- 5 buttons for fine-tuning.
- Settings:
  - Time Signature selector (2/4, 3/4, 4/4, 6/8).
  - Volume slider.
- Main Action: Large "Start/Stop" button.

## 3. Navigation (`js/app.js`)

- Import `startExercise` and `stopExercise` from `./tools/metronome/metronome.js`.
- Add `metronome` to the `views` object.
- Update `navigateTo(name)` to handle the new view.
- Wire event listeners for `btn-start-metronome` and `btn-back-metronome`.

## 4. Implementation Details

### Timing Logic (`metronomeLogic.js`)
- Use **Web Audio API** for high-precision timing.
- Implement a "lookahead" scheduler (e.g., 25ms lookahead, scheduling sounds 50ms in advance) to ensure jitter-free playback even if the main thread is busy.
- Sounds: Use `OscillatorNode` with a short decay. High pitch for beat 1, lower pitch for other beats.
- State: `bpm`, `beatsPerMeasure`, `isPlaying`.

### Visuals (`metronomeSVG.js`)
- A simple, clean SVG animation.
- Option A: A horizontal row of dots representing the beats in a measure, highlighting the current beat.
- Option B: A classic metronome pendulum swinging left to right.
- Color coding: Accent color for beat 1, standard color for others.

### Controller (`metronome.js`)
- Manage `AudioContext` (must be resumed on user interaction).
- Sync the `metronomeLogic` state with the UI.
- Persistence: Save the last used BPM and Time Signature to `localStorage`.

## 5. Verification Plan

1. **Precision Check**: Compare the metronome against a hardware metronome or a reference app at various BPMs (60, 120, 200).
2. **Audio/Visual Sync**: Ensure the SVG animation triggers exactly with the audio click.
3. **Mobile Behavior**: Verify audio plays correctly on iOS/Android (handling the silent switch and backgrounding if possible, though PWA limitations apply).
4. **UI Responsiveness**: Ensure BPM changes are applied immediately or on the next beat without stopping the metronome.
