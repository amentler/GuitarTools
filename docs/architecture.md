# GuitarTools Architecture Guide

Last Updated: 2026-05-21

## 1. Goal
GuitarTools is a modular Multi-Page Application (MPA). Each exercise or tool is a self-contained feature that can be mounted into a target DOM element.

## 2. Layer Model

```
Pages (pages/)
  ↓
Features (js/games/ + js/tools/)       ← Controller layer
  ↓
Components (js/components/)            ← Web Components (stateless or UI-only state)
  ↓
Domain Logic (js/domain/ + *Logic.js)  ← Pure functions, 100% tested
  ↓
Shared (js/shared/)                    ← Audio, Storage, PWA, Debug
  ↓
Utils (js/utils/)                      ← Generic helpers
```

- **Pages (`pages/`)**: Entry points. Minimal logic in `bootstrap.js`.
- **Games (`js/games/`)**: Complex interactive exercises with state management and flow control.
- **Tools (`js/tools/`)**: Utility applications (Metronome, Tuner, Recorder, etc.). Same lifecycle API as Games. File size limit: < 300 lines per controller.
- **UI Components (`js/components/`)**: Reusable Web Components. Stateless or minimal UI-only state.
- **Domain Logic (`js/domain/`)**: Canonical pure functions and data structures. **100% unit test coverage required.** Feature-local `*Logic.js` files are acceptable when the logic is tightly coupled to that feature; they must still be fully tested.
- **Shared (`js/shared/`)**: Cross-cutting concerns like Audio, Storage, PWA, Debug.
- **Utils (`js/utils/`)**: Generic helper functions with no domain knowledge.

### Domain Logic placement policy

Feature-local `*Logic.js` files (e.g., `js/games/akkordfolgenTrainer/akkordfolgenLogic.js`) are **acceptable** and do not need to be moved to `js/domain/`. The rule is: if logic is reused by more than one feature, it belongs in `js/domain/`. If it belongs exclusively to one feature, it may stay in the feature directory.

## 3. Naming & Export Conventions

- **Language**:
  - Code (Variables, Functions, Classes, Modules) → **English**.
  - UI Labels (Tooltips, Buttons, Text) → **German**.
- **Feature Factory Pattern**:
  - Every feature or tool module must export a factory function: `export function create[FeatureName]Feature()`.
- **Lifecycle API**:
  Every feature object returned by the factory must implement:
  - `mount(rootElement, dependencies)`: Initializes and attaches the feature to the DOM.
  - `unmount()`: Cleans up event listeners, timers, and audio nodes.
  - *Optional*: `resume()`, `suspend()` for PWA visibility changes.

## 4. Coding Standards

- **File Size Limits**:
  - Controllers/Feature Modules (Games and Tools): < 300 lines.
  - Logic Modules (`*Logic.js`): < 150 lines.
  - If a file exceeds these limits, it must be refactored into smaller sub-modules or services.
  - The limit is enforced by `tests/unit/architectureBoundaryGuards.test.js` (800-line hard cap; the 300/150 limits are policy, not yet automated).
- **CSS**:
  - No inline `style="..."` attributes.
  - No inline `<style>` blocks in HTML — use `<link rel="stylesheet">` with a page-local `style.css`.
  - Use utility classes like `.u-hidden` for visibility toggling.
  - Prefer CSS Variables for colors and spacing.
- **Security**:
  - All pages carry a CSP meta tag: `default-src 'self'; script-src 'self' 'wasm-unsafe-eval'; style-src 'self';`
  - Never set `innerHTML` with untrusted input (error messages, user data). Use `textContent` or `createElement`.
- **Audio**:
  - Always use `audioSessionService` to manage `AudioContext` lifecycle.
  - Resume `AudioContext` on user interaction if required by browsers.

## 5. Testing Standards

- **Unit Tests**: Mandatory for all `*Logic.js` files. Goal is 100% branch coverage.
- **Smoke Tests**: Every page in `pages/` must have a corresponding `*PageSmoke.test.js` in `tests/unit/` to verify the `mount`/`unmount` cycle.
- **E2E Tests**: Critical paths (complex user interactions) are covered by Playwright tests in `tests/e2e/`.
- **Known-failing tests**: Mark with `describe.skip` / `test.skip` and a `// FIXME:` comment pointing to the relevant plan.

## 6. Current Features

**Games (7):** `tonFinder`, `fretboardToneRecognition`, `akkordTrainer`, `akkordfolgenTrainer`, `chordExerciseEssentia`, `sheetMusicReading`, `notePlayingExercise`

**Tools (7):** `guitarTuner`, `metronome`, `audioAnalyse`, `onsetTagger`, `chordRecorder`, `recordingsOverview`, `akkordUebersicht`

> Note: `settings` lives as a standalone page (`pages/settings/`) without a corresponding `js/tools/` controller module — it is wired directly in its `bootstrap.js`.

## 7. Directory Structure

