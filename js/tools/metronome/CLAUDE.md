# Metronome Tool

A precise metronome implementation using the Web Audio API.

## Architecture

- `metronomeLogic.js`: Core timing engine. Uses `setTimeout` for scheduling but relies on `AudioContext.currentTime` for precise audio events.
- `metronomeSVG.js`: Handles visual representation of beats.
- `metronome.js`: Controller that coordinates logic, visuals, and UI events.

## Key Features

- **High Precision**: Decouples UI timer from audio scheduling to avoid jitter.
- **Visual Feedback**: Syncs SVG animation with audio clicks.
- **Persistence**: Remembers BPM and time signature preferences in `localStorage`.
- **Dynamic Updates**: Allows changing BPM while running.

## Development

- To add a new sound, modify `scheduleNote` in `metronomeLogic.js`.
- To change the visualization, update `render` and `highlightBeat` in `metronomeSVG.js`.

## AI Collaboration & Documentation

**IMPORTANT FOR ALL AGENTS (Claude, Gemini, Codex):**
- **Update .md files:** After completing a task or implementing a feature, you MUST update all relevant `.md` files (root `CLAUDE.md`, root `GEMINI.md`, this `CLAUDE.md`, and any plans in `plans/`).
- **Keep Plans Current:** If a feature from `plans/` is implemented, update the file to reflect the new state and next steps.
- **Architecture:** Maintain the project's "Vanilla JS" and SVG-focused architecture.
