# Gemini Mandates - GuitarTools

As an AI agent working on this project, you MUST adhere to the following rules:

## 1. Documentation & Plan Updates
- **AFTER EVERY COMPLETED TASK**, you MUST update the corresponding `.md` files (plans in `plans/`, `CLAUDE.md`, or this `GEMINI.md`).
- **Automated Versioning:** A Git hook (`prepare-commit-msg`) automatically updates `/version.txt` with an incrementing version number (e.g., `0.3`), current timestamp, base hash, and commit title on every commit, unless it is already staged. Manual updates are still supported.

- **NO COMMIT WITHOUT VERSION UPDATE:** Every commit must include a `version.txt` update with a change-specific label (example: `Version 2026-04-21 20:40 | ton spielen layout update 3`).
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
- **Pre-Commit Mandate:** You MUST run `npm run lint` and `npm test` BEFORE committing any changes; if lint reports errors, fix them before committing. Committing code with failing tests is strictly prohibited.
- **Note-Recognition Fix:** Fixed ID mismatches for feedback elements in `sheetMusicMic`, `notePlaying`, and `akkordTrainer`. Added `audioCtx.resume()` to all audio-based exercises to ensure compatibility with standalone page loads.
- **Unit-Test Scope (current):** `fretboardLogic`, `tunerLogic`, `tonFinderLogic`, `akkordLogic`, `sheetMusicLogic`, `metronomeLogic`, `notePlayingLogic`, `appNavigationHistory`, `exerciseHeader`, `sheetMusicMicIntegration` (677 passing tests)

## 3. Workflow
- **Research -> Strategy -> Execution -> Validation**
- Always verify changes with tests or by checking the app's functionality in the browser context if possible.
- Update `CLAUDE.md` and `GEMINI.md` to reflect any new components or structure.

## Current Architecture (updated – Phase 1 Web Components)

Four layers:
1. **Navigation** (HTML Files) – navigation between main menu (`index.html`) and exercises/tools (e.g., `pages/exercises/*.html`) via standard links; `js/app.js` manages version display and menu initialization.
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
- ✅ Phase 2: `chordExercise` (old FFT version) removed in favor of `chordExerciseEssentia`
- ✅ Phase 2.5: Feedback visibility in `chordExerciseEssentia` improved (3s persistence)
- ✅ Phase 3: `fretboardToneRecognition` migrated to `<gt-fretboard>` (Bugfix: Note visibility on load fixed)
- ✅ Phase 4: [Shared controls extraction](plans/phase-4-shared-controls-plan-2026-04-25.md) & [Fretboard Unification](plans/fretboard-unification-plan-2026-04-26.md) completed. Unified all chord diagrams and fretboards into `<gt-fretboard>`.

## Current Modules

- Game modules: `js/games/tonFinder/`, `js/games/fretboardToneRecognition/`, `js/games/akkordTrainer/`, `js/games/sheetMusicReading/`, `js/games/notePlayingExercise/`, `js/games/sheetMusicMic/`, `js/games/chordExerciseEssentia/`, `js/games/akkordfolgenTrainer/`
- Tool modules: `js/tools/guitarTuner/`, `js/tools/metronome/`
- UI components: `js/components/fretboard/` (`gt-fretboard.js`, `gt-fretboard-render.js`)
- Logic modules with tests: `fretboardLogic`, `tunerLogic`, `tonFinderLogic`, `akkordLogic`, `sheetMusicLogic`, `metronomeLogic`, `notePlayingLogic`, `essentiaChordLogic`
- Shared utilities: `js/utils/chordDetectionUtils.js` (shared by `akkordfolgenTrainer` and `chordExerciseEssentia`)

## Guitar Tuner Detection Status

- `tunerLogic.detectPitch()` kombiniert YIN mit spektraler HPS-Prüfung für robustere Grundton-Erkennung.
- Tiefe Saiten profitieren von adaptiver Fenstergröße (`getAdaptiveFftSize`) und längerer Periodenabdeckung.
- Vorverarbeitung enthält Bandbegrenzung (Gitarrenbereich) und Attack-Dämpfung direkt nach Anschlag.
- Stabilisierung erfolgt mehrstufig: rolling median + Stabilitätsprüfung + Notenwechsel-Hysterese im Controller.
- **Warm-up Phase:** Anzeige wird erst nach 2 aufeinanderfolgenden gültigen Frames aktualisiert (`STABLE_CONFIRM_FRAMES`), um initiale Sprünge durch Transienten zu unterdrücken.
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
