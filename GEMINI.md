# Gemini Mandates - GuitarTools

As an AI agent working on this project, you MUST adhere to the following rules:

## 1. Documentation & Plan Updates
- **AFTER EVERY COMPLETED TASK**, you MUST update the corresponding `.md` files (plans in `plans/`, `CLAUDE.md`, or this `GEMINI.md`).
- **Automated Versioning:** The `pre-commit` hook automatically regenerates `/version.txt` with the next numeric version, current timestamp, base hash, and a staged-file summary when `/version.txt` is not already staged.
- **Hook-owned metadata:** The same hook also syncs `sw.js` `CACHE_VERSION` when `sw.js` is not already staged. Already staged metadata files are left unchanged.
- **NO COMMIT WITHOUT VERSION UPDATE:** Every normal commit will include the hook-generated `version.txt` update automatically; agents must not maintain that file by hand unless the commit intentionally owns metadata.
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
- **Testing:** Run `npm test` for unit tests (Vitest). Run `npm run test:e2e` for Playwright E2E tests (`tests/e2e/`, 23 specs, Chromium + fake mic). Run `npm run lint` for ESLint checks. Add unit tests in `tests/unit/` for `*Logic.js` files; add Playwright specs in `tests/e2e/` for browser/DOM/audio-pipeline flows that can't be unit-tested.
- **Architecture:** Follow the rules defined in [docs/architecture.md](docs/architecture.md).
- **Pre-Commit Mandate:** You MUST run `npm run lint` and `npm test` BEFORE committing any changes; if lint reports errors, fix them before committing. Committing code with failing tests is strictly prohibited.
- **Unit-Test Scope (current):** `fretboardLogic`, `tunerLogic`, `tonFinderLogic`, `akkordLogic`, `akkordData`, `sheetMusicLogic`, `metronomeLogic`, `notePlayingLogic`, `fastNoteMatcher`, `fastNoteMatcherAudio`, `fastNoteMatcherSequences`, `essentiaChordLogic`, `guitarOnsetDetector`, `guitarOnsetStrategies`, `onsetTaggerLogic`, `recordingsOverviewLogic`, `akkordfolgenTrainerController`, `chordExerciseEssentiaController`, `sheetMusicReadingController`, `metronomeController`, `guitarTunerController`, page-smoke tests for all 14 pages

## 3. Knowledge Graph (graphify)

This project has a graphify knowledge graph at `graphify-out/`. See `AGENTS.md` for the full usage guide.

- Read `graphify-out/GRAPH_REPORT.md` first for architecture questions (god nodes, community structure)
- Run `graphify update .` after code changes (AST-only, no API cost)
- Use `graphify query`, `graphify path`, `graphify explain` for cross-module questions instead of grep

## 4. Workflow
- **Research -> Strategy -> Execution -> Validation**
- Always verify changes with tests or by checking the app's functionality in the browser context if possible.
- Update `CLAUDE.md` and `GEMINI.md` to reflect any new components or structure.

## Current Architecture (updated – Phase 1 Web Components)

Four layers:
1. **Navigation** (HTML Files) – navigation between main menu (`index.html`) and `pages/[feature]/index.html` via standard links; `js/app.js` manages version display and menu initialization.
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
- ✅ Phase 3: `fretboardToneRecognition` migrated to `<gt-fretboard>`
- ✅ Phase 4: Shared controls extraction & Fretboard Unification — all chord diagrams and fretboards use `<gt-fretboard>`
- ✅ Phase 5: [Sharpening Conventions](plans/old/phase-5-conventions-plan-2026-04-26.md)

## Current Modules

**Games (7):** `tonFinder`, `fretboardToneRecognition`, `akkordTrainer`, `akkordfolgenTrainer`, `chordExerciseEssentia`, `sheetMusicReading`, `notePlayingExercise`

**Tools (7):** `guitarTuner`, `metronome`, `audioAnalyse`, `onsetTagger`, `chordRecorder`, `recordingsOverview`, `akkordUebersicht`

**UI Components:** `<gt-fretboard>` (`js/components/fretboard/`), `<gt-exercise-header>`, `<gt-menu-card>`

**Shared:** `js/shared/audio/` (mic, pitch, onset, Essentia, fastNoteMatcher, metronomeLogic), `js/shared/music/` (sheetMusicLogic), `js/shared/storage/`, `js/shared/debug/`, `js/shared/pwa/`

**Data:** `js/data/akkordData.js` (35 chords, 4 categories), `js/domain/` (chord catalog, fretboard mapping, detection logic)

**Utilities:** `js/utils/chordDetectionUtils.js` (shared by `akkordfolgenTrainer` + `chordExerciseEssentia`), `js/utils/settings.js`

## Guitar Tuner Detection Status

- `tunerLogic.detectPitch()` kombiniert YIN mit spektraler HPS-Prüfung für robustere Grundton-Erkennung.
- Tiefe Saiten profitieren von adaptiver Fenstergröße (`getAdaptiveFftSize`) und längerer Periodenabdeckung.
- Vorverarbeitung enthält Bandbegrenzung (Gitarrenbereich) und Attack-Dämpfung direkt nach Anschlag.
- Stabilisierung erfolgt mehrstufig: rolling median + Stabilitätsprüfung + Notenwechsel-Hysterese im Controller.
- **Warm-up Phase:** Anzeige wird erst nach 2 aufeinanderfolgenden gültigen Frames aktualisiert (`STABLE_CONFIRM_FRAMES`), um initiale Sprünge durch Transienten zu unterdrücken.
- **Temporal Aging & Silence Reset:** Frequenz-Historie verwirft Werte älter als 1000ms. Bei Stille > 300ms erfolgt ein kompletter Reset des "Gedächtnisses" (Historie, stabile Frequenz, Warm-up), um saubere Saitenwechsel zu ermöglichen.
- Analyseintervall ist 50 ms (20 Hz) mit rolling median über 5 Samples (~250 ms), damit das Stimmgerät reaktiv bleibt.

## Note-Playing Exercise Status

- Staff notation in `notePlayingExercise` now uses guitar notation transposition (written +1 octave vs sounding pitch).
- Pitch detection/matching remains octave-accurate on the sounding pitch (`note+octave`).
- Sounding range check is covered in unit tests: open strings span E2–E4; full default exercise range up to fret 15 reaches G5.

## Menu UI Status

- Main menu footer now contains the "⟳ Neu laden" action and the app version text directly above the Impressum section.
