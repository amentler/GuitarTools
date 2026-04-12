# Project Improvement Plan – GuitarTools

**Date:** 2026-04-12
**Scope:** Architecture, code quality, testing, DX, and maintainability

---

## 1. Architecture & Design

### 1.1 Eliminate Module-Level Mutable State (HIGH PRIORITY)

**Problem:** Nearly every exercise/tool controller (`*Exercise.js`) and the tuner use module-level `let state = {...}` with mutable objects. This makes:
- Testing difficult (state leaks between test runs)
- Reasoning about code hard (hidden side effects)
- Hot-reloading / concurrent exercises impossible

**Affected files:**
- `js/games/fretboardToneRecognition/fretboardExercise.js` — `let state = {...}`
- `js/tools/guitarTuner/guitarTuner.js` — `let state = {...}`, `let guidedState = {...}`, plus 8+ module-level tracking variables
- `js/tools/metronome/metronome.js` — `let logic = null; let svg = null;`
- All other exercise controllers

**Recommendation:**
- Introduce a lightweight state container pattern. Each exercise should instantiate a class or return a factory function that encapsulates state.
- `startExercise()` should return a controller instance; `stopExercise()` calls `.dispose()` on it.
- Example pattern:
  ```js
  export function createFretboardExercise() {
    let state = { /* ... */ };
    return { start(), stop(), dispose() };
  }
  ```
- This makes state lifecycle explicit and testable.

### 1.2 Decouple `app.js` Navigation from Individual Modules

**Problem:** `app.js` has a hardcoded `navigateTo()` function with explicit `if` chains for every view. Adding a new exercise requires modifying `app.js` (violates OCP – Open/Closed Principle).

**Recommendation:**
- Implement a registry pattern where exercises self-register with a route key:
  ```js
  // app.js
  const exerciseRegistry = new Map();
  function registerExercise(key, { start, stop }) {
    exerciseRegistry.set(key, { start, stop });
  }
  ```
- `navigateTo()` then becomes generic:
  ```js
  function navigateTo(name) {
    currentExercise?.stop();
    const exercise = exerciseRegistry.get(name);
    exercise?.start();
  }
  ```
- Each exercise module calls `registerExercise('fretboard', { startExercise, stopExercise })`.

### 1.3 Introduce a Shared Event Bus or Pub/Sub

**Problem:** Communication between modules happens through direct DOM manipulation or implicit shared state. There is no clean way for modules to communicate without tight coupling.

