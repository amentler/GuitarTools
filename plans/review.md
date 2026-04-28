# Technical Review: GuitarTools
**Author:** Staff Software Engineer (AI)  
**Date:** 2026-04-20

## 1. Architecture Analysis

### Current State
The project has transitioned from a Single-Page Application (SPA) to a **Multi-Page Application (MPA)** where each exercise and tool lives in its own HTML file (`pages/**/*.html`). It uses Vanilla JS (ES Modules) and Web Components for shared UI elements.

### Issues & Risks
*   **Hybrid Transition State:** Some legacy SPA logic remains in `js/app.js` (like checking for `#view-menu`), which might conflict with the new standalone page approach. 
*   **Asset Redundancy:** Shared dependencies (like `VexFlow` or `Essentia.js`) are loaded via `<script type="module">` in each HTML file. While browser caching helps, there is no centralized management of shared dependencies beyond ESM imports.
*   **Web Component Inconsistency:** The project is in "Phase 1" of Web Component rollout. This leads to a mix of declarative UI (`<gt-fretboard>`) and imperative DOM manipulation in controllers (e.g., `resolveUI` looking for hardcoded IDs).
*   **Service Worker Overhead:** Manual versioning of `sw.js` and the `PRECACHE_URLS` list is error-prone. A change in a file path or a new exercise requires manual updates to the manifest.

### Recommendations
*   **Complete MPA Migration:** Clean up `js/app.js` and remove any lingering logic that assumes a single-page view-switching mechanism.
*   **Shared Infrastructure:** Move common setup logic (AudioContext lifecycle, Microphone permission management) into a dedicated `js/services/` layer instead of duplicating it in every exercise controller.
*   **declarative standard:** Accelerate Phase 2/3 of Web Components. Encapsulate exercise-specific controls (like the fret slider) into components to reduce "ID-soup" in controllers.

---

## 2. Clean Code Analysis

### Current State
Logic is well-separated into `*Logic.js` files containing pure functions, which are highly testable. Controllers (`*Exercise.js`) manage state and DOM interaction.

### Issues & Risks
*   **Large Controller Files:** Controllers like `sheetMusicMicExercise.js` are becoming "God Objects" (over 400 lines) handling state, audio, DOM, and timers.
*   **String-based ID Coupling:** Controllers rely heavily on `document.getElementById` with magic strings. This is fragile (as seen in recent navigation bugs).
*   **In-place Mutation:** Utilities like `js/utils/settings.js` mutate state objects in-place (`activeStrings.splice(...)`). While simple, this makes state tracking difficult as the app grows.
*   **Timer Management:** Heavy use of `setInterval` and `setTimeout` without centralized management. This can lead to memory leaks or "ghost" analysis loops if `stopExercise` isn't called correctly during page transitions.

### Recommendations
*   **Controller Refactoring:** Break down controllers into smaller classes or modules (e.g., `AudioSession`, `UIController`, `StateEngine`).
*   **DOM Abstraction:** Use a simple `view` object or component properties instead of querying the global `document` repeatedly.
*   **Immutable State Patterns:** Prefer returning new state objects instead of in-place mutation to make logic more predictable and easier to debug.

---

## 3. Quality Management Analysis

### Current State
Outstanding unit test coverage (>670 tests) for pure logic. Regular use of smoke tests for page structures.

### Issues & Risks
*   **Integration Blind Spots:** The transition from SPA to standalone pages introduced bugs (404s, ID mismatches) that were missed by unit tests. Unit tests mocked the DOM too heavily to see the "ID-mismatch" reality.
*   **Mock-Heavy Testing:** Integration tests (like `sheetMusicMicIntegration.test.js`) require massive mocking of `AudioContext`, `AnalyserNode`, and `VexFlow`. These tests are hard to maintain and might not reflect real browser behavior.
*   **Manual Versioning:** `version.txt` and `sw.js` versioning are manual. This will eventually lead to users seeing stale content due to forgotten version bumps.
*   **Lack of E2E:** No real browser testing (Playwright/Cypress). Pitch detection is extremely hardware-dependent (mic quality, sample rate), which logic-level tests can't fully validate.

### Recommendations
*   **Lightweight E2E:** Introduce a basic Playwright suite to run on CI. Even just "load page and check for JS errors" would have caught the recent 404/ID bugs.
*   **Automated Pre-commit Hooks:** Ensure `npm test` and `npm run lint` are non-bypassable (Husky is already there, but enforcement should be strict).
*   **Build-less Versioning:** Use a simple script to auto-generate `version.txt` and update `sw.js` based on git hash or timestamp before deployment.

## Summary Goal
**Move from "Working" to "Robust".** The project has a great logical core. The next step is to professionalize the UI-to-Logic glue and automate the deployment lifecycle (PWA manifest/versioning).
