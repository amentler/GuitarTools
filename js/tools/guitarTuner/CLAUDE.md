# Guitar Tuner – `js/tools/guitarTuner/`

Real-time guitar tuner using the device microphone via Web Audio API.

## Files

### `tunerLogic.js`
Pure functions, no DOM dependencies.

- **`STANDARD_TUNING`** – array of `{ note, octave }` for the 6 open strings (E2 A2 D3 G3 B3 E4)
- **`detectPitch(buffer, sampleRate)`** → Hz or `null`
  - Autocorrelation on `Float32Array`, search range 70–1400 Hz
  - Parabolic interpolation for sub-sample accuracy
  - Returns `null` if RMS < 0.01 (silence)
- **`frequencyToNote(freq)`** → `{ note, octave, cents }`
  - `midiNum = 12 * log2(freq / 440) + 69`
  - `cents = (midiNum - round(midiNum)) * 100`
- **`isStandardTuningNote(note, octave)`** → boolean
- **`pushAndMedian(history, freq)`** → median of last 5 readings (mutates array)

### `tunerSVG.js`
SVG gauge – init once, update in place.

- **`initTunerSVG(container)`** – builds SVG (viewBox 0 0 400 250)
  - Pivot at (200, 220), arc radius 155, ±60° from 12 o'clock
  - Zone colors: red (±60–30°), yellow (±30–15°), green (±15°)
  - Needle: `<line id="tuner-needle">` with CSS transition on transform
  - Green dot: `<circle id="tuner-dot">` at (200, 62) — fill toggles on in-tune
  - Note: `<text id="tuner-note">`, Cents: `<text id="tuner-cents">`
- **`updateTunerDisplay({ cents, note, octave, isActive, isInTune, isStandardNote })`**
  - Rotation: `(cents / 50) * 60` degrees, clamped to ±60°
  - Dot lit when `isInTune && isStandardNote` (caller passes correct `isStandardNote`)

### `guitarTuner.js`
Main controller. Exports `startExercise()` and `stopExercise()`.

**State:**
```js
{ mode: 'standard'|'chromatic', note, octave, cents, isActive }
```

**Flow:**
1. `startExercise()` — init SVG, show permission overlay, call `getUserMedia`
2. On success — create `AudioContext` + `AnalyserNode` (fftSize 2048), start 100 ms interval
3. Each frame — `getFloatTimeDomainData` → `detectPitch` → rolling median → `frequencyToNote` → `updateTunerDisplay`
4. `stopExercise()` — clear interval, stop mic tracks, close AudioContext

**Mode logic:**
- `standard`: green dot only for E2/A2/D3/G3/B3/E4
- `chromatic`: green dot for any note when in tune (|cents| ≤ 8)
