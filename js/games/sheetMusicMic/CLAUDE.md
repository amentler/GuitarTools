# sheetMusicMic – Noten spielen

## Purpose

Combines "Noten lesen" (sheet music display) with microphone-based note
recognition. A 4-bar score is generated; the user plays each note on the
guitar. Correct notes turn green. Two difficulty modes:

- **Einfach (easy)** — wrong notes are ignored; keep playing until the
  correct pitch lands
- **Schwer (hard)** — three consecutive wrong-note frames restart the whole
  sequence from the beginning

## Files

| File | Purpose |
|------|---------|
| `sheetMusicMicExercise.js` | Exercise controller – audio pipeline, mode logic, score state, DOM |
| `sheetMusicMicSVG.js`      | VexFlow rendering with per-note colour based on `status` field |
| `fastNoteMatcher.js`       | Pure pitch-classification and streak state machine (shared with `notePlayingExercise`) |
| `noteOnsetGate.js`         | Pure attack/onset gate so repeated identical notes require a fresh pluck |
| `CLAUDE.md`                | This file |

## Architecture

```
sheetMusicMicExercise.js
  │
  ├─ generateBars()          ← sheetMusicReading/sheetMusicLogic.js
  ├─ renderScoreWithStatus() ← sheetMusicMicSVG.js
  ├─ updateOnsetGate()
  └─ classifyFrame()
     updateMatchState()
     getRecommendedFftSize() ← fastNoteMatcher.js
        ↑
     noteOnsetGate.js
                                   └─ detectPitch()
                                      frequencyToNote()
                                      noteToFrequency() ← tools/guitarTuner/tunerLogic.js
```

## fastNoteMatcher – Key Design Decisions

### Why no `referenceHz` narrowing

`detectPitch` supports a `referenceHz` parameter that narrows the YIN search
band around the target. This was rejected because narrowing causes a
subharmonic collapse: when a player sounds an octave-up note (e.g. E3 against
an E2 target), YIN cannot find it in the narrow band and instead locks onto
the subharmonic at E2, incorrectly reporting a match. Full-range detection
avoids this at the cost of a larger minimum buffer.

### Buffer-size guard

YIN requires at least `ceil(sampleRate / GUITAR_MIN_FREQUENCY) * minPeriods`
samples. At 44.1 kHz with `GUITAR_MIN_FREQUENCY = 70` this is **≈ 2520
samples** — above the old hardcoded `analyser.fftSize = 2048` that silently
broke low-string detection. `getMinSamplesFor` encodes this formula;
`classifyFrame` returns `status: 'unsure'` whenever the buffer is too small
instead of producing garbage output.

### Adaptive fftSize

`getRecommendedFftSize(targetPitch, sampleRate)` returns the smallest
power-of-two ≥ 1.25× `getMinSamplesFor(…)`. Today this resolves to **4096
at 44.1 kHz** for all guitar targets (~93 ms per window). The controller
calls it via `applyTargetFftSize()` whenever the target note changes.

## State Shape

```js
state = {
  bars:             [],        // 4 bars of { ...note, status: 'pending'|'current'|'correct' }
  currentBarIndex:  0,
  currentBeatIndex: 0,
  mode:             'easy',    // 'easy' | 'hard'
  isListening:      false,
  matchState:       createMatchState(),
  onsetGateState:   createOnsetGateState(),
  isLocked:         false,
  score:            { correct: 0, total: 0 },
  settings: {
    maxFret:       3,
    activeStrings: [0, 1, 2, 3, 4, 5],
  },
}
```

## Fresh-Pluck Requirement

`sheetMusicMicExercise` no longer accepts a note from pitch stability alone.
Each note must be preceded by a fresh attack:

- `noteOnsetGate.js` watches per-frame RMS and emits an onset only on a rising edge.
- After a note is accepted, the onset window is consumed immediately.
- As long as the previous note is only ringing out, frames are forced to `unsure`
  before they reach `updateMatchState(...)`.

Effect:

- `E4, E4, E4` only advances when the player plucks three times.
- A sustained `E4` cannot automatically satisfy the next `E4`.
- The same gate also prevents hard mode from rejecting on leftover sustain before a new attack.

## Detection Constants (from fastNoteMatcher)

| Constant | Value | Meaning |
|----------|-------|---------|
| `FAST_ACCEPT_STREAK` | 2 | consecutive `correct` frames → `accept` event |
| `FAST_REJECT_STREAK` | 3 | consecutive `wrong` frames → `reject` event |
| `FAST_CENTS_TOLERANCE` | 35 | ±35 cent acceptance window |

In easy mode, `wrong` frames are mapped to `unsure` before being fed into
`updateMatchState`, so the reject path is never triggered.

## Note Colours

| status | Colour |
|--------|--------|
| `pending` | default theme colour |
| `current` | orange |
| `correct` | green |

## Navigation

- View ID: `#view-sheet-mic`
- App key: `sheetMusicMic`
- Menu button: `#btn-start-sheet-mic`
- Back button: `#btn-back-sheet-mic`

## Settings

| Setting | Range | Default |
|---------|-------|---------|
| Frets   | 0–12  | 0–3     |
| Strings | E2–E4 (toggle per string, min 1) | all 6 |
| Mode    | Einfach / Schwer | Einfach |

Changing frets or strings stops listening, regenerates bars, and shows the
start button. Changing mode takes effect from the next note onward.
