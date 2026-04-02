# GuitarTools – Guitar Learning App

A static web app for learning guitar, running directly on GitHub Pages without a build step.

## Technology

- **Vanilla HTML + CSS + JavaScript** (ES Modules, no framework)
- **SVG** for fretboard rendering
- **Dark theme** via CSS Custom Properties

## Project Structure

```
index.html          – Main HTML, contains all views (#view-menu, #view-fretboard, #view-tuner)
style.css           – Global styles and CSS Custom Properties
js/
├── app.js          – View navigation (menu ↔ exercises/tools)
├── games/          – Self-contained interactive games/exercises
│   └── fretboardToneRecognition/
│       ├── fretboardExercise.js  – Exercise state & DOM interaction
│       ├── fretboardLogic.js     – Pure note calculation utilities
│       ├── fretboardSVG.js       – SVG fretboard rendering
│       └── CLAUDE.md
└── tools/          – Standalone tools (no scoring, utility-focused)
    └── guitarTuner/
        ├── guitarTuner.js  – Main controller, mic access, audio loop
        ├── tunerLogic.js   – Pitch detection, frequency→note utilities
        ├── tunerSVG.js     – SVG gauge rendering
        └── CLAUDE.md
```

## Architecture

The app has two layers:

1. **Navigation** (`js/app.js`): Controls which view is visible, calls `startExercise()` / `stopExercise()`.
2. **Games** (`js/games/`): Each game manages its own state and DOM interaction. All game-specific code lives in its own subfolder.

Views are shown/hidden via the `.active` CSS class. No router needed.

## Runtime Settings

- **Frets:** Slider 0–12 (default: up to fret 4)
- **Strings:** Toggle buttons E2–E4, at least 1 must remain active
- **Attempts:** 3 chances per note

## GitHub Pages

Branch `claude/guitar-learning-app-i9WM3`, root `/` — no build pipeline needed.

## AI Collaboration & Documentation

**IMPORTANT FOR ALL AGENTS (Claude, Gemini, Codex):**
- **Update .md files:** After completing a task or implementing a feature, you MUST update all relevant `.md` files (this `CLAUDE.md`, `GEMINI.md`, and any plans in `plans/`).
- **Keep Plans Current:** If a feature from `plans/` is implemented, update the file to reflect the new state and next steps.
- **Architecture:** Maintain the project's "Vanilla JS" and SVG-focused architecture.

## Adding a New Game

1. Create `js/games/myGame/` with `myGame.js` exporting `startExercise()` and `stopExercise()`
2. Add the view HTML to `index.html` (`<section id="view-my-game" class="view">`)
3. Wire navigation in `js/app.js`
4. Add a `CLAUDE.md` in the new folder
