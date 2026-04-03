# GuitarTools – Guitar Learning App

A static web app for learning guitar, running directly on GitHub Pages without a build step.

## Technology

- **Vanilla HTML + CSS + JavaScript** (ES Modules, no framework)
- **SVG** for fretboard rendering
- **Web Components** for reusable UI elements
- **Dark theme** via CSS Custom Properties

## Project Structure

```
index.html          – Main HTML, contains all views (#view-menu, #view-fretboard, #view-tuner)
style.css           – Global styles and CSS Custom Properties
version.txt         – Version text shown on the main menu (format: `Version YYYY-MM-DD HH:MM`); update on each change
js/
├── app.js          – View navigation (menu ↔ exercises/tools); imports components/index.js
├── components/     – Reusable Web Components (UI layer)
│   ├── index.js    – Registers all custom elements (imported once from app.js)
│   └── fretboard/
│       ├── gt-fretboard.js         – <gt-fretboard> Web Component
│       └── gt-fretboard-render.js  – Pure SVG render function (no state)
├── games/          – Self-contained interactive games/exercises
│   └── fretboardToneRecognition/
│       ├── fretboardExercise.js  – Exercise state & DOM interaction
│       ├── fretboardLogic.js     – Pure note calculation utilities
│       ├── fretboardSVG.js       – SVG fretboard rendering (legacy, not yet migrated)
│       └── CLAUDE.md
│   └── tonFinder/
│       ├── tonFinder.js       – Game controller; uses <gt-fretboard>
│       ├── tonFinderLogic.js  – Pure tone-position and scoring logic
│       ├── tonFinderSVG.js    – Legacy SVG renderer (kept for reference)
│       └── CLAUDE.md
└── tools/          – Standalone tools (no scoring, utility-focused)
    └── guitarTuner/
        ├── guitarTuner.js  – Main controller, mic access, audio loop
        ├── tunerLogic.js   – Pitch detection, frequency→note utilities
        ├── tunerSVG.js     – SVG gauge rendering
        └── CLAUDE.md
```

## Architecture

The app has four layers:

1. **Navigation** (`js/app.js`): Controls which view is visible, calls `startExercise()` / `stopExercise()`.
2. **Games/Tools** (`js/games/*`, `js/tools/*`): State + flow control. All game-specific code lives in its own subfolder.
3. **UI Components** (`js/components/*`): Reusable Web Components (custom elements) for shared UI elements like the fretboard.
4. **Logic** (`*Logic.js`): Pure functions with no DOM/audio dependencies; fully unit-tested.

Views are shown/hidden via the `.active` CSS class. No router needed.

## `<gt-fretboard>` Web Component

The primary reusable UI component. Used in **tonFinder** (Phase 1); other features follow in later phases.

### Public API

**Attributes / reflected properties:**
- `frets` — `number` — Highest fret to display (default: `5`)
- `interactive` — `boolean` — If present, position circles are clickable

**JS-only properties** (set programmatically; not suitable as HTML attributes):
- `positions` — `Array<{ stringIndex: number, fret: number, state?: string }>` — Marked positions. `state` can be `'selected'`, `'correct'`, `'wrong'`, or `'missed'`
- `activeStrings` — `number[]` — Active string indices; 0 = low E, 5 = high E (default: all 6)

**Events:**
- `fret-select` — dispatched when user clicks a position circle (requires `interactive`).  
  `event.detail`: `{ stringIndex: number, fret: number, note: string }`

### Example usage

```html
<gt-fretboard id="my-board" frets="7" interactive></gt-fretboard>
```

```js
const board = document.getElementById('my-board');
board.activeStrings = [0, 1, 2];
board.positions = [{ stringIndex: 1, fret: 3, state: 'selected' }];
board.addEventListener('fret-select', e => {
  console.log(e.detail); // { stringIndex, fret, note }
});
```

### Phase rollout

| Phase | Feature migrated |
|-------|-----------------|
| ✅ Phase 1 | `tonFinder` |
| ⬜ Phase 2 | `fretboardToneRecognition` |
| ⬜ Phase 3 | Shared controls (`gt-toggle-group`, `gt-slider`) |

## Runtime Settings

- **Frets:** Slider 0–12 (default: up to fret 4)
- **Strings:** Toggle buttons E2–E4, at least 1 must remain active
- **Attempts:** 3 chances per note
- **Menu Footer:** "Neu laden" button and app version are shown in the menu footer above the Impressum block

## GitHub Pages

Branch `claude/guitar-learning-app-i9WM3`, root `/` — no build pipeline needed.

## AI Collaboration & Documentation

**IMPORTANT FOR ALL AGENTS (Claude, Gemini, Codex):**
- **Update .md files:** After completing a task or implementing a feature, you MUST update all relevant `.md` files (this `CLAUDE.md`, `GEMINI.md`, and any plans in `plans/`).
- **Update `version.txt`:** After every code/content change, you MUST update `/version.txt` so the main page shows the new version timestamp.
- **Service-Worker Assets pflegen:** Wenn neue lokale Assets/Module (JS, CSS, JSON, Icons, etc.) hinzukommen oder umbenannt werden, müssen sie in `sw.js` in die `ASSETS`-Liste aufgenommen werden.
- **Keep Plans Current:** If a feature from `plans/` is implemented, update the file to reflect the new state and next steps.
- **Ideen-Sammlung:** Weitere Tool- und Übungsideen werden in `plans/ideen.md` gepflegt.
- **Architecture:** Maintain the project's "Vanilla JS", Web Component, and SVG-focused architecture.
- **Analysis document:** Repository-wide initial analyses can be documented in `/codex.md`.

## CI & Testing

Phase 1 CI pipeline is active. Tests run on every push and pull request.

- **Run tests:** `npm test` (uses Vitest)
- **Run linter:** `npm run lint` (uses ESLint)
- **Test files:** `tests/unit/` — pure logic tests only, no DOM/audio
- **CI workflow:** `.github/workflows/ci.yml`
- **Current unit-test scope:** `fretboardLogic`, `tunerLogic`, `tonFinderLogic`, `akkordLogic`, `sheetMusicLogic`, `metronomeLogic`, `notePlayingLogic`
- **Current test count:** 67 passing Vitest tests (`tests/unit/**/*.test.js`)

When adding logic to `*Logic.js` files, add corresponding tests in `tests/unit/`.

## Adding a New Game

1. Create `js/games/myGame/` with `myGame.js` exporting `startExercise()` and `stopExercise()`
2. Add the view HTML to `index.html` (`<section id="view-my-game" class="view">`)
3. Wire navigation in `js/app.js`
4. Use `<gt-fretboard>` if a fretboard is needed (see API above)
5. Add a `CLAUDE.md` in the new folder