```text
/
├── js/
│   ├── components/                   # Web Components (registered via components/index.js)
│   │   ├── fretboard/
│   │   │   ├── gt-fretboard.js       # <gt-fretboard> custom element
│   │   │   └── gt-fretboard-render.js  # Pure SVG render function
│   │   ├── gt-exercise-header.js     # <gt-exercise-header> (title + back nav)
│   │   ├── gt-string-toggles.js      # <gt-string-toggles> (string filter UI)
│   │   ├── gt-menu-card.js           # <gt-menu-card> (main menu entry)
│   │   └── index.js                  # Registers all custom elements
│   ├── games/                        # Interactive exercises (controller + optional *Logic.js)
│   │   ├── tonFinder/
│   │   ├── fretboardToneRecognition/
│   │   ├── akkordTrainer/
│   │   ├── akkordfolgenTrainer/
│   │   ├── chordExerciseEssentia/
│   │   ├── sheetMusicReading/
│   │   └── notePlayingExercise/
│   ├── tools/                        # Utility tools (same lifecycle API as games)
│   │   ├── guitarTuner/
│   │   ├── metronome/
│   │   ├── audioAnalyse/
│   │   ├── onsetTagger/
│   │   ├── chordRecorder/
│   │   ├── recordingsOverview/
│   │   └── akkordUebersicht/
│   ├── shared/                       # Cross-cutting infrastructure
│   │   ├── audio/                    # AudioContext, pitch detection, onset detection, tuner
│   │   ├── pwa/                      # Service Worker utilities, precache manifest
│   │   ├── storage/                  # IndexedDB / localStorage wrappers
│   │   └── debug/                    # Developer debug overlays
│   ├── domain/                       # Canonical pure business logic (reused across features)
│   │   ├── chordCatalog.js           # Chord definition lookup
│   │   ├── chordDetector.js          # Chord recognition from HPCP
│   │   └── fretboardMapper.js        # String/fret ↔ note mapping
│   ├── data/                         # Static data (Single Source of Truth)
│   │   └── akkordData.js             # All 35 chord definitions with finger positions
│   └── utils/                        # Generic helpers (no domain knowledge)
│       ├── settings.js               # Fret/string setting helpers
│       └── chordDetectionUtils.js
├── pages/                            # HTML entry points; each has a local style.css
│   ├── ton-finder/
│   ├── fretboard-tone-recognition/
│   ├── akkord-trainer/
│   ├── sheet-music-reading/
│   └── ...
├── models/                           # ONNX models for onset detection
│   └── onset_detector_android_firefox.{onnx,schema.json,metrics.json}
└── tests/
    ├── unit/                         # Vitest unit & smoke tests
    │   ├── *Logic.test.js            # Pure function tests (100% branch coverage)
    │   └── *PageSmoke.test.js        # mount/unmount lifecycle tests
    └── e2e/                          # Playwright E2E tests (critical interaction paths)
```

## 8. Web Component API Reference

### `<gt-fretboard>`
**File:** `js/components/fretboard/gt-fretboard.js`

| API | Type | Description |
|-----|------|-------------|
| `frets` (attr/prop) | `number` | Highest fret shown (default: 5) |
| `interactive` (attr/prop) | `boolean` | Makes positions clickable |
| `positions` (prop) | `Array<{stringIndex, fret, state}>` | Markers to render |
| `activeStrings` (prop) | `number[]` | Strings to show (default: all 6) |
| `fret-select` (event) | `CustomEvent` | Fired on click; detail: `{stringIndex, fret, note}` |

### `<gt-exercise-header>`
**File:** `js/components/gt-exercise-header.js`

Renders the back-navigation bar and exercise title. Used on every exercise/tool page.

| API | Type | Description |
|-----|------|-------------|
| `title` (attr) | `string` | Exercise name shown in header |
| `back-href` (attr) | `string` | URL for the back-navigation link |

### `<gt-string-toggles>`
**File:** `js/components/gt-string-toggles.js`

Six toggle buttons for enabling/disabling individual guitar strings (E2 → E4).

| API | Type | Description |
|-----|------|-------------|
| `active-strings` (prop) | `number[]` | Currently active string indices |
| `string-toggle` (event) | `CustomEvent` | Fired on click; detail: `{stringIndex, active}` |

### `<gt-menu-card>`
**File:** `js/components/gt-menu-card.js`

Main-menu entry card linking to a feature page.

## 9. Shared Audio Module Map

Located in `js/shared/audio/` — see `js/shared/audio/CLAUDE.md` for the full table.

Key modules:

| Module | Purpose |
|--------|---------|
| `audioContextFactory.js` | Creates/resumes the global `AudioContext` |
| `audioSessionService.js` | Manages mic lifecycle; single shared stream |
| `pitchDetector.js` | YIN + HPS pitch detection |
| `guitarOnsetDetector.js` | XGBoost ONNX onset detection (Android-Firefox) |
| `offlineOnsetDetectionXGBoost.js` | Offline inference wrapper |

## 10. Documentation Freshness

After completing any non-trivial feature or refactoring:

1. Update `Last Updated` date at the top of this file.
2. Update `AGENTS.md` Section 1 if new conventions were established.
3. Update `GEMINI.md` if the module or feature list changed.
4. If a module in `js/shared/`, `js/domain/`, or a game/tool directory grew, check its local `CLAUDE.md`.

> Quick check: `git diff --name-only HEAD~5 | grep -E '\.js$'` then verify docs match.
