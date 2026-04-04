# Guitar Tuner – `js/tools/guitarTuner/`

Real-time guitar tuner using the device microphone via Web Audio API.

## Files

### `tunerLogic.js`
Pure functions, no DOM dependencies.

- **`STANDARD_TUNING`** – array of `{ note, octave }` for the 6 open strings (E2 A2 D3 G3 B3 E4)
- **`detectPitch(buffer, sampleRate)`** → Hz or `null`
  - Kombiniert YIN + spektrale HPS-Prüfung im Gitarrenbereich (ca. 70–420 Hz)
  - Adaptive Suchfenster (tiefe Töne stabiler mit größerem Fenster)
  - Vorverarbeitung mit Attack-Dämpfung und Bandbegrenzung
  - Subharmonic-/Octave-Checks für weniger Oberton-Fehler
  - Pegelprüfung (`analyzeInputLevel`) mit RMS- und Clipping-Grenzen
- **`frequencyToNote(freq)`** → `{ note, octave, cents }`
  - `midiNum = 12 * log2(freq / 440) + 69`
  - `cents = (midiNum - round(midiNum)) * 100`
- **`isStandardTuningNote(note, octave)`** → boolean
- **`pushAndMedian(history, freq)`** → median of last 5 readings (mutates array)
- **`pushMedianAndStabilize(history, freq, lastStable)`** → median + stabiler Ausgabewert (Anti-Sprung)
- **`applyNoteSwitchHysteresis(current, candidate, streak)`** → Notenwechsel erst nach mehreren konsistenten Frames
- **`getAdaptiveFftSize(referenceHz)`** → adaptive `AnalyserNode.fftSize` (tief groß, hoch klein)

#### Guided Tuning Logic
- **`GUIDED_TUNING_STEPS`** – 6-step sequence `{ stringNumber, note, octave }` E2→E4
- **`QUARTER_TONE_CENTS`** = 50 – threshold before direction guidance activates
- **`TREND_MIN_SAMPLES`** = 4 – consecutive consistent samples to confirm a trend
- **`TREND_HISTORY_SIZE`** = 6 – max history buffer size
- **`noteToFrequency(note, octave)`** → Hz
- **`getCentsToTarget(detectedFreq, targetFreq)`** → cents (positive = too high)
- **`getPitchDirection(centsToTarget)`** → `'up'|'down'|'none'`
- **`pushGuidedHistory(history, centsToTarget)`** – mutates array, capped at TREND_HISTORY_SIZE
- **`evaluateTrend(history)`** → `'approaching'|'moving-away'|'unstable'`
- **`getGuidedFeedback(centsToTarget, trendHistory)`** → `{ direction, trend, arrowColor, warning }`

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
guidedState: { active, stepIndex, trendHistory }
```

**Flow:**
1. `startExercise()` — init SVG, show permission overlay, call `getUserMedia`
2. On success — create `AudioContext` + `AnalyserNode`, start 100 ms interval
3. Each frame — adaptive `fftSize` → `getFloatTimeDomainData` → `detectPitch` (YIN + HPS) → median+stabilize+hysteresis → `frequencyToNote` → `updateTunerDisplay`; if guided mode active, also compute `getCentsToTarget` → `pushGuidedHistory` → `getGuidedFeedback` → `renderGuidedFeedback`
4. `stopExercise()` — clear interval, stop mic tracks, close AudioContext, reset guided state

**Mode logic:**
- `standard`: green dot only for E2/A2/D3/G3/B3/E4
- `chromatic`: green dot for any note when in tune (|cents| ≤ 8)

**Guided mode:**
- `startGuidedMode()` — initializes step 0, shows active panel
- `nextGuidedStep()` — advances step; when all 6 done, shows finished panel
- `stopGuidedMode()` — resets back to initial state
- `renderGuidedStep()` — updates step label, target note, progress dots
- `renderGuidedFeedback({ direction, arrowColor, warning })` — renders arrow (↑/↓), color (orange/red), and warning text

## AI Collaboration & Documentation

**IMPORTANT FOR ALL AGENTS (Claude, Gemini, Codex):**
- **Update .md files:** After completing a task or implementing a feature, you MUST update all relevant `.md` files (root `CLAUDE.md`, root `GEMINI.md`, this `CLAUDE.md`, and any plans in `plans/`).
- **Keep Plans Current:** If a feature from `plans/` is implemented, update the file to reflect the new state and next steps.
- **Architecture:** Maintain the project's "Vanilla JS" and SVG-focused architecture.
