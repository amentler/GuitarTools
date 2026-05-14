# AGENTS.md - Noten lesen

Scope: `js/games/sheetMusicReading/` and the matching page in `pages/sheet-music-reading/`.

## Context

- This is the "Noten lesen" exercise, not the separate `notePlayingExercise` game.
- Architecture is vanilla browser JavaScript. Keep feature code in this folder and mount it from `pages/sheet-music-reading/bootstrap.js`.
- Read `CLAUDE.md` in this folder before changing behavior; it documents the current module split and state model.
- Shared audio persistence lives outside this folder in `js/shared/audioAnalyseStorage.js`.

## Boundaries

- Keep pure score/time-signature logic in `sheetMusicLogic.js`.
- Keep VexFlow/SVG rendering in `sheetMusicSVG.js`.
- Keep playback timing in `playbackController.js` and playback-bar placement in `playbackBar.js`.
- Keep microphone recognition strategy wiring in `sheetMusicRecognition.js`; do not bypass the strategy registry from the UI controller.
- Keep WAV recording in `sheetMusicRecorder.js` and ZIP creation in `sheetMusicZip.js`.

## Tests

- For logic changes, run the focused unit tests first: `npm run test -- tests/unit/sheetMusicReadingController.test.js tests/unit/sheetMusicRecognition.test.js`.
- For page wiring, include `npm run test -- tests/unit/pageStructureSmoke.test.js`.
- If audio matching, onset handling, or recordings change, also run the relevant audio or fixture tests named in the touched modules.

## Cross-platform

- Do not add OS-specific paths or shell assumptions to browser code.
- If dependencies change, update and commit `package-lock.json` from the repo root. GitHub Actions uses `npm ci`, which fails when `package.json` and `package-lock.json` are out of sync.
