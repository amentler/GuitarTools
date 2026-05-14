# GuitarTools Architecture Guide

Last Updated: 2026-05-14

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

**Tools (8):** `guitarTuner`, `metronome`, `audioAnalyse`, `onsetTagger`, `chordRecorder`, `recordingsOverview`, `akkordUebersicht`, `settings`

## 7. Directory Structure

```text
/
├── js/
│   ├── components/     # Web Components
│   ├── games/          # Complex features (exercises)
│   ├── tools/          # Utility tools
│   ├── shared/         # Infrastructure (Audio, Storage, PWA)
│   ├── domain/         # Canonical business logic (reused across features)
│   └── utils/          # Generic helpers
├── pages/              # HTML entry points; each page may have a local style.css
└── tests/
    ├── unit/           # Vitest unit & smoke tests
    └── e2e/            # Playwright E2E tests
```
