# GuitarTools Architecture Guide

Last Updated: 2026-04-26

## 1. Goal
GuitarTools is a modular Multi-Page Application (MPA). Each exercise or tool is a self-contained feature that can be mounted into a target DOM element.

## 2. Layer Model

- **Pages (`pages/`)**: Entry points. Minimal logic in `bootstrap.js` to initialize the feature.
- **Features (`js/games/`)**: Complex interactive exercises with state management and flow control.
- **Tools (`js/tools/`)**: Utility applications (e.g., Metronome, Tuner).
- **UI Components (`js/components/`)**: Reusable Web Components (native Custom Elements). Should be stateless or have minimal UI-only state.
- **Domain Logic (`js/domain/` or `*Logic.js`)**: Pure functions, data structures, and business logic. **Must have 100% unit test coverage.**
- **Shared (`js/shared/`)**: Cross-cutting concerns like Audio, Storage, and Rendering.
- **Utils (`js/utils/`)**: Generic helper functions.

## 3. Naming & Export Conventions

- **Language**:
  - Code (Variables, Functions, Classes, Modules) -> **English**.
  - UI Labels (Tooltips, Buttons, Text) -> **German**.
- **Feature Factory Pattern**:
  - Every feature or tool module must export a factory function: `export function create[FeatureName]Feature()`.
- **Lifecycle API**:
  Every feature object returned by the factory must implement:
  - `mount(rootElement, dependencies)`: Initializes and attaches the feature to the DOM.
  - `unmount()`: Cleans up event listeners, timers, and audio nodes.
  - *Optional*: `resume()`, `suspend()` for PWA visibility changes.

## 4. Coding Standards

- **File Size Limits**:
  - Controllers/Feature Modules: < 300 lines.
  - Logic Modules: < 150 lines.
  - If a file exceeds these limits, it should be refactored into smaller sub-modules or services.
- **CSS**:
  - No inline styles (`style="..."`).
  - Use utility classes like `.u-hidden` for visibility toggling.
  - Prefer CSS Variables for colors and spacing.
- **Audio**:
  - Always use `audioSessionService` to manage `AudioContext` lifecycle.
  - Resume `AudioContext` on user interaction if required by browsers.

## 5. Testing Standards

- **Unit Tests**: Mandatory for all `*Logic.js` files. Goal is 100% branch coverage.
- **Smoke Tests**: Every page in `pages/` must have a corresponding `*PageSmoke.test.js` in `tests/unit/` to verify the `mount`/`unmount` cycle.
- **E2E Tests**: Critical paths (complex user interactions) are covered by Playwright tests in `tests/e2e/`.

## 6. Directory Structure

```text
/
├── js/
│   ├── components/     # Web Components
│   ├── games/          # Complex features (exercises)
│   ├── tools/          # Simple features
│   ├── shared/         # Infrastructure (Audio, Storage)
│   ├── domain/         # Core business logic
│   └── utils/          # Helpers
├── pages/              # HTML Entry points
└── tests/
    ├── unit/           # Vitest unit & smoke tests
    └── e2e/            # Playwright E2E tests
```
