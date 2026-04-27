# GuitarTools – Guitar Learning App

A static web app for learning guitar, running directly on GitHub Pages without a build step.

## Technology

- **Vanilla HTML + CSS + JavaScript** (ES Modules, no framework)
- **SVG** for fretboard rendering
- **Web Components** for reusable UI elements
- **Dark theme** via CSS Custom Properties

## Project Structure

```
index.html          – Main menu / landing page
style.css           – Global styles and CSS Custom Properties
version.txt         – Version text shown on the main menu (format: `Version YYYY-MM-DD HH:MM | label`); update on each change
pages/
├── exercises/      – Individual HTML pages for exercises (e.g., ton-finder.html)
└── tools/          – Individual HTML pages for tools (e.g., guitar-tuner.html)
js/
├── app.js          – Main menu controller; imports components/index.js
├── data/           – Shared data (Single Source of Truth)
│   └── akkordData.js – All 23 chord definitions with finger data + validateFingerData()
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

1. **Navigation**: Standard HTML links between `index.html` and `pages/exercises/*.html` or `pages/tools/*.html`. `js/app.js` initializes the menu and version info.
2. **Games/Tools** (`js/games/*`, `js/tools/*`): State + flow control. Standardized factory pattern: `export function create[FeatureName]Feature()`.
3. **UI Components** (`js/components/*`): Reusable Web Components (custom elements).
4. **Logic** (`*Logic.js`): Pure functions; fully unit-tested (100% coverage goal).

Detailed architecture rules are in [docs/architecture.md](docs/architecture.md).

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
| ✅ Phase 2 | `chordExerciseEssentia` |
| ✅ Phase 3 | `fretboardToneRecognition` |
| ✅ Phase 4 | Shared controls extraction & Fretboard Unification |
| ✅ Phase 5 | [Sharpening Conventions](plans/old/phase-5-conventions-plan-2026-04-26.md) |

## Runtime Settings

- **Frets:** Slider 0–12 (default: up to fret 4)
- **Strings:** Toggle buttons E2–E4, at least 1 must remain active
- **Attempts:** 3 chances per note
- **Menu Footer:** "Neu laden" button and app version are shown in the menu footer above the Impressum block
- **Ton spielen (Notation):** Staff notation follows guitar convention (written one octave above sounding pitch); pitch matching remains based on the actual sounding octave

## GitHub Pages

Branch `claude/guitar-learning-app-i9WM3`, root `/` — no build pipeline needed.

## AI Collaboration & Documentation

**IMPORTANT FOR ALL AGENTS (Claude, Gemini, Codex):**
- **Update .md files:** After completing a task or implementing a feature, you MUST update all relevant `.md` files (this `CLAUDE.md`, `GEMINI.md`, and any plans in `plans/`). If a module subfolder (e.g. `js/games/myGame/`) does not yet have a `CLAUDE.md`, create one — this is explicitly permitted and encouraged.
- **Update `version.txt`:** After every code/content change, you MUST update `/version.txt` with format `Version YYYY-MM-DD HH:MM | label` (example: `Version 2026-04-21 20:40 | ton spielen layout update 3`).
- **No Commit Without Version Bump:** Every commit must include an updated `version.txt` entry that matches the current change scope.
- **Service-Worker Assets pflegen:** Wenn neue lokale Assets/Module (JS, CSS, JSON, Icons, etc.) hinzukommen oder umbenannt werden, müssen sie in `sw.js` in die `ASSETS`-Liste aufgenommen werden.
- **Keep Plans Current:** If a feature from `plans/` is implemented, update the file to reflect the new state and next steps.
- **Ideen-Sammlung:** Weitere Tool- und Übungsideen werden in `plans/ideen.md` gepflegt.
- **Architecture:** Maintain the project's "Vanilla JS", Web Component, and SVG-focused architecture.
- **Analysis document:** Repository-wide initial analyses can be documented in `/codex.md`.

## CI & Testing

Phase 1 CI pipeline is active. Tests run on every push and pull request.

- **Run tests:** `npm test` (uses Vitest)
- **Run linter:** `npm run lint` (uses ESLint)
- **Pre-Commit Mandate:** Run `npm run lint` before every commit; if lint errors occur, fix them before committing.
- **Test files:** `tests/unit/` — pure logic tests only, no DOM/audio
- **CI workflow:** `.github/workflows/ci.yml`
- **Current unit-test scope:** `fretboardLogic`, `tunerLogic`, `tonFinderLogic`, `akkordLogic`, `akkordData`, `sheetMusicLogic`, `metronomeLogic`, `notePlayingLogic`, `fastNoteMatcher`, `fastNoteMatcherAudio` (WAV fixtures), `fastNoteMatcherSequences` (sequence WAV+JSON fixtures)
- **Current test count:** 379 passing Vitest tests (`tests/unit/**/*.test.js`, plus 1 skipped E4-octave case blocked by the tuner's max frequency)

### Tuner Fixture Tests – Zwei Testansätze

Two complementary approaches test pitch detection quality in `tests/unit/tunerAudio.test.js`:

#### Ansatz 1: Gitarren-Aufnahmen (Note + Oktave)

Real guitar recordings placed in note-named subfolders. Each `.wav` file automatically becomes a test case. Two sub-pools:

| Folder | Prüfung | Zweck |
|---|---|---|
| `tests/fixtures/audio/{Note}/` | Note + Oktave korrekt | Gut gestimmte Aufnahmen |
| `tests/fixtures/audio-imprecise/{Note}/` | Note + Oktave korrekt (Präzision nicht getestet) | Leicht verstimmte Aufnahmen, die als Regressionstests für die Note-Erkennung dienen |

**Folder convention:** Folder name = Note + Octave (e.g. `E2`, `A2`, `D3`, `G3`, `B3`, `E4`).  
**File format:** WAV, uncompressed PCM 16-bit or 32-bit float, 44100 or 48000 Hz, ≥ 1 second, mono or stereo.

#### Ansatz 2: Synthetische Sinuswellen (Note + Oktave + ≤ 5 Cent Präzision)

Generated sine wave WAVs covering the full chromatic range E2–C5 (33 notes). These test algorithmic precision of the pitch detection pipeline.

```
tests/fixtures/synth/
  E2/synth.wav   ← 82.41 Hz sine, 44100 Hz, 1 sec
  F2/synth.wav   ← 87.31 Hz sine
  ...
  C5/synth.wav   ← 523.25 Hz sine
