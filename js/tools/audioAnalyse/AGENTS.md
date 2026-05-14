# AGENTS.md - Audio Analyse

Scope: `js/tools/audioAnalyse/` and the matching page in `pages/audio-analyse/`.

## Context

- This tool analyzes stored or uploaded WAV recordings offline and renders SVG time-series charts.
- Read `CLAUDE.md` in this folder before changing behavior; it documents the current analysis pipeline and chart layout.
- Stored recordings are loaded through shared modules, especially `js/shared/audioAnalyseStorage.js` and `js/shared/recordingLoader.js`.

## Boundaries

- Keep UI wiring, file loading, drag-and-drop, URL parameter handling, and IndexedDB integration in `audioAnalyse.js`.
- Keep WAV decoding and frame analysis in `audioAnalyseEngine.js`.
- Keep chart drawing, chart constants, crosshair state, and tooltip behavior in `audioAnalyseSVG.js`.
- Preserve the frame result shape used by downstream debugging and tests: time, level, onset metrics, pitch, note, octave, and cents fields.

## Tests

- For engine or pure data changes, run the focused unit tests that cover audio analysis and shared audio loading.
- For page wiring, run `npm run test -- tests/unit/pageStructureSmoke.test.js`.
- For visual or interaction changes, verify the static page at `pages/audio-analyse/index.html` through the existing Playwright setup when applicable.

## Cross-platform

- Browser paths must stay URL-relative and POSIX-like; do not introduce Windows filesystem path separators into page links or imports.
- If dependencies change, update and commit `package-lock.json` from the repo root. GitHub Actions uses `npm ci`, which fails when `package.json` and `package-lock.json` are out of sync.
