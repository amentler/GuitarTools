# AGENTS.md - Aufnahmen

Scope: `js/tools/recordingsOverview/` and the matching page in `pages/recordings/`.

## Context

- This tool lists saved recordings from the Noten-lesen storage and the chord recorder storage.
- Read `CLAUDE.md` in this folder before changing behavior; it documents IndexedDB sources, routing, and tests.
- Audio Analyse and Onset Tagger consume the generated URLs and load recordings through `js/shared/recordingLoader.js`.

## Boundaries

- Keep DOM rendering, selection state, and navigation actions in `recordingsOverview.js`.
- Keep IndexedDB reads and source normalization in `recordingsOverviewStorage.js`.
- Keep formatting, display-name, URL-builder, and sorting helpers in `recordingsOverviewLogic.js`.
- Preserve the `source` and `id` query parameters for links to `../audio-analyse/index.html` and `../onset-tagger/index.html`.

## Tests

- For logic changes, run `npm run test -- tests/unit/recordingsOverviewLogic.test.js`.
- For page wiring, include `npm run test -- tests/unit/pageStructureSmoke.test.js`.
- If storage shape changes, verify both sources: `gt-audio-analyse-db/recordings/'last'` and `chord-recorder/recordings/baseName`.

## Cross-platform

- Keep generated URLs browser-relative; do not use local filesystem paths.
- If dependencies change, update and commit `package-lock.json` from the repo root. GitHub Actions uses `npm ci`, which fails when `package.json` and `package-lock.json` are out of sync.
