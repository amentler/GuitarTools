# notePlayingExercise – Ton spielen

## Purpose

A microphone-based exercise: a target note name is displayed (e.g. "C#") and
the user plays that note on the guitar. The app uses pitch detection to verify
whether the correct note was played.

## Files

| File | Purpose |
|------|---------|
| `notePlayingExercise.js` | Exercise controller – mic access, pitch-detection loop, state, DOM |
| `notePlayingLogic.js`    | Pure logic – `getAvailableNotes`, `getRandomNote` (fully unit-tested) |
| `CLAUDE.md`              | This file |

## Architecture

- **Controller** (`notePlayingExercise.js`): Requests microphone, runs a
  100 ms pitch-detection loop (reusing `detectPitch`, `frequencyToNote`,
  `pushAndMedian` from `js/tools/guitarTuner/tunerLogic.js`), and manages
  DOM updates and score.
- **Logic** (`notePlayingLogic.js`): Pure functions with no side effects.
  Imports `getNoteAtPosition` from `fretboardToneRecognition/fretboardLogic.js`.

## Detection Strategy

A rolling median over the last 5 frequency readings is used (same as the
Guitar Tuner). A note is accepted as correct only after it matches the target
for **3 consecutive frames** (~300 ms), preventing accidental brief matches.

## Settings

| Setting | Range | Default |
|---------|-------|---------|
| Frets   | 0–15  | 0–5     |
| Strings | E2–E4 (toggle per string, min 1) | all 6 |

Fret 0 means open string (no fretting required). The note pool is derived from
all positions reachable within the configured frets and strings.

## Navigation

- View ID: `#view-note-play`
- App key: `notePlaying`
- Menu button: `#btn-start-note-play`
- Back button: `#btn-back-note-play`