**Recommendation:**
- Create a minimal `EventBus` for cross-module communication (e.g., settings changes, score updates).
- Alternatively, use custom DOM events (already partially done with `<gt-fretboard>`'s `fret-select` event).

### 1.4 Consolidate Audio Pipeline into a Shared AudioContext Manager

**Problem:** Each audio feature (tuner, note-playing, sheet-mic) creates its own `AudioContext`, `AnalyserNode`, and `getUserMedia` stream. This leads to:
- Multiple AudioContext instances (resource waste)
- Repeated microphone permission logic
- Duplicated setup/teardown code

**Recommendation:**
- Create `js/audio/audioManager.js` — a singleton that manages:
  - Single `AudioContext` instance
  - Microphone stream (shared across features)
  - AnalyserNode with configurable fftSize
  - Cleanup on navigation
- All audio features request an analyser node from the manager instead of creating their own.

---

## 2. Code Quality & SOLID Principles

### 2.1 Single Responsibility: Split Large Files

**Problem:** Several files exceed 300+ lines and mix concerns:
- `guitarTuner.js` (469 lines) — manages DOM, audio, pitch analysis, guided mode, and UI rendering
- `fretboardExercise.js` (316 lines) — state management, DOM wiring, settings, answer handling, rendering
- `pitchLogic.js` (410 lines) — contains YIN, HPS, bandpass filters, EMA smoothing, outlier rejection, noise calibration

**Recommendation:**
- Split `guitarTuner.js` into:
  - `guitarTunerController.js` — DOM and lifecycle only
  - `guidedTunerController.js` — guided mode logic
- Split `pitchLogic.js` into:
  - `yin.js` — YIN algorithm
  - `hps.js` — Harmonic Product Spectrum
  - `audioFilters.js` — bandpass, damp, level analysis
  - `pitchMath.js` — frequencyToNote, noteToFrequency, cents calculations

### 2.2 Reduce Code Duplication: Shared Settings Component

**Problem:** The settings panel (fret range slider, string toggles) is duplicated across 5+ views with nearly identical HTML and JS wiring code:
- `view-fretboard`, `view-ton-finder`, `view-sheet-music`, `view-sheet-mic`, `view-note-play`

**Recommendation:**
- Create a `<gt-settings-panel>` Web Component that handles:
  - Fret range slider with live label
  - String toggle buttons
  - Emits a `settings-change` event with `{ maxFret, activeStrings }`
- Replace all inline settings HTML with the component.
- Estimated reduction: ~200 lines of duplicated HTML + ~150 lines of duplicated JS wiring.

### 2.3 Replace Inline Styles with CSS Classes

**Problem:** Several places use inline `style="display:none"` and direct `.style` manipulation:
- `index.html`: guided tuner sections, note-play hints
- `guitarTuner.js`: guided mode visibility toggling
- Multiple exercise files

**Recommendation:**
- Use CSS utility classes (`.hidden`, `.visible`, `.active`) instead of inline styles.
- Enables CSS transitions and centralized visibility logic.

### 2.4 Consistent Error Handling

**Problem:** Error handling is inconsistent:
- `app.js` `loadVersionInfo()` catches errors silently
- Microphone permission errors are shown inline but not handled uniformly
- No global error boundary or error reporting mechanism

**Recommendation:**
- Create a `showError(message)` utility function for consistent error display.
- Add `window.onerror` handler for uncaught errors.
- Wrap all `getUserMedia` calls in a shared permission handler that shows consistent UI.

---

## 3. Testing Strategy

### 3.1 Increase Integration Test Coverage

**Problem:** Test suite has 81 files, but many are unit tests for pure logic. There are no integration tests for:
- Full exercise flows (start → play → score → next round)
- DOM interaction flows
- Navigation between views
- Audio pipeline end-to-end

**Recommendation:**
- Add integration tests using jsdom that:
  - Load `index.html` and simulate navigation
  - Verify exercise start/stop cycles
  - Test settings panel interactions
- Consider Playwright or Puppeteer for real browser E2E tests.

### 3.2 Test Setup for Audio Fixtures

**Problem:** Audio tests rely on WAV fixtures in `tests/fixtures/audio/`. There is no documentation on how these were recorded or how to add new ones.

**Recommendation:**
- Add `tests/fixtures/README.md` documenting:
  - Recording setup (sample rate, bit depth)
  - How to generate new fixtures
  - Which notes are covered
- Add a fixture validation script that checks all WAV files are decodable.

### 3.3 Mock Document/Window for Exercise Tests

**Problem:** Exercise controllers (`*Exercise.js`) are hard to unit-test because they directly access `document.getElementById()` at module scope.

**Recommendation:**
- After implementing recommendation 1.1 (factory pattern), exercises can be tested with mock DOM.
- Add tests for `handleAnswer()`, `advanceToNextPosition()`, settings changes.

---

## 4. Developer Experience

### 4.1 Add TypeScript (MEDIUM PRIORITY)

**Problem:** Pure JavaScript provides no compile-time type checking. The pitch detection math, note calculations, and exercise state machines would benefit significantly from types.

**Recommendation (phased):**
- Phase 1: Add JSDoc type annotations to all public APIs (`@type`, `@param`, `@returns`).
- Phase 2: Enable `// @ts-check` in JS files for editor-level type checking.
- Phase 3 (optional): Migrate to TypeScript for critical modules (`pitchLogic.js`, `fastNoteMatcher.js`).

### 4.2 Add a Build Step (Vite)

**Problem:** No bundler means:
- No code splitting
- No tree-shaking
- No automatic minification for production
- ES module imports require full `.js` extensions
- No import map support for external deps (VexFlow CDN)

**Recommendation:**
- Introduce Vite as a zero-config build tool:
  - `npm create vite@latest` with vanilla JS template
  - Keeps dev server fast (HMR not applicable for vanilla, but fast rebuilds)
  - Produces optimized bundle for production
  - Can inline VexFlow instead of CDN dependency

### 4.3 Add Pre-commit Hooks

**Problem:** No lint-staged or pre-commit hooks. Code quality depends on manual `npm run lint` runs.

**Recommendation:**
- Add `husky` + `lint-staged`:
  ```json
  {
    "lint-staged": {
      "*.js": ["eslint --fix", "vitest run --related"]
    }
  }
  ```
- Prevents committing code that fails lint or tests.

### 4.4 Improve ESLint Configuration

**Problem:** Current ESLint config is minimal — only `no-unused-vars` beyond recommended rules.

**Recommendation:**
- Add rules for:
  - `no-var` — enforce `let`/`const`
  - `prefer-const` — flag unnecessary `let`
  - `eqeqeq` — enforce strict equality
  - `no-console` — flag stray `console.log` in production code
  - `complexity` — flag functions with too many branches
  - `max-lines-per-function` — encourage smaller functions
  - `import/no-unused-modules` (if using import plugin)

---

## 5. Performance & Optimization

### 5.1 Reduce DOM Manipulation in Hot Paths

**Problem:** The tuner's `analyzeFrame()` runs every 50ms and calls `updateTunerDisplay()` which rebuilds SVG elements. The fretboard exercise calls `render()` on every answer.

**Recommendation:**
- Batch DOM updates using `requestAnimationFrame`.
- Use SVG attribute updates instead of `innerHTML` reconstruction.
- Debounce settings panel changes.

### 5.2 Lazy-Load Exercise Modules

**Problem:** `app.js` imports all exercise modules eagerly at startup. This increases initial load time, especially on mobile.

**Recommendation:**
- Use dynamic `import()` for lazy loading:
  ```js
  async function navigateTo(name) {
    currentExercise?.stop();
    const module = await import(`./games/${name}/${name}Exercise.js`);
    module.startExercise();
  }
  ```
- Reduces initial JavaScript payload by ~60% (only menu view needed at startup).

### 5.3 Optimize Service Worker Strategy

**Problem:** `sw.js` currently does no caching at all (`PRE-cache_URLS = []`, always `fetch` with `cache: 'no-store'`). This means every page load fetches all resources from the network, defeating the PWA offline capability.

**Recommendation:**
- Implement a proper cache-first strategy for static assets (JS, CSS, icons).
- Network-first for HTML (to detect updates).
- Stale-while-revalidate for VexFlow CDN.
- The README describes a sophisticated caching strategy that doesn't match the actual `sw.js` implementation.

---

## 6. Documentation & Maintainability

### 6.1 Add Architecture Decision Records (ADRs)

**Problem:** Key decisions (why YIN over autocorrelation, why SVG over Canvas, why vanilla JS) are not documented.

**Recommendation:**
- Create `docs/adr/` with markdown records:
  - ADR-001: Why vanilla JavaScript (no framework)
  - ADR-002: Why SVG rendering over Canvas
  - ADR-003: Why YIN + HPS combined pitch detection
  - ADR-004: Service worker caching strategy

### 6.2 Add CONTRIBUTING.md

**Problem:** No contribution guidelines, no setup instructions beyond the README's "start a local server."

**Recommendation:**
- Add `CONTRIBUTING.md` with:
  - How to run tests
  - How to add a new exercise (step-by-step)
  - Code style guidelines
  - PR template

### 6.3 Generate API Documentation

**Problem:** No auto-generated API docs. JSDoc comments exist but are not compiled into browsable documentation.

**Recommendation:**
- Add `jsdoc` or `typedoc` (if migrating to TS) to generate API docs.
- Publish to GitHub Pages.

---

## 7. Accessibility (a11y)

### 7.1 Add ARIA Labels and Keyboard Navigation

**Problem:** The app lacks:
- ARIA labels on interactive elements (fretboard, chord diagram)
- Keyboard navigation support (tab order, enter/space activation)
- Screen reader announcements for feedback text
- Focus management on view changes

**Recommendation:**
- Add `aria-label` to all buttons and interactive SVG elements.
- Add `role="status"` to feedback text for screen reader announcements.
- Implement focus trap within active exercise views.
- Add keyboard shortcuts (e.g., `1-6` for note buttons, `Enter` to confirm).

### 7.2 Color Contrast & Color-Blind Support

**Problem:** Color-only feedback (green/red for correct/wrong) is not accessible to color-blind users.

**Recommendation:**
- Add icons (✓/✗) alongside color changes.
- Ensure minimum contrast ratios (WCAG AA: 4.5:1).
- Test with color-blind simulation tools.

---

## 8. Security

### 8.1 Review `innerHTML` Usage

**Problem:** Several files use `innerHTML` for DOM updates, which can lead to XSS if user-controlled data is ever inserted:
- `fretboardExercise.js`, `guitarTuner.js`, multiple SVG renderers

**Recommendation:**
- Replace `innerHTML` with `textContent` for text content.
- Use DOMPurify if HTML injection is ever needed.
- For SVG, continue using `createElementNS` (already done in most places).

---

## Priority Matrix

| Priority | Impact | Effort | Item |
|----------|--------|--------|------|
| 🔴 P0 | High | Medium | 1.1 — Eliminate module-level mutable state |
| 🔴 P0 | High | Low | 5.3 — Fix Service Worker caching strategy |
| 🟠 P1 | High | Low | 2.2 — Shared settings component (DRY) |
| 🟠 P1 | High | Medium | 1.2 — Decouple app.js navigation (OCP) |
| 🟠 P1 | High | Low | 1.4 — Shared AudioContext manager |
| 🟡 P2 | Medium | Medium | 2.1 — Split large files (SRP) |
| 🟡 P2 | Medium | Low | 4.2 — Add Vite build step |
| 🟡 P2 | Medium | Low | 4.3 — Add pre-commit hooks |
| 🟡 P2 | Medium | Low | 5.2 — Lazy-load exercise modules |
| 🟢 P3 | Medium | Low | 4.1 — Add JSDoc types + ts-check |
| 🟢 P3 | Medium | Medium | 3.1 — Integration tests |
| 🟢 P3 | Low | Low | 6.1 — ADRs |
| 🟢 P3 | Low | Low | 7.1 — Accessibility (ARIA) |
| 🟢 P3 | Low | Medium | 4.4 — Improve ESLint rules |
| 🔵 P4 | Low | Low | 6.2 — CONTRIBUTING.md |
| 🔵 P4 | Low | Low | 8.1 — Review innerHTML usage |

---

## Quick Wins (Can be done in < 1 hour each)

1. Add `no-var`, `prefer-const`, `eqeqeq` ESLint rules
2. Replace inline `style="display:none"` with CSS classes
3. Add `CONTRIBUTING.md`
4. Add `tests/fixtures/README.md`
5. Fix Service Worker to actually cache static assets
6. Add `window.onerror` global error handler
7. Add pre-commit hooks (husky + lint-staged)
8. Replace `innerHTML` with `textContent` for feedback strings
