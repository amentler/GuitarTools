# AGENTS.md - Onset Tagger

Scope: `js/tools/onsetTagger/` and the matching page in `pages/onset-tagger/`.

## Context

- This browser tool manually annotates onset timestamps in guitar recordings and exports WAV plus JSON sidecars.
- Read `CLAUDE.md` in this folder before changing behavior; it documents the workflow, sidecar format, and import route.
- The ZIP helper is now in `js/shared/zip.js` (shared across all tools).

## Boundaries

- Keep controller state, file loading, playback, slider wiring, URL parameter handling, and export orchestration in `onsetTagger.js`.
- Keep pure timestamp, range, envelope, playhead, and sidecar helpers in `onsetTaggerLogic.js`.
- Keep SVG waveform rendering and marker/playhead updates in `onsetTaggerWaveform.js`.
- Keep ZIP assembly/download integration in `onsetTagger.js` (ZIP utilities are in `js/shared/zip.js`).
- Preserve the exported `onsetsMs` sidecar field; fixture import scripts depend on it.

## Tests

- For logic changes, run `npm run test -- tests/unit/onsetTaggerLogic.test.js`.
- For browser interaction changes, run `npm run test:e2e -- tests/e2e/onset-tagger.spec.js` if the environment has Playwright browsers installed.
- For page wiring, include `npm run test -- tests/unit/pageStructureSmoke.test.js`.

## Cross-platform

- Do not add OS-specific paths to sidecars, ZIP entries, or download names.
- If dependencies change, update and commit `package-lock.json` from the repo root. GitHub Actions uses `npm ci`, which fails when `package.json` and `package-lock.json` are out of sync.
