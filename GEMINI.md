# Gemini Mandates - GuitarTools

As an AI agent working on this project, you MUST adhere to the following rules:

## 1. Documentation & Plan Updates
- **AFTER EVERY COMPLETED TASK**, you MUST update the corresponding `.md` files (plans in `plans/`, `CLAUDE.md`, or this `GEMINI.md`).
- Ensure that the project status, next steps, and architectural changes are accurately reflected in the documentation.
- If a plan in `plans/` was implemented, mark it as completed or update it with the next iteration.
- Store additional feature/tool ideas in `plans/ideen.md`.
- Repository-wide initial analyses can be documented in `/codex.md`.

## 2. Technical Standards
- **Vanilla Everything:** No frameworks, no build steps. Use ES Modules.
- **Web Components:** Use `js/components/` for reusable UI elements. Register them via `js/components/index.js`.
- **SVG for UI:** Prefer SVG for interactive components (fretboard, tuner, etc.).
- **Mobile First:** The UI must be responsive and touch-friendly.
- **PWA Ready:** Keep the Service Worker (`sw.js`) and manifest updated if new assets are added.
- **Testing:** Run `npm test` to execute unit tests. Add tests in `tests/unit/` for any logic in `*Logic.js` files.
- **Unit-Test Scope (current):** `fretboardLogic`, `tunerLogic`, `tonFinderLogic`, `akkordLogic`, `sheetMusicLogic`, `notePlayingLogic` (45 passing tests)

## 3. Workflow
- **Research -> Strategy -> Execution -> Validation**
- Always verify changes with tests or by checking the app's functionality in the browser context if possible.
- Update `CLAUDE.md` and `GEMINI.md` to reflect any new components or structure.

## Current Architecture (updated – Phase 1 Web Components)

Four layers:
1. **Navigation** (`js/app.js`) – imports `js/components/index.js`, then starts/stops games
2. **Games/Tools** (`js/games/*`, `js/tools/*`) – State + flow control
3. **UI Components** (`js/components/*`) – Reusable Web Components
4. **Logic** (`*Logic.js`) – Pure functions, fully unit-tested

### `<gt-fretboard>` Web Component (Phase 1)

Location: `js/components/fretboard/gt-fretboard.js`

**Attributes:** `frets` (number, default 5), `interactive` (boolean)

**JS Properties:** `positions` (`Array<{stringIndex, fret, state?}>`), `activeStrings` (`number[]`)

**Events:** `fret-select` → `{ stringIndex, fret, note }`

**Phase rollout:**
- ✅ Phase 1: `tonFinder` migrated to `<gt-fretboard>`
- ⬜ Phase 2: `fretboardToneRecognition` migration
- ⬜ Phase 3: Shared controls extraction

## Current Modules

- Game modules: `js/games/tonFinder/`, `js/games/fretboardToneRecognition/`, `js/games/akkordTrainer/`, `js/games/sheetMusicReading/`, `js/games/notePlayingExercise/`
- Tool modules: `js/tools/guitarTuner/`, `js/tools/metronome/`
- UI components: `js/components/fretboard/` (`gt-fretboard.js`, `gt-fretboard-render.js`)
- Logic modules with tests: `fretboardLogic`, `tunerLogic`, `tonFinderLogic`, `akkordLogic`, `sheetMusicLogic`, `notePlayingLogic`