```

To regenerate: `node --input-type=module` with the generation script in the commit history, or re-run the pattern from `tests/unit/tunerAudio.test.js` setup comments.

**Test helpers:**
- `tests/helpers/wavDecoder.js` — `decodeWav(buffer)` / `readWavFile(path)`: WAV → Float32Array
- `tests/helpers/audioFixtureRunner.js` — `getAudioFixtures(dir)` / `detectNoteFromSamples(samples, sr)`: multi-window pitch detection via `detectPitch`; returns `{ note, octave, cents, hz }`

When no WAV files are present in a folder, the corresponding test suite is skipped (no CI failure).

When adding logic to `*Logic.js` files, add corresponding tests in `tests/unit/`.

## Current Modules

- Game modules: `js/games/tonFinder/`, `js/games/fretboardToneRecognition/`, `js/games/akkordTrainer/`, `js/games/sheetMusicReading/`, `js/games/notePlayingExercise/`, `js/games/sheetMusicMic/`
- Tool modules: `js/tools/guitarTuner/`, `js/tools/metronome/`
- Data modules: `js/data/akkordData.js` (chord definitions with finger data)
- UI components: `js/components/fretboard/` (`gt-fretboard.js`, `gt-fretboard-render.js`)

## Noten spielen (sheetMusicMic)

New exercise combining "Noten lesen" (sheet music) with microphone-based note recognition (like "Ton spielen").

- **Location:** `js/games/sheetMusicMic/`
  - `sheetMusicMicExercise.js` — Main controller; start button, audio pipeline, mode logic
  - `sheetMusicMicSVG.js` — VexFlow rendering with per-note colour based on status
  - `fastNoteMatcher.js` — Pure target-aware matcher (buffer-size guard, frame classification, streak state machine). Shared with `notePlayingExercise` to fix the legacy 2048-sample E2 bug.
- **Mode: Einfach (easy)** — wrong notes do not penalise; keep playing until correct note lands
- **Mode: Schwer (hard)** — 3 consecutive wrong-note frames restart the sequence from the beginning
- **Note colours:** `current` → orange, `correct` → green, `pending` → default theme colour
- **Pitch detection:** delegated to `fastNoteMatcher.classifyFrame` (full-range `detectPitch` with `getMinSamplesFor` guard) and `updateMatchState` (FAST_ACCEPT_STREAK = 2, FAST_REJECT_STREAK = 3, ±35 cent). Controllers call `getRecommendedFftSize` whenever the target changes so low-string targets get a ≥ 4096-sample window instead of the broken 2048.

## Adding a New Game

1. Create `js/games/myGame/` with `myGame.js` exporting `createMyGameExercise()`
2. Create `pages/exercises/my-game.html` that:
   - Links to `../../style.css`
   - Includes `<gt-exercise-header>`
   - Imports `../../js/components/index.js`
   - Imports and initializes your exercise from `../../js/games/myGame/myGame.js`
3. Add a `<gt-menu-card>` to `index.html` pointing to `pages/exercises/my-game.html`
4. Add a `CLAUDE.md` in the new game folder
