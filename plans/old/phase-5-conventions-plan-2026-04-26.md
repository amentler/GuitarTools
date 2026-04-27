# Plan: Phase 5 – Konventionen schärfen (Sharpening Conventions) [COMPLETED]

## Goal
Establish and enforce project-wide technical and stylistic conventions to ensure a consistent, maintainable, and professional codebase.

## 1. Naming & Export Conventions
- **Language Policy:** 
  - Code (Variables, Functions, Classes, Modules) -> **English**.
  - UI Labels (Tooltips, Buttons, Text) -> **German**.
- **Module Exports:** 
  - Standardize on a single factory pattern for all exercises and tools: `export function create[FeatureName]Feature()`.
  - Unified lifecycle methods: `mount(root)`, `unmount()`.
- **IDs & Classes:** 
  - Use a consistent prefix for feature-specific IDs (e.g., `aft-` for Akkordfolgen-Trainer, `gt-` for generic GuitarTools).

## 2. HTML & CSS Cleanup
- **Remove Inline Styles:** Move all `style="display:none"` or `style="visibility:hidden"` to CSS classes (e.g., `.hidden { display: none !important; }`).
- **Standardize Structure:** Ensure all pages follow the same layout pattern:
  - Header (`<gt-exercise-header>`)
  - Content area
  - Settings panel
  - Controls

## 3. Documentation (docs/architecture.md)
Create a comprehensive architecture guide including:
- **Layer Model:** Define the boundaries between `components`, `games`, `tools`, `domain`, `shared`, and `utils`.
- **File Size Standards:** Define maximum line counts (e.g., Controller < 300 lines, Logic < 150 lines).
- **Audio Standards:** Guidelines for using `audioSessionService` and `audioContextFactory`.
- **Testing Standards:** Requirement for 100% test coverage for `*Logic.js` files.

## 4. Technical Guardrails
- **Lint Rules:** Explore `eslint-plugin-import` or custom rules to prevent cross-feature imports (e.g., `tonFinder` should not import from `akkordTrainer`).
- **Smoke Tests:** Add basic "Page Smoke Tests" for any pages that don't have them yet to verify the unified `mount`/`unmount` cycle.

## Execution Steps (TDD)
1. **Prepare docs/architecture.md:** Draft the rules first.
2. **Standardize Exports:** Refactor existing controllers to follow the unified `create...Feature` naming.
3. **CSS Refactoring:** Introduce a `.u-hidden` (utility) class and replace all inline styles.
4. **Validation:** Run existing E2E and Smoke tests to ensure no regressions.

## Completion Criteria
- No inline `style="..."` attributes in `pages/**/*.html`.
- Unified export pattern across all 8 game modules and 3 tool modules.
- `docs/architecture.md` exists and is referenced in `GEMINI.md`.
