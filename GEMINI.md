# Gemini Mandates - GuitarTools

As an AI agent working on this project, you MUST adhere to the following rules:

## 1. Documentation & Plan Updates
- **AFTER EVERY COMPLETED TASK**, you MUST update the corresponding `.md` files (plans in `plans/`, `CLAUDE.md`, or this `GEMINI.md`).
- **AFTER EVERY CODE/CONTENT CHANGE**, you MUST update `/version.txt` (format: `Version YYYY-MM-DD HH:MM`) so the main menu shows the current version.
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
- **Service-Worker Asset-Liste ist Pflicht:** Neue oder umbenannte lokale Assets/Module müssen immer in `sw.js` in `ASSETS` ergänzt werden, damit Reloads keinen veralteten Stand liefern.
- **Testing:** Run `npm test` to execute unit tests. Run `npm run lint` for ESLint checks. Add tests in `tests/unit/` for any logic in `*Logic.js` files.
- **Pre-Commit Mandate:** You MUST run `npm test` and ensure all tests pass BEFORE committing any changes. Committing code with failing tests is strictly prohibited.
- **Unit-Test Scope (current):** `fretboardLogic`, `tunerLogic`, `tonFinderLogic`, `akkordLogic`, `sheetMusicLogic`, `metronomeLogic`, `notePlayingLogic` (150 passing tests)

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

- Game modules: `js/games/tonFinder/`, `js/games/fretboardToneRecognition/`, `js/games/akkordTrainer/`, `js/games/sheetMusicReading/`, `js/games/notePlayingExercise/`, `js/games/sheetMusicMic/`
- Tool modules: `js/tools/guitarTuner/`, `js/tools/metronome/`
- UI components: `js/components/fretboard/` (`gt-fretboard.js`, `gt-fretboard-render.js`)
- Logic modules with tests: `fretboardLogic`, `tunerLogic`, `tonFinderLogic`, `akkordLogic`, `sheetMusicLogic` (incl. `getFilteredNotes` for fret/string selection), `metronomeLogic`, `notePlayingLogic`

## Guitar Tuner Detection Status

- `tunerLogic.detectPitch()` kombiniert YIN mit spektraler HPS-Prüfung für robustere Grundton-Erkennung.
- Tiefe Saiten profitieren von adaptiver Fenstergröße (`getAdaptiveFftSize`) und längerer Periodenabdeckung.
- Vorverarbeitung enthält Bandbegrenzung (Gitarrenbereich) und Attack-Dämpfung direkt nach Anschlag.
- Stabilisierung erfolgt mehrstufig: rolling median + Stabilitätsprüfung + Notenwechsel-Hysterese im Controller.
- **Warm-up Phase:** Anzeige wird erst nach 3 aufeinanderfolgenden gültigen Frames aktualisiert (`STABLE_CONFIRM_FRAMES`), um initiale Sprünge durch Transienten zu unterdrücken.
- **Temporal Aging & Silence Reset:** Frequenz-Historie verwirft Werte älter als 1000ms. Bei Stille > 300ms erfolgt ein kompletter Reset des "Gedächtnisses" (Historie, stabile Frequenz, Warm-up), um saubere Saitenwechsel zu ermöglichen.
- Analyseintervall ist 50 ms (20 Hz) mit rolling median über 5 Samples (~250 ms), damit das Stimmgerät reaktiv bleibt.

## Noten spielen – sheetMusicMic

- New exercise at `js/games/sheetMusicMic/` combining sheet-music display with microphone-based pitch recognition.
- **Easy mode:** wrong notes do not restart; user keeps playing until hitting correct note.
- **Hard mode:** 3 consecutive wrong-note frames restart the sequence from the beginning.
- **Correct notes turn green** via VexFlow `setStyle()` on `StaveNote`.
- Reuses `detectPitch`, `frequencyToNote`, `pushAndMedian` from `tunerLogic.js`; match streak = 3 frames.

## Note-Playing Exercise Status

- Staff notation in `notePlayingExercise` now uses guitar notation transposition (written +1 octave vs sounding pitch).
- Pitch detection/matching remains octave-accurate on the sounding pitch (`note+octave`).
- Sounding range check is covered in unit tests: open strings span E2–E4; full default exercise range up to fret 15 reaches G5.

## Menu UI Status

- Main menu footer now contains the "⟳ Neu laden" action and the app version text directly above the Impressum section.
