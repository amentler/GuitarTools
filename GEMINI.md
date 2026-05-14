# Gemini Product State - GuitarTools

This file tracks the current state, architecture, and feature status of GuitarTools.

> **Operational Mandates:** All AI agents MUST follow the rules in [AGENTS.md](AGENTS.md).

## Current Architecture (Phase 1 Web Components)

The project uses a four-layer architecture:
1. **Navigation** (HTML Files) – `index.html` <-> `pages/[feature]/index.html`.
2. **Games/Tools** (`js/games/*`, `js/tools/*`) – State + flow control.
3. **UI Components** (`js/components/*`) – Reusable Web Components (e.g., `<gt-fretboard>`).
4. **Logic** (`*Logic.js`) – Pure functions, fully unit-tested.

### `<gt-fretboard>` Web Component

- **Location:** `js/components/fretboard/gt-fretboard.js`
- **Phase rollout:** All chord diagrams and fretboards are unified into `<gt-fretboard>` as of Phase 4.

## Current Modules

**Games (7):** `tonFinder`, `fretboardToneRecognition`, `akkordTrainer`, `akkordfolgenTrainer`, `chordExerciseEssentia`, `sheetMusicReading`, `notePlayingExercise`

**Tools (7):** `guitarTuner`, `metronome`, `audioAnalyse`, `onsetTagger`, `chordRecorder`, `recordingsOverview`, `akkordUebersicht`

**Logic modules:** `fretboardLogic`, `tunerLogic`, `tonFinderLogic`, `akkordLogic`, `sheetMusicLogic`, `metronomeLogic`, `notePlayingLogic`, `essentiaChordLogic`, `guitarOnsetDetector`, `recordingsOverviewLogic`.

**Data & Domain:** `js/data/akkordData.js` (35 chords), `js/domain/` (chord catalog, detection logic).

## Feature Status

### Guitar Tuner Detection
- Combines YIN with spectral HPS.
- Adaptive FFT size for low strings.
- Multi-stage stabilization (rolling median + stability check + hysteresis).
- Temporal aging & silence reset (reset memory if silence > 300ms).

### Note-Playing Exercise
- Staff notation uses guitar transposition (written +1 octave).
- Pitch detection remains octave-accurate on sounding pitch.

### Menu UI
- Footer contains "⟳ Neu laden" and app version.

## Workflow Notes

- **WSL note 2026-05-14:** `tests/unit/autoUpdateVersion.test.js` currently fails in the local WSL environment. If `npm run test:precommit` is blocked by that known issue, validate changed areas with targeted Vitest runs and document the blocker.
