# notePlayingExercise – Ton spielen

## Purpose

A microphone-based exercise: a target note with octave (e.g. "C#4") is displayed
and the user plays that exact note on the guitar. The app uses pitch detection to
verify whether the correct note **and octave** was played.

## Files

| File | Purpose |
|------|---------|
| `notePlayingExercise.js` | Exercise controller – mic access, pitch-detection loop, state, DOM |
| `notePlayingLogic.js`    | Pure logic – octave-aware and legacy helpers (fully unit-tested) |
| `notePlayingSVG.js`      | VexFlow staff + tab SVG rendering (octave-accurate) |
| `CLAUDE.md`              | This file |

## Architecture

- **Controller** (`notePlayingExercise.js`): Requests microphone, runs a
  50 ms pitch-detection loop using `classifyFrame` + `updateMatchState`
  from `js/games/sheetMusicMic/fastNoteMatcher.js` and adapts the
  `AnalyserNode.fftSize` via `getRecommendedFftSize` so that low-string
  targets get a big-enough buffer for YIN to produce a reliable reading.
- **Logic** (`notePlayingLogic.js`): Pure functions with no side effects.
  Exports both octave-aware helpers and legacy note-name helpers.
- **Rendering** (`notePlayingSVG.js`): Converts octave-aware pitch strings
  (e.g. `"C#4"`) to VexFlow keys dynamically; no static note-to-octave map.

## Octave-Accurate Detection (Option 2)

Target notes are stored and compared as canonical pitch strings (e.g. `"E2"`,
`"C#4"`). Detection uses both `note` and `octave` from `frequencyToNote`:

```js
const { note, octave } = frequencyToNote(medianHz);
const pitch = `${note}${octave}`;
if (pitch === state.targetNote) { /* correct */ }
```

Playing the same pitch class in the wrong octave (e.g. E3 when E2 is targeted)
will **not** count as correct.

### Important: Guitar Notation vs. Sounding Pitch

For the staff display, this exercise now applies standard guitar notation
transposition: written notes are rendered **one octave above** sounding pitch.
Detection and matching still use the real sounding pitch (`note + octave`), so
the required played tone remains physically correct.

## Logic API

### Octave-aware (primary)
| Function | Description |
|----------|-------------|
| `getPitchAtPosition(stringIndex, fret)` | Returns `{ note, octave }` using standard guitar MIDI tuning |
| `getAvailablePitches(maxFret, activeStrings)` | Unique pitch strings like `["E2","A2",…]` |
| `getRandomPitch(previous, maxFret, activeStrings)` | Random pitch, avoids previous |
| `getPositionsForPitch(pitchStr, maxFret, activeStrings)` | Fretboard positions for exact pitch |

### Legacy (backward compatibility)
| Function | Description |
|----------|-------------|
| `getAvailableNotes(maxFret, activeStrings)` | Unique note names (pitch classes only) |
| `getRandomNote(previous, maxFret, activeStrings)` | Random note name |
| `getPositionsForNote(noteName, maxFret, activeStrings)` | Positions by note name |

Open-string MIDI values used: E2=40, A2=45, D3=50, G3=55, B3=59, E4=64.

## Detection Strategy

The exercise delegates pitch decisions to the shared `fastNoteMatcher`
module. Each 50 ms frame is classified as `correct`, `wrong`, or `unsure`
via `classifyFrame`, and `updateMatchState` emits an `accept` event once
two consecutive `correct` frames land. The analyser buffer size follows
`getRecommendedFftSize`, so E2/A2 targets get ≥ 4096 samples (the YIN
minimum at `GUITAR_MIN_FREQUENCY = 70`) instead of the legacy hard-coded
2048 that silently broke low-string detection.

## Settings

| Setting | Range | Default |
|---------|-------|---------|
| Frets   | 0–15  | 0–5     |
| Strings | E2–E4 (toggle per string, min 1) | all 6 |

Fret 0 means open string (no fretting required). The note pool is derived from
all positions reachable within the configured frets and strings, including octave.
With all strings enabled, the sounding open-string range is E2–E4 at fret 0 and
extends to G5 at fret 15.

## Navigation

- View ID: `#view-note-play`
- App key: `notePlaying`
- Menu button: `#btn-start-note-play`
- Back button: `#btn-back-note-play`
