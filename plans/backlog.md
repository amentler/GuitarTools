# GuitarTools – Backlog & Plans

## Active Plan: Chord Exercise with Audio Recognition

**Status:** ✅ Implemented (Phases 1–4 complete)  
**Created:** 2026-04-12  
**Completed:** 2026-04-17  
**Goal:** Create a chord exercise where the tool tells the user which chord to play, the user plays it on guitar, and the tool recognizes whether the chord sounded correct.

---

## Overview

This feature extends the existing akkordTrainer (which is purely visual/manual) with **microphone-based audio recognition**. The exercise will:

1. Display a target chord (e.g., "C-Dur")
2. Listen via microphone while the user plays the chord
3. Analyze the audio to detect whether the correct notes are sounding simultaneously
4. Provide feedback (correct/wrong/which strings are incorrect)

---

## Technical Approach

### Core Challenge: Multi-Note (Chord) Detection

The existing audio pipeline (`pitchLogic.js` → `tunerLogic.js` → `fastNoteMatcher.js`) is designed for **single-note detection** using YIN + HPS algorithms. Chords require detecting **multiple simultaneous fundamentals**.

**Proposed Solution: Spectral Peak Analysis + Harmonic Validation**

Instead of YIN (which finds one fundamental), we'll use:
1. **FFT spectrum analysis** via `AnalyserNode.getFloatFrequencyData()` (already in use)
2. **Peak detection** in the frequency domain to find multiple strong frequencies
3. **Harmonic validation** to distinguish fundamentals from harmonics
4. **Chord matching** against expected note combinations from `akkordLogic.js`

### Architecture

```
┌─────────────────────────────────────────────────────────┐
│  chordExercise.js (Game Controller)                     │
│  - Start/stop exercise, DOM interaction                 │
│  - Round management, scoring, feedback                  │
│  - Uses <gt-fretboard> for chord visualization          │
└────────────┬──────────────────────────────┬──────────────┘
             │                              │
             ▼                              ▼
┌────────────────────────┐    ┌──────────────────────────────┐
│ chordDetection.js      │    │ chordVisualization.js        │
│ (Audio Pipeline)       │    │ (SVG chord diagrams)         │
│ - Microphone input     │    │ - Show target chord shape    │
│ - FFT analysis         │    │ - Show detected strings      │
│ - Peak detection       │    │ - Color feedback (✓/✗)       │
│ - Note identification  │    └──────────────────────────────┘
│ - Chord matching       │
└────────────┬───────────┘
             │
             ▼
┌─────────────────────────────────────────┐
│ chordDetectionLogic.js (Pure Functions) │
│ - frequencyToNote (reuse from tuner)    │
│ - detectChordNotes(freqPeaks)           │
│ - matchChord(detectedNotes, targetChord)│
│ - confidence scoring                    │
└─────────────────────────────────────────┘
```

---

## Implementation Steps

### Phase 1: Foundation & Logic (No Audio Yet)

#### Step 1.1: Create `js/games/chordExercise/chordDetectionLogic.js`
**Purpose:** Pure functions for chord detection logic  
**Tasks:**
- Export chord note extraction utilities (which notes are in a chord)
- Implement `getChordNotes(chordName)` → array of `{note, octave}` expected in chord
- Implement `identifyNotesFromPeaks(freqPeaks, toleranceCents)` → detected notes from frequency peaks
- Implement `matchChordToTarget(detectedNotes, targetChord, stringStates)` → match quality score
- Handle string muting detection (which strings should NOT sound)
- Reuse `frequencyToNote`, `noteToFrequency` from `tunerLogic.js`

**Key Algorithm:**
```
1. From FFT, get frequency peaks (e.g., [82Hz, 110Hz, 147Hz, 196Hz, 247Hz])
2. Convert each peak to nearest note (e.g., [E2, A2, D3, G3, B3])
3. For target chord (e.g., "C-Dur"), get expected notes:
   - From akkordLogic CHORDS data: which strings are fretted, which are open, which are muted
   - Expected sounding notes: e.g., [C3, E3, G3, C4, E4] (depending on voicing)
4. Compare detected vs expected:
   - Are all expected notes present? (within ±35 cents tolerance)
   - Are there unexpected notes? (wrong strings ringing)
   - Return: { isCorrect: bool, missingNotes: [], extraNotes: [], confidence: 0-1 }
```

#### Step 1.2: Create `js/games/chordExercise/CLAUDE.md`
**Purpose:** Module documentation  
**Tasks:**
- Document architecture, API, design decisions
- Link to this backlog file

#### Step 1.3: Unit Tests for `chordDetectionLogic.js`
**Location:** `tests/unit/chordDetectionLogic.test.js`  
**Test Cases:**
- `getChordNotes` returns correct notes for each chord in CHORDS
- `identifyNotesFromPeaks` correctly identifies notes from synthetic frequency peaks
- `matchChordToTarget` correctly matches perfect chord
- `matchChordToTarget` detects missing notes
- `matchChordToTarget` detects extra/wrong notes
- `matchChordToTarget` handles muted strings correctly
- Tolerance edge cases (±35 cents boundary)
- Tests for all 8 chords in the existing CHORDS dataset

---

### Phase 2: Audio Pipeline

#### Step 2.1: Create `js/games/chordExercise/chordDetection.js`
**Purpose:** Audio capture and spectral analysis  
**Tasks:**
- Microphone setup (reuse pattern from `guitarTuner.js`, `sheetMusicMicExercise.js`)
- FFT analysis loop (reuse `AnalyserNode` pattern)
- **Peak detection algorithm:**
  - Get frequency bins from `getFloatFrequencyData()`
  - Find local maxima above noise threshold
  - Filter out likely harmonics (if freq X and freq 2X both present, X is likely fundamental)
  - Return top N frequency peaks (N = number of strings in chord, typically 4-6)
- **Guitar-specific optimizations:**
  - Focus on guitar range (70-1000 Hz for fundamentals)
  - Account for chord strumming patterns (attack transient, sustain)
  - Adaptive noise floor calibration (reuse from `guitarTuner.js`)

**Key Technical Decisions:**
- **FFT Size:** Use adaptive sizing like tuner (larger for low notes, smaller for high)
  - For chords: fixed 16384 or 32768 to get good resolution across all strings
- **Window size vs latency:** Trade-off between accuracy and responsiveness
  - Target: detect chord within 500-1000ms of strum
- **Peak detection algorithm:** Simple threshold + local maxima, or more sophisticated (e.g., parabolic interpolation)

#### Step 2.2: Chord Strum Detection Timing
**Purpose:** Know WHEN to analyze (don't analyze silence)  
**Tasks:**
- Detect strum onset via RMS energy spike
- Wait for attack transient to settle (~100-200ms)
- Analyze during sustain phase
- Timeout if no strum detected within X seconds
- Allow re-strumming if first attempt was unclear

---

### Phase 3: Exercise Flow & UI

#### Step 3.1: Create `js/games/chordExercise/chordExercise.js`
**Purpose:** Main exercise controller  
**Tasks:**
- `startExercise()` / `stopExercise()` functions
- Round flow:
  1. Pick random chord from level
  2. Display chord name + diagram (reuse akkordSVG.js or <gt-fretboard>)
  3. "Listen" button → start microphone
  4. Detect strum → analyze → provide feedback
  5. Score tracking
  6. Next round
- Settings panel:
  - Difficulty level (which chords to include)
  - Time limit per chord (optional)
  - Show/hide chord diagram
- Feedback display:
  - ✓ Correct (green)
  - ✗ Wrong (red) + which strings were incorrect
  - "Try again" option

#### Step 3.2: UI Integration
**Purpose:** Wire into app navigation  
**Tasks:**
- Add HTML view to `index.html` (`#view-chord-exercise`)
- Add menu card to `#view-menu`
- Wire navigation in `js/app.js`
- Add to `sw.js` ASSETS list
- Update `version.txt`

#### Step 3.3: Chord Visualization
**Purpose:** Show target chord and detected result  
**Tasks:**
- Reuse `akkordSVG.js` for chord diagram display
- OR use `<gt-fretboard>` component (preferred for consistency)
- Show which strings should be played vs muted
- After detection, overlay detected notes on diagram
- Color coding: green = correct, red = wrong, gray = muted/missing

---

### Phase 4: Testing & Refinement

#### Step 4.1: Audio Fixture Creation
**Purpose:** Test data for automated testing  
**Tasks:**
- Record chord samples (see "Required Sound Files" section below)
- Create synthetic chord fixtures (combine individual string WAVs)
- Organize in `tests/fixtures/chords/{ChordName}/`

#### Step 4.2: Unit Tests for Audio Pipeline
**Location:** `tests/unit/chordDetectionAudio.test.js`  
**Test Cases:**
- Detect C-Dur chord from WAV fixture
- Detect G-Dur chord from WAV fixture
- Detect E-Moll chord from WAV fixture
- Detect wrong chord (play E-Dur when C-Dur expected)
- Detect muted string errors (should-muted string ringing)
- Handle slightly detuned guitar (±10 cents)
- Performance: detection completes within X ms

#### Step 4.3: Integration Testing
**Purpose:** End-to-end exercise flow  
**Tasks:**
- Test round progression with fixtures
- Test scoring accuracy
- Test settings panel (level selection, etc.)
- Test error handling (no mic permission, silence timeout)

---

## Required Sound Files for Testing

### Option 1: Record Real Chords (Recommended)
**Format:** WAV, 44100 Hz, 16-bit PCM, mono, ≥2 seconds  
**Location:** `tests/fixtures/chords/{ChordName}/`

**Minimum Required:**
```
tests/fixtures/chords/
├── C-Dur/
│   ├── correct.wav          ← C-Dur chord played correctly
│   ├── wrong-E-Dur.wav      ← E-Dur played instead (common mistake)
│   ├── missing-string.wav   ← One string not pressed properly
│   └── muted-ring.wav       ← Muted string accidentally ringing
├── G-Dur/
│   ├── correct.wav
│   └── wrong-D-Dur.wav
├── E-Moll/
│   ├── correct.wav
│   └── wrong-E-Dur.wav
├── D-Dur/
│   └── correct.wav
├── A-Moll/
│   └── correct.wav
├── E-Dur/
│   └── correct.wav
├── A-Dur/
│   └── correct.wav
└── D-Moll/
    └── correct.wav
```

**How to Record:**
1. Use a well-tuned guitar
2. Record in a quiet room
3. Strum chord clearly, let it ring for 2+ seconds
4. Save as WAV (not MP3)
5. Name files descriptively

### Option 2: Synthetic Chords (Fallback)
If real recordings aren't available, we can synthesize chords by:
1. Using existing individual string WAVs from `tests/fixtures/audio/{Note}/`
2. Mixing them together at appropriate amplitudes
3. Adding realistic attack/sustain envelope

**Limitation:** Synthetic chords won't capture real-world complexity (string interaction, room acoustics, imperfect tuning), so tests may pass with synthetic data but fail with real guitar.

### Option 3: Hybrid Approach (Recommended for Testing)
- Use **synthetic chords** for basic unit tests (fast, deterministic, CI-friendly)
- Use **real recordings** for integration tests (validates real-world accuracy)

---

## Open Questions for User

### Q1: Chord Detection Scope
**Question:** Should the exercise detect **which specific voicing** of a chord you played, or just whether the chord is correct in principle?

**Example:** C-Dur can be played as:
- Open position (x32010)
- Barre chord at fret 3 (x35553)
- Triad voicing (x3201x)

**Options:**
- **A:** Only check that the correct note classes (C, E, G) are present, regardless of octave/voicing
- **B:** Check for the exact chord shape shown in the diagram (specific frets/strings)
- **C:** Both modes (easy = note classes, hard = exact shape)

**Recommendation:** Start with **A** (easiest to implement, most flexible for users), add **C** later as difficulty option.

---

### Q2: Strumming vs Individual Strings
**Question:** Should the user strum all strings at once, or play strings individually for detection?

**Options:**
- **A:** Strum detection (analyze all strings simultaneously) - more realistic, technically harder
- **B:** Individual string detection (play each string one by one, like tuner) - easier to implement, easier to debug which string is wrong
- **C:** Both modes (strum for flow, individual for practice)

**Recommendation:** Start with **A** (strum), as it's more natural for chord practice. If detection accuracy is poor, fall back to **B**.

---

### Q3: Feedback Granularity
**Question:** How detailed should feedback be when a chord is wrong?

**Options:**
- **A:** Simple: "✓ Correct" or "✗ Wrong, try again"
- **B:** Medium: "✗ Wrong - the G string is not ringing clearly"
- **C:** Detailed: "✗ Wrong - detected: C3, E3 (missing: G3, extra: A2). Check your 3rd and 5th strings."

**Recommendation:** Start with **B**, as it's helpful for learning without being overwhelming.

---

### Q4: Chord Library Expansion
**Question:** Should we use the existing 8 chords from akkordLogic, or expand the chord library?

**Current chords:** C-Dur, G-Dur, D-Dur, E-Moll, A-Moll, E-Dur, A-Dur, D-Moll

**Options:**
- **A:** Use existing 8 chords (faster to implement)
- **B:** Expand to include common chords: F-Dur, H-Moll, C-Moll, etc.
- **C:** Allow custom chord definitions (advanced feature)

**Recommendation:** Start with **A**, add **B** based on user feedback.

---

### Q5: Detection Timing & UX
**Question:** How should the exercise handle timing?

**Options:**
- **A:** Auto-detect: Listen continuously, detect strum, analyze automatically
- **B:** Manual: User clicks "Listen" button, then has 3 seconds to play
- **C:** Hybrid: Auto-listen after chord is shown, but user can trigger re-detection

**Recommendation:** **A** (auto-detect) for smoothest UX, with manual re-trigger option.

---

### Q6: Audio Recording Quality
**Question:** What recording setup do you have for creating test fixtures?

**Options:**
- **A:** Direct audio interface recording (clean, high-quality)
- **B:** Phone/laptop microphone (noisy, but realistic)
- **C:** I don't have recording capability - need synthetic fixtures only
- **D:** I can provide recordings later - start with synthetic tests

**This affects:** How we structure the test suite and whether we can have reliable regression tests.

---

## Technical Risks & Mitigations

### Risk 1: Chord Detection Accuracy
**Problem:** Distinguishing chord notes from harmonics, noise, and room acoustics is hard.  
**Mitigation:**
- Start with synthetic tests (deterministic, controlled)
- Gradually add real recordings
- Use conservative tolerance (±50 cents initially, tighten later)
- Provide "I don't know" option when detection confidence is low

### Risk 2: Guitar Tuning Variability
**Problem:** User's guitar may be slightly out of tune, causing false negatives.  
**Mitigation:**
- Use wider tolerance than single-note detection (±50 cents vs ±35)
- Detect overall guitar tuning offset first (like tuner does)
- Provide feedback like "your guitar seems ~10 cents flat"

### Risk 3: String Crosstalk & Muting
**Problem:** Accidentally ringing muted strings, or not ringing intended strings.  
**Mitigation:**
- Weight detection by expected string importance (root note > 5th > 3rd)
- Allow some tolerance (e.g., 5 of 6 strings correct = "mostly correct")
- Show which specific strings were problematic

### Risk 4: Performance
**Problem:** Large FFT + peak detection may be slow on low-end devices.  
**Mitigation:**
- Benchmark on typical devices
- Use adaptive FFT sizing (like tuner)
- Debounce analysis (don't run on every frame)

---

## Future Enhancements (Out of Scope for Initial Implementation)

- **Strumming pattern exercises:** Detect rhythm/timing of strums
- **Chord progression exercises:** Play chord sequences (e.g., C → G → Am → F)
- **Barre chord support:** Extended chord library beyond open position
- **Capo support:** Transpose chords for capo position
- **Left-handed mode:** Mirror chord diagrams
- **Progress tracking:** Which chords need more practice
- **Adaptive difficulty:** Focus on chords the user struggles with

---

## Success Criteria

The feature is complete when:
1. ✅ User can start exercise from menu
2. ✅ Tool shows random chords from selected difficulty level
3. ✅ User can play chord on guitar
4. ✅ Tool correctly identifies whether chord was played accurately (≥90% accuracy on test fixtures)
5. ✅ Tool provides actionable feedback for incorrect chords
6. ✅ Score tracking works
7. ✅ All unit tests pass (synthetic + real audio fixtures)
8. ✅ Works offline (PWA, no network required)
9. ✅ Works on mobile (responsive, microphone access on iOS/Android)

---

## Dependencies & Reusable Components

| Component | Source | Reuse Strategy |
|-----------|--------|----------------|
| `detectPitch`, `frequencyToNote` | `tunerLogic.js` | Import directly |
| `GUITAR_MIN_FREQUENCY`, `GUITAR_MIN_RMS` | `pitchLogic.js` | Import constants |
| `CHORDS` data | `akkordLogic.js` | Import chord definitions |
| `<gt-fretboard>` | `js/components/fretboard/` | Use for chord visualization |
| Microphone setup pattern | `guitarTuner.js` | Copy AudioContext + getUserMedia pattern |
| FFT analysis pattern | `guitarTuner.js` | Copy AnalyserNode setup |
| WAV test helpers | `tests/helpers/wavDecoder.js` | Reuse for fixture loading |
| Test fixture structure | `tests/fixtures/audio/` | Mirror for chord fixtures |

---

## Estimated Complexity

| Phase | Complexity | Dependencies |
|-------|------------|--------------|
| Phase 1: Logic | Medium (2-3 days) | None |
| Phase 2: Audio | High (4-5 days) | Phase 1, user provides sound files |
| Phase 3: UI | Low (1-2 days) | Phase 1 |
| Phase 4: Testing | Medium (2-3 days) | Phase 2, sound files |

**Total:** ~2 weeks of focused work (excluding time for user to provide sound files)

---

## Next Steps

1. **User answers questions Q1-Q6** above
2. **User provides sound files** (or confirms synthetic-only approach)
3. **Implement Phase 1** (chordDetectionLogic.js + tests)
4. **Review & validate** logic tests
5. **Implement Phase 2** (audio pipeline)
6. **Implement Phase 3** (exercise flow & UI)
7. **Implement Phase 4** (testing with real audio)
8. **Beta testing** with real guitar
9. **Refine** based on detection accuracy feedback

---

## Changelog

| Date | Change |
|------|--------|
| 2026-04-12 | Initial plan created |

---

# Plan: Enhanced "Noten lesen" with Metronome, Moving Bar & Endless Mode

**Status:** 📋 Planning  
**Created:** 2026-04-12  
**Goal:** Transform "Noten lesen" from a static sheet music display into a dynamic, metronome-guided, auto-scrolling practice tool with moving playback bar and endless mode.

---

## Overview

The current "Noten lesen" exercise shows 4 static bars of sheet music with no timing guidance. This plan adds:

1. **Integrated metronome** with adjustable BPM (reusing existing metronome logic)
2. **Moving playback bar** that progresses through the music at the metronome's speed
3. **Multiple time signatures** (3/4, 4/8, 6/8, etc.) beyond the current hardcoded 4/4
4. **Endless mode** with auto-generating new lines in an auto-scrolling window
5. **Visual playhead** showing exactly which note to play right now

---

## Technical Approach

### Architecture

The existing architecture has 3 layers: Controller (`sheetMusicReading.js`), Logic (`sheetMusicLogic.js`), and SVG rendering (`sheetMusicSVG.js`). We'll extend this with a **Playhead Controller** and **Metronome Integration**.

```
┌──────────────────────────────────────────────────────────────┐
│  sheetMusicReading.js (Exercise Controller)                  │
│  - Manages exercise state, UI, event handling                │
│  - Coordinates metronome + playback bar + score display      │
│  - Handles endless mode auto-scrolling                       │
└───────┬──────────────────────┬──────────────────────┬────────┘
        │                      │                      │
        ▼                      ▼                      ▼
┌───────────────┐  ┌──────────────────┐  ┌────────────────────┐
│ PlaybackBar   │  │ MetronomeLogic   │  │ sheetMusicLogic.js │
│ (Visual play- │  │ (reuse from      │  │ (extended)         │
│ head + scroll)│  │  metronome tool) │  │ - multi time sigs  │
│ - SVG overlay │  │ - BPM control    │  │ - endless generation│
│ - Moving bar  │  │ - beat callback  │  │ - bar generation   │
└───────────────┘  └────────┬─────────┘  └────────────────────┘
                            │              │
                            ▼              ▼
┌──────────────────────────────────────────────────────────────┐
│  sheetMusicSVG.js (Rendering)                                │
│  - VexFlow notation rendering (extended for multiple signatures)│
│  - Moving playback bar overlay (SVG animation)               │
│  - Auto-scroll container management                          │
└──────────────────────────────────────────────────────────────┘
```

---

## Implementation Phases

### Phase 1: Metronome Integration (Foundation)

**Goal:** Get metronome working inside the sheet music exercise  
**Estimated Complexity:** Low (1-2 days)  
**Dependencies:** None (reuses existing MetronomeLogic)

#### Step 1.1: Create `js/games/sheetMusicReading/playbackController.js`
**Purpose:** Bridge between metronome and sheet music display  
**Tasks:**
- Import and wrap `MetronomeLogic` (reuse from `js/tools/metronome/metronomeLogic.js`)
- Create `PlaybackController` class:
  - `start(bpm, beatsPerMeasure, totalBeats)` — starts metronome
  - `stop()` — stops metronome
  - `getCurrentBeat()` → `{barIndex, beatIndex}` — maps metronome beat to bar/beat position
  - `onBeat(callback)` — sets callback for beat changes
  - `setBpm(bpm)` — adjusts tempo
- Calculate total beats from `bars.length * beatsPerBar`
- Handle loop/end behavior (stop at end vs. loop vs. endless mode)

#### Step 1.2: Extend UI with Metronome Controls
**Purpose:** Add BPM and time signature controls to sheet music view  
**Tasks:**
- Update `index.html` `#view-sheet-music`:
  - Add BPM slider (40-240, default 80 for reading practice)
  - Add time signature selector (2/4, 3/4, 4/4, 3/8, 6/8)
  - Add "Start/Stop" toggle button
  - Add "Play" button (starts metronome + playback bar)
- Wire controls in `sheetMusicReading.js`
- Style controls (reuse metronome CSS classes where possible)

#### Step 1.3: Update `sheetMusicLogic.js` for Flexible Time Signatures
**Purpose:** Support bar generation for different time signatures  
**Tasks:**
- Extend `generateBars(numBars, beatsPerBar, notesPool, noteDuration)`:
  - Add `noteDuration` parameter: `'q'` (quarter), `'e'` (eighth), `'h'` (half)
  - For simple signatures (2/4, 3/4, 4/4): default to quarter notes
  - For compound signatures (6/8): default to eighth notes
- Add `getTimeSignatureConfig(timeSignature)` → `{beatsPerBar, noteDuration, vfTimeSig}`:
  - `'2/4'` → `{beatsPerBar: 2, noteDuration: 'q', vfTimeSig: '2/4'}`
  - `'3/4'` → `{beatsPerBar: 3, noteDuration: 'q', vfTimeSig: '3/4'}`
  - `'4/4'` → `{beatsPerBar: 4, noteDuration: 'q', vfTimeSig: '4/4'}`
  - `'3/8'` → `{beatsPerBar: 3, noteDuration: 'e', vfTimeSig: '3/8'}`
  - `'6/8'` → `{beatsPerBar: 6, noteDuration: 'e', vfTimeSig: '6/8'}`
- Export helper `validateTimeSignature(sig)` → boolean

#### Step 1.4: Tests for Phase 1
**Location:** `tests/unit/playbackController.test.js`  
**Test Cases:**
- `getCurrentBeat()` returns correct bar/beat mapping for 4/4
- `getCurrentBeat()` wraps correctly at end
- `getCurrentBeat()` handles 3/4 time signature
- `getCurrentBeat()` handles 6/8 time signature
- `setBpm()` updates metronome BPM
- Start/stop lifecycle works correctly
- `onBeat` callback fires on metronome beat

**Location:** `tests/unit/sheetMusicLogic.timeSignatures.test.js`  
**Test Cases:**
- `getTimeSignatureConfig('4/4')` returns correct config
- `getTimeSignatureConfig('3/4')` returns 3 beats, quarter notes
- `getTimeSignatureConfig('6/8')` returns 6 beats, eighth notes
- `getTimeSignatureConfig('3/8')` returns 3 beats, eighth notes
- `generateBars` with `noteDuration='e'` creates correct structure
- Invalid time signature returns null/throws
- All 5 time signatures produce valid bar structures

---

### Phase 2: Moving Playback Bar

**Goal:** Visual playhead that moves with the metronome  
**Estimated Complexity:** Medium (2-3 days)  
**Dependencies:** Phase 1 complete

#### Step 2.1: Create `js/games/sheetMusicReading/playbackBar.js`
**Purpose:** SVG moving bar overlay  
**Tasks:**
- Create `PlaybackBar` class
- `render(container, staveLayout)` — creates SVG overlay element
  - Vertical bar spanning full staff height
  - Positioned at left edge initially
  - Styled with accent color (e.g., orange highlight)
- `moveToBeat(barIndex, beatIndex, stavePositions, beatsPerBar)` — animates to position
  - Calculate x-position: `stavePositions[barIndex] + (beatIndex / beatsPerBar) * barWidth`
  - Use CSS transitions for smooth movement
  - Duration = time between beats (derived from BPM)
- `hide()` / `show()` — visibility control
- Handle bar boundaries (don't cross into next bar)

**Technical Details:**
- SVG `<line>` element with animation
- X-positions calculated from VexFlow stave geometry
- Transition timing: `transition: transform {beatDuration}s linear`
- `beatDuration = 60 / BPM` seconds

#### Step 2.2: Integrate Playback Bar with Exercise
**Purpose:** Connect metronome beats to visual bar movement  
**Tasks:**
- In `sheetMusicReading.js`, on exercise start:
  - Create `PlaybackBar` instance
  - Start metronome via `PlaybackController`
  - On each beat callback, call `playbackBar.moveToBeat()`
- On stop/reset, hide playback bar
- Sync bar position when BPM changes mid-exercise

#### Step 2.3: Highlight Current Note
**Purpose:** Visually emphasize the note currently being played  
**Tasks:**
- Extend `sheetMusicSVG.js` to support per-note highlighting
- Add `highlightNote(container, barIndex, beatIndex)` function:
  - Changes note color to accent (e.g., orange)
  - Increases note size slightly (scale 1.1x)
  - Previous note returns to normal color
- Integrate with playback controller beat callback
- Handle note rest states (if we add rests later)

#### Step 2.4: Tests for Phase 2
**Location:** `tests/unit/playbackBar.test.js`  
**Test Cases:**
- PlaybackBar calculates correct x-position for beat 0 of bar 0
- PlaybackBar calculates correct x-position for beat 2 of bar 1
- PlaybackBar handles bar boundaries correctly
- Position calculation works with 3/4 time signature
- Position calculation works with 6/8 time signature
- `moveToBeat` applies correct CSS transition
- Hide/show toggles visibility correctly

---

### Phase 3: Multiple Time Signatures in Rendering

**Goal:** Support rendering 3/4, 4/8, 6/8, etc. in VexFlow  
**Estimated Complexity:** Medium (2-3 days)  
**Dependencies:** Phase 1 (time signature logic)

#### Step 3.1: Extend VexFlow Rendering for Multiple Signatures
**Purpose:** Render correct time signature glyphs and bar structures  
**Tasks:**
- Update `sheetMusicSVG.js` `renderScore()`:
  - Accept `timeSignature` parameter
  - Pass correct time signature string to VexFlow: `stave.addTimeSignature(vfTimeSig)`
  - Adjust voice configuration for different note durations:
    - Quarter notes: `{num_beats: 4, beat_value: 4}` for 4/4
    - Eighth notes: `{num_beats: 6, beat_value: 8}` for 6/8
    - Calculate dynamically from time signature config
- Adjust stave widths based on beats per bar:
  - More beats = wider bars needed
  - Formula: `barWidth = baseWidth * (beatsPerBar / 4)`
- Handle beaming for eighth notes (VexFlow auto-beams, but verify)

#### Step 3.2: Update Tab Rendering for Different Note Durations
**Purpose:** Tab shows correct rhythmic spacing  
**Tasks:**
- Extend `renderTab()` in `sheetMusicSVG.js`:
  - Accept `beatsPerBar` parameter
  - Adjust beat spacing: `barW / (beatsPerBar + 1)`
  - Handle different note durations (eighth notes might be closer together)

#### Step 3.3: UI Time Signature Selector
**Purpose:** Let user choose time signature  
**Tasks:**
- Add `<select id="sheet-music-time-sig">` to `index.html`
- Options: 2/4, 3/4, 4/4 (default), 3/8, 6/8
- On change: regenerate bars with new time signature, re-render
- Save preference to `localStorage` (like metronome does)

#### Step 3.4: Tests for Phase 3
**Location:** `tests/unit/sheetMusicSVG.timeSignatures.test.js` (DOM + jsdom tests)  
**Test Cases:**
- `renderScore` with 3/4 time signature renders correct VexFlow time sig
- `renderScore` with 6/8 time signature renders correct VexFlow time sig
- Voice configuration matches time signature (quarter vs eighth notes)
- Stave widths adjust proportionally to beats per bar
- Tab rendering adjusts spacing for different beat counts
- Bar count matches expected (still 4 bars, just different beats per bar)

---

### Phase 4: Endless Mode & Auto-Scrolling

**Goal:** Continuous stream of new lines, auto-scrolling at metronome speed  
**Estimated Complexity:** High (4-5 days)  
**Dependencies:** Phase 1, Phase 2

#### Step 4.1: Endless Bar Generation Engine
**Purpose:** Continuously generate new bars on demand  
**Tasks:**
- Create `EndlessBarGenerator` class in `sheetMusicLogic.js` (or separate file):
  - `nextBatch(count=8)` → generates next N bars
  - Maintains state for melodic continuity (last note index across batches)
  - Pre-generates bars ahead of playback (buffer of 8-12 bars)
  - Handles edge cases: running out of note pool, string filter changes
- Add to state: `endlessBuffer: Note[][]`, `endlessPlayIndex: number`

#### Step 4.2: Auto-Scroll Container
**Purpose:** Smooth scrolling that follows the playback bar  
**Tasks:**
- Create scrollable container in `sheetMusicSVG.js`:
  - Outer div with `overflow: hidden`, fixed height
  - Inner div with all rendered staves (much taller than viewport)
  - Calculate scroll position based on current beat
  - Smooth scroll animation: `scrollTo(yPosition, {behavior: 'smooth'})`
  - Keep playback bar in center of viewport (or 1/3 from top)
- Handle scroll boundaries (don't scroll past beginning/end)
- Adjust scroll speed based on BPM (faster BPM = faster scroll)

**Technical Approach:**
```
scrollPosition = (currentBarIndex / totalBars) * (totalHeight - viewportHeight)
Keep current bar at ~33% from top of viewport
```

#### Step 4.3: Endless Mode Exercise Flow
**Purpose:** Complete endless mode user experience  
**Tasks:**
- Add "Endless Mode" toggle to UI
- When enabled:
  1. Start with 8 bars rendered
  2. Metronome starts, playback bar moves
  3. When playback reaches bar N-4, generate 4 more bars and append
  4. Auto-scroll follows playback bar
  5. Never stops (until user clicks Stop)
  6. Score tracking (optional: track correct/missed notes if we add mic later)
- Infinite scroll without performance degradation:
  - Remove bars from DOM that are off-screen (>8 bars behind)
  - Or use virtualization (only render visible bars + buffer)

#### Step 4.4: Virtualization (Performance Optimization)
**Purpose:** Prevent DOM bloat in endless mode  
**Tasks:**
- Implement simple virtualization:
  - Keep only bars in range `[currentBar - 4, currentBar + 12]` in DOM
  - As playback progresses, remove old bars, add new bars
  - Update scroll position accordingly
  - Ensure smooth transitions (no visual jumps)
- Alternative: Chunk-based rendering
  - Render bars in chunks of 8
  - Each chunk is a separate SVG/stave group
  - Remove chunks that are off-screen

#### Step 4.5: Tests for Phase 4
**Location:** `tests/unit/endlessBarGenerator.test.js`  
**Test Cases:**
- `nextBatch(8)` generates 8 bars with correct structure
- Melodic continuity maintained across batch boundaries
- Respects time signature (e.g., 3/4 bars have 3 beats each)
- Respects note pool filters (maxFret, activeStrings)
- Handles empty note pool gracefully
- Performance: generates 100 bars in <100ms
- State persists across multiple `nextBatch` calls

**Location:** `tests/unit/autoScroll.test.js`  
**Test Cases:**
- Scroll position calculated correctly for bar 0
- Scroll position calculated correctly for bar 10
- Scroll keeps current bar at target viewport position
- Handles edge case: first bar (don't scroll past top)
- Handles edge case: very slow BPM (20 BPM)
- Handles edge case: very fast BPM (240 BPM)

---

### Phase 5: Polish & Integration

**Goal:** Final UX improvements, edge cases, performance  
**Estimated Complexity:** Medium (2-3 days)  
**Dependencies:** All previous phases

#### Step 5.1: State Persistence
**Purpose:** Remember user preferences  
**Tasks:**
- Save to `localStorage`:
  - `sheetMusic_bpm` (default 80)
  - `sheetMusic_timeSignature` (default '4/4')
  - `sheetMusic_endlessMode` (default false)
  - `sheetMusic_showTab` (already tracked, add persistence)
- Restore on exercise start

#### Step 5.2: Keyboard Shortcuts
**Purpose:** Hands-free control while practicing  
**Tasks:**
- Space bar: Start/Stop playback
- Arrow Up/Down: Increase/decrease BPM by 5
- Arrow Left/Right: Step backward/forward one beat (when paused)
- R: Regenerate new bars
- T: Toggle tab display
- E: Toggle endless mode

#### Step 5.3: Error Handling & Edge Cases
**Purpose:** Robust behavior  
**Tasks:**
- Handle note pool too small (e.g., only 1 string, fret 0)
  - Show warning: "Note pool too small, using all available notes"
- Handle rapid time signature changes mid-playback
- Handle tab focus loss (pause metronome when tab not visible)
- Handle mobile viewport changes (orientation change, keyboard appearing)

#### Step 5.4: Visual Polish
**Purpose:** Better UX  
**Tasks:**
- Animate playback bar with smooth CSS transitions
- Add subtle glow/shadow to current note
- Show BPM and time signature in large display during playback
- Add "upcoming notes" preview (faded, next 2-4 bars)
- Add visual metronome indicator (reusing `MetronomeSVG` beat dots)

#### Step 5.5: Tests for Phase 5
**Location:** `tests/unit/sheetMusicLogic.edgeCases.test.js`  
**Test Cases:**
- Small note pool (1 string, fret 0) still generates bars
- Time signature change mid-stream handled gracefully
- Empty settings object uses defaults
- localStorage persistence works (mock localStorage in jsdom)
- Keyboard shortcut handlers registered correctly

---

## Test Summary

### New Test Files

| Test File | Purpose | Estimated Tests |
|-----------|---------|-----------------|
| `tests/unit/playbackController.test.js` | Metronome integration, beat tracking | 8-10 |
| `tests/unit/sheetMusicLogic.timeSignatures.test.js` | Time signature configs, bar generation | 10-12 |
| `tests/unit/playbackBar.test.js` | Moving bar position calculations | 8-10 |
| `tests/unit/sheetMusicSVG.timeSignatures.test.js` | VexFlow rendering for different signatures | 6-8 |
| `tests/unit/endlessBarGenerator.test.js` | Endless mode bar generation | 10-12 |
| `tests/unit/autoScroll.test.js` | Scroll position calculations | 6-8 |
| `tests/unit/sheetMusicLogic.edgeCases.test.js` | Edge cases, persistence | 8-10 |

**Total new tests:** ~60-70 test cases

**Existing tests to extend:**
- `tests/unit/sheetMusicLogic.test.js`: Add tests for new `getTimeSignatureConfig`, extended `generateBars`
- `tests/unit/metronomeLogic.test.js`: Already sufficient (no changes needed to metronome logic itself)

---

## Sound Files for Testing

**Good news:** This feature is **purely visual + metronome audio**. The metronome generates its own audio via oscillators (no external sound files needed).

**No sound files required from user.**

However, for **future microphone-based note validation** (optional future enhancement), you could provide:
```
tests/fixtures/sheetMusicMic/
├── C4-correct.wav         ← User plays C4 correctly
├── C4-wrong-D4.wav        ← User plays D4 instead
├── E3-correct.wav         ← User plays E3 correctly
└── ...                    ← One per note in the NOTES pool
```

But this is **NOT needed for the current plan** — it would be a separate "Noten spielen" (play notes) feature.

---

## Order of Implementation (Prioritized)

**MUST have (core functionality):**
1. ✅ Phase 1: Metronome integration (foundation)
2. ✅ Phase 2: Moving playback bar (visual guidance)
3. ✅ Phase 3: Multiple time signatures (flexibility)
4. ✅ Phase 4: Endless mode + auto-scrolling (continuous practice)

**SHOULD have (important UX):**
5. ✅ Phase 5.1: State persistence
6. ✅ Phase 5.3: Error handling
7. ✅ Phase 5.4: Visual polish (playhead animation, current note highlight)

**NICE to have (future enhancement):**
8. ⬜ Phase 5.2: Keyboard shortcuts
9. ⬜ Phase 4.4: Virtualization (only needed if performance is an issue)
10. ⬜ Microphone-based note validation (separate feature)

---

## Open Questions for User

### Q1: Note Duration Display
**Question:** Should notes in 6/8 time be displayed as individual eighth notes, or beamed together in groups?

**Example for 6/8:**
- **A:** Individual eighth notes (simpler, matches current implementation)
- **B:** Beamed in groups of 3 (standard 6/8 notation: two groups of 3 eighth notes)
- **C:** Beamed in groups of 2 (three groups of 2 eighth notes)

**Recommendation:** **B** (groups of 3 is standard 6/8 notation, but requires VexFlow beaming configuration).

---

### Q2: Moving Bar Behavior at Bar Boundaries
**Question:** Should the playback bar:
- **A:** Jump instantly from the end of one bar to the start of the next
- **B:** Sweep smoothly across bar boundaries (continuous animation)
- **C:** Pause briefly at bar lines (emphasizes bar structure)

**Recommendation:** **B** (smooth sweep is easiest to follow visually).

---

### Q3: Endless Mode — How Many Bars Visible?
**Question:** In endless mode, how many bars should be visible on screen at once?
- **A:** 4 bars (current default, less scrolling)
- **B:** 6-8 bars (more preview, more scrolling)
- **C:** 12+ bars (lots of preview, heavy scrolling)
- **D:** Adjustable via slider

**Recommendation:** **B** (6-8 bars is a good balance of preview vs. readability).

---

### Q4: Auto-Scroll Speed
**Question:** Should the scroll speed be:
- **A:** Constant (always keeps current bar at fixed viewport position, e.g., 33% from top)
- **B:** Smooth (gradually scrolls, speed matches BPM)
- **C:** Step-based (jumps to next bar position on each bar change)

**Recommendation:** **A** (constant position is easiest to follow — the music scrolls past you, rather than you chasing the music).

---

### Q5: Default BPM for Practice
**Question:** What should the default BPM be when starting the exercise?
- **A:** 60 BPM (very slow, good for beginners)
- **B:** 80 BPM (moderate, recommended for sight reading practice)
- **C:** 100 BPM (moderately fast)
- **D:** 120 BPM (current metronome default, might be too fast for reading)

**Recommendation:** **B** (80 BPM is a good sight-reading tempo — not too slow to be boring, not too fast to be overwhelming).

---

### Q6: Time Signature Default & Order
**Question:** Which time signatures should be available, and which is default?
- **A:** Minimal: 4/4 only (simplest implementation)
- **B:** Common: 2/4, 3/4, 4/4 (default: 4/4)
- **C:** Full: 2/4, 3/4, 4/4 (default), 3/8, 6/8
- **D:** Custom: let user define any signature (e.g., 5/4, 7/8)

**Recommendation:** **C** (covers 95% of common guitar practice material).

---

### Q7: Playback Bar Visibility Before Starting
**Question:** Before pressing "Play", should the playback bar be:
- **A:** Visible at the first note position (shows where you'll start)
- **B:** Hidden until playback starts
- **C:** Visible but grayed out (indicates "ready" state)

**Recommendation:** **A** (gives visual cue of starting position).

---

### Q8: Exercise Reset Behavior
**Question:** When user changes settings (time signature, fret range, strings) during playback:
- **A:** Auto-stop playback, regenerate bars, user must press Play again
- **B:** Continue playing, regenerate only affects next regeneration
- **C:** Pause, regenerate, auto-resume

**Recommendation:** **A** (clearest behavior, avoids confusion about which bars are being played).

---

### Q9: Endless Mode — Melodic Coherence
**Question:** In endless mode, should the melodic constraint (±2 diatonic steps) apply:
- **A:** Only within each batch of bars (resets at batch boundary)
- **B:** Across batch boundaries (continuous melodic flow)
- **C:** Stricter constraint (±1 diatonic step for smoother melodies)

**Recommendation:** **B** (continuous flow sounds more musical, but requires stateful generator).

---

### Q10: Tab Display in Endless Mode
**Question:** Should tabs be shown in endless mode?
- **A:** Yes, if tab toggle is on (consistent with non-endless mode)
- **B:** No, tabs disabled in endless mode (too much visual clutter)
- **C:** Optional, but only for visible bars (performance optimization)

**Recommendation:** **A** (consistency is more important than clutter — users who want tabs should have them).

---

## Technical Risks & Mitigations

### Risk 1: VexFlow Beaming Complexity
**Problem:** Eighth note beaming in 6/8 requires VexFlow voice grouping configuration, which can be tricky.  
**Mitigation:** 
- Start with un-beamed eighth notes (Phase 1)
- Add beaming as polish later (Phase 5)
- Test with VexFlow documentation examples

### Risk 2: Auto-Scroll Performance
**Problem:** Continuous DOM manipulation (adding/removing bars) in endless mode may cause jank.  
**Mitigation:**
- Start without virtualization (Phase 4)
- Monitor performance with 50+ bars
- Add virtualization only if needed (Phase 4.4)

### Risk 3: Metronome + Animation Sync
**Problem:** CSS transitions may drift from metronome beats over time.  
**Mitigation:**
- Recalculate bar position on EVERY beat (not just animate once)
- Use short transition duration (80% of beat interval) to allow catch-up
- Test at extreme BPM (40 and 240)

### Risk 4: Mobile Viewport
**Problem:** Small screens may not show enough bars for effective practice.  
**Mitigation:**
- Responsive SVG sizing (already implemented)
- Test on actual mobile devices
- Consider landscape-only mode for sheet music

### Risk 5: Browser Tab Visibility
**Problem:** Metronome may continue playing when tab is hidden (user walks away).  
**Mitigation:**
- Use Page Visibility API (`document.hidden`)
- Auto-pause when tab becomes hidden
- Auto-resume when tab becomes visible (optional)

---

## Future Enhancements (Out of Scope)

- **Microphone validation:** Listen to user play notes, check correctness (combine with `sheetMusicMic` approach)
- **Difficulty levels:** Easy mode (larger intervals, slower), Hard mode (chromatic notes, faster)
- **Key signatures:** Generate music in different keys (G major, D major, etc.)
- **Rhythmic variety:** Mix quarter, eighth, half notes within same bar
- **Rests:** Include rests in generated music
- **Chord tones:** Generate chord arpeggios (C-E-G-C, etc.)
- **Export/Import:** Save custom exercises as JSON, share with others
- **Progress tracking:** Track which notes/intervals user struggles with
- **Sight-reading exams:** Timed tests with scoring

---

## Success Criteria

The feature is complete when:
1. ✅ Metronome plays at adjustable BPM (40-240)
2. ✅ Playback bar moves smoothly through the music at metronome speed
3. ✅ Current note is highlighted as playback bar passes it
4. ✅ User can select 2/4, 3/4, 4/4, 3/8, 6/8 time signatures
5. ✅ VexFlow renders correct time signature glyphs and note durations
6. ✅ Endless mode generates continuous stream of new bars
7. ✅ Auto-scrolling follows playback bar smoothly
8. ✅ All settings (BPM, time signature) persist to localStorage
9. ✅ All ~60-70 unit tests pass
10. ✅ Works on mobile (responsive, touch-friendly controls)
11. ✅ No audio files required (metronome generates its own sound)

---

## Dependencies & Reusable Components

| Component | Source | Reuse Strategy |
|-----------|--------|----------------|
| `MetronomeLogic` | `js/tools/metronome/metronomeLogic.js` | Import class directly |
| `MetronomeSVG` | `js/tools/metronome/metronomeSVG.js` | Reuse beat dot display |
| `generateBars` | `js/games/sheetMusicReading/sheetMusicLogic.js` | Extend with time signature params |
| `renderScore` | `js/games/sheetMusicReading/sheetMusicSVG.js` | Extend with time signature rendering |
| VexFlow | CDN (v4.2.2) | Use beaming/voice grouping for 6/8 |
| localStorage pattern | `metronome.js` | Copy persistence approach |
| String toggles, fret slider | `sheetMusicReading.js` | Already implemented, reuse |

---

## Files to Create/Modify

### New Files
```
js/games/sheetMusicReading/
├── playbackController.js       — Metronome integration + beat tracking
├── playbackBar.js              — SVG moving bar overlay
└── endlessBarGenerator.js      — Continuous bar generation (Phase 4)

tests/unit/
├── playbackController.test.js
├── playbackBar.test.js
├── sheetMusicLogic.timeSignatures.test.js
├── sheetMusicSVG.timeSignatures.test.js
├── endlessBarGenerator.test.js
├── autoScroll.test.js
└── sheetMusicLogic.edgeCases.test.js
```

### Modified Files
```
js/games/sheetMusicReading/
├── sheetMusicLogic.js          — Add getTimeSignatureConfig, extend generateBars
├── sheetMusicReading.js        — Add metronome controls, endless mode, event wiring
└── sheetMusicSVG.js            — Support multiple time signatures, playback bar overlay

index.html                       — Add metronome controls, time signature selector, play button
style.css                        — Add styles for playback bar, scroll container, highlights
sw.js                            — Add new JS files to ASSETS list
version.txt                      — Update timestamp
```

---

## Estimated Timeline

| Phase | Complexity | Duration |
|-------|------------|----------|
| Phase 1: Metronome Integration | Low | 1-2 days |
| Phase 2: Moving Playback Bar | Medium | 2-3 days |
| Phase 3: Multiple Time Signatures | Medium | 2-3 days |
| Phase 4: Endless Mode & Auto-Scroll | High | 4-5 days |
| Phase 5: Polish & Integration | Medium | 2-3 days |

**Total:** ~11-16 days of focused implementation

---

## Next Steps

1. **User answers questions Q1-Q10** above
2. **Refine plan** based on answers (update backlog)
3. **Start Phase 1** — Metronome integration (TDD approach)
   - Write tests for `playbackController.js`
   - Implement `playbackController.js`
   - Write tests for time signature logic
   - Extend `sheetMusicLogic.js`
4. **Review Phase 1** — all tests passing, code reviewed
5. **Continue through phases** sequentially
6. **Beta test** with real guitar + sheet music reading
7. **Refine** based on UX feedback

---

## Additional Considerations (Added After Review)

### A1: AudioContext Lifecycle Management
**Issue:** The metronome creates an AudioContext, but the sheet music exercise doesn't currently manage audio lifecycle.  
**What's Missing from Plan:**
- When should AudioContext be created? (on first "Play" click, not on exercise start — browsers block autoplay)
- When should it be destroyed? (on exercise stop, to free resources)
- What if user switches away and back? (AudioContext may be suspended by browser)

**Action:** Add to Phase 1, Step 1.1:
- `PlaybackController` must handle AudioContext lifecycle:
  - Lazy-init on first user gesture (Play button click)
  - Check `audioContext.state === 'suspended'` and resume before starting
  - Properly close on `stopExercise()`
- Add test: `tests/unit/playbackController.test.js` → "AudioContext lifecycle management"

---

### A2: VexFlow SVG Element Access
**Issue:** The plan mentions highlighting individual notes, but VexFlow renders notes as SVG elements without IDs or easy selectors.  
**What's Missing from Plan:**
- How do we identify which SVG element corresponds to which note in the bar?
- VexFlow doesn't expose a note-to-element mapping by default.

**Action:** Add to Phase 2, Step 2.3:
- Approach A: After VexFlow renders, query SVG for note groups and map by position (x-coordinate)
- Approach B: Extend VexFlow's `StaveNote` to add custom attributes (e.g., `data-bar-index`, `data-beat-index`)
- Approach C: Wrap each `StaveNote` draw call to capture the returned SVG element
- **Recommended:** Approach B (cleanest, but requires checking VexFlow API compatibility)
- Add test: Verify note elements can be uniquely identified and styled

---

### A3: Mobile Touch Interactions
**Issue:** Plan doesn't address how mobile users interact with controls while holding guitar.  
**What's Missing from Plan:**
- Touch targets must be large enough (min 44x44px per Apple HIG)
- Sliders are hard to use with wet/greasy fingers (guitar practice!)
- Need large, obvious buttons for Start/Stop, BPM +/- 

**Action:** Add to Phase 5.4 (Visual Polish):
- Ensure all controls meet WCAG 2.1 touch target size (44x44 CSS px minimum)
- Add large "Play/Stop" floating action button (FAB) for easy access
- Consider voice control? ("Hey Siri, stop metronome") — out of scope, but note as future idea
- Test on actual mobile device with guitar in hand

---

### A4: Test Data for VexFlow Rendering Tests
**Issue:** Plan mentions `sheetMusicSVG.timeSignatures.test.js` but jsdom doesn't fully support SVG rendering.  
**What's Missing from Plan:**
- VexFlow requires a real DOM or compatible environment to render SVG
- jsdom has limited SVG support — tests may fail or be incomplete

**Action:** Revise test strategy:
- **Option A:** Skip VexFlow rendering tests in unit tests, rely on manual testing + integration tests
- **Option B:** Use jsdom but only test VexFlow configuration (time signature strings, voice setup), not actual SVG output
- **Option C:** Add Playwright/Puppeteer integration tests (heavier CI setup)
- **Recommended:** Option B for now (test configuration, not rendering), add note about needing integration tests later
- Update test file description: "Tests VexFlow configuration, not visual output"

---

### A5: Scrolling Implementation Details
**Issue:** Auto-scroll plan is vague on technical approach.  
**What's Missing from Plan:**
- Should we use `window.scrollTo()`, `element.scrollTo()`, or CSS `transform: translateY()`?
- How do we handle smooth scrolling across different browsers?
- What if user manually scrolls (e.g., to look ahead)?

**Action:** Add to Phase 4, Step 4.2:
- **Technical approach:** Use `container.scrollTo({top: y, behavior: 'smooth'})`
  - Pros: Native smooth scrolling, accessible
  - Cons: May not be smooth on older browsers (polyfill available)
- **Alternative:** CSS `transform: translateY()` on inner container
  - Pros: GPU-accelerated, very smooth
  - Cons: Removes scroll bars, user can't manually scroll
- **Recommended:** Start with `element.scrollTo()`, switch to CSS transform if performance is poor
- **User control:** If user manually scrolls, pause auto-scroll for 5 seconds, then resume
- Add to tests: Test both programmatic scroll and manual scroll interruption

---

### A6: State Management for Endless Mode
**Issue:** Plan doesn't specify how to track state in endless mode (which bars generated, which played, etc.).  
**What's Missing from Plan:**
- Need to track: total bars generated, total bars played, current position
- Memory management: old bars removed from DOM, but state still needed for scoring/replay?
- What happens if user changes settings mid-endless? (strings, frets, time signature)

**Action:** Add to Phase 4, Step 4.3:
- State object for endless mode:
  ```js
  {
    mode: 'endless',
    barsGenerated: 0,        // total bars ever generated
    barsPlayed: 0,           // total bars played through
    currentBarIndex: 0,      // position in current buffer
    buffer: Note[][],        // currently rendered bars (8-12)
    bufferStartIndex: 0,     // global index of first bar in buffer
  }
  ```
- Settings change behavior: Stop playback, clear buffer, regenerate with new settings, user presses Play to restart
- Add to tests: State consistency after 1000+ bars generated/played

---

### A7: Accessibility (a11y)
**Issue:** Plan doesn't mention accessibility for visually impaired users.  
**What's Missing from Plan:**
- Screen readers can't read SVG notation (VexFlow output)
- Tab display is visual-only
- No keyboard navigation for playback controls

**Action:** Add to Phase 5 (Polish) or mark as future enhancement:
- Add `aria-label` to playback controls
- Add `role="img"` and `aria-label` to SVG score display (e.g., "Sheet music: 4 bars in 4/4 time")
- Add aria-live region for current note announcement (optional, may be annoying)
- **Note:** Full a11y for sheet music is a hard problem — mark as "future enhancement" for now
- Add to success criteria: "Controls are keyboard-navigable" (already in Phase 5.2)

---

### A8: Performance Benchmarks
**Issue:** Plan doesn't specify performance targets.  
**What's Missing from Plan:**
- How fast should bar generation be? (Phase 4 mentions 100 bars in <100ms, but no target for normal 4-bar generation)
- How much CPU can metronome use? (shouldn't cause audio glitches)
- What's acceptable scroll frame rate? (target: 60fps)

**Action:** Add to Success Criteria:
- Bar generation: 4 bars in <50ms, 100 bars in <500ms
- Metronome: <2% CPU usage during playback (measure via Chrome DevTools)
- Auto-scroll: 60fps (no jank, measured via `performance.now()` deltas)
- Initial exercise load time: <2 seconds (including VexFlow from CDN)
- Add performance tests: `tests/performance/` folder (separate from unit tests, run on demand)

---

### A9: VexFlow CDN Fallback
**Issue:** VexFlow loads from CDN. What if CDN is down or user is offline?  
**What's Missing from Plan:**
- Current implementation loads VexFlow from `cdn.jsdelivr.net`
- Service Worker doesn't cache CDN resources (per existing SW design)
- If VexFlow fails to load, exercise breaks silently

**Action:** Add to Phase 5.3 (Error Handling):
- Check if VexFlow loaded: `if (typeof Renderer === 'undefined')`
- Show error message: "Sheet music requires VexFlow. Please check your internet connection."
- Add VexFlow to SW opportunistic cache (already done for some CDN resources, verify)
- Alternative: Bundle VexFlow locally (increases app size by ~300KB, but more reliable)
- **Recommendation:** Add error handling first, consider local bundling if CDN issues reported

---

### A10: Metronome Sound vs. Playback Bar Sync
**Issue:** Metronome plays audio clicks, playback bar moves visually. They must stay in sync.  
**What's Missing from Plan:**
- Metronome uses Web Audio scheduling (precise), playback bar uses CSS transitions (less precise)
- Over time, visual bar may drift from audio clicks
- User may notice bar is on beat 2 while hearing beat 3

**Action:** Add to Phase 2, Step 2.2:
- **Sync strategy:** On EVERY metronome beat callback, immediately set bar position (don't rely on animation alone)
- Use CSS transition for smoothness, but duration = 80% of beat interval (allows catch-up)
- Example: at 120 BPM, beat interval = 500ms, transition = 400ms
- Add visual "snap" to exact position on beat (remove transition for instant reposition, then re-enable)
- Add test: Verify bar position matches expected position after 100 beats (simulate drift scenario)

---

## Additional Questions for User

### Q11: AudioContext & Autoplay Policy
**Question:** Browsers block audio autoplay. The exercise will need a user gesture to start audio. Is it acceptable that:
- User clicks "Start Exercise" → sees sheet music (no audio yet)
- User clicks "Play" button → metronome starts (audio begins)
- **A:** Yes, this is fine (standard pattern)
- **B:** No, I want metronome to start immediately when exercise starts

**Recommendation:** **A** (required by browser autoplay policies, can't be avoided).

---

### Q12: VexFlow CDN vs. Local Bundle
**Question:** VexFlow currently loads from CDN. Should we:
- **A:** Keep CDN dependency (smaller app size, requires internet for first load)
- **B:** Bundle VexFlow locally (~300KB, works offline immediately)
- **C:** Hybrid: Try CDN first, fall back to local bundle (best of both, but more complex)

**Recommendation:** **A** for now (matches existing pattern), revisit if users report offline issues.

---

### Q13: Endless Mode Memory Limit
**Question:** In endless mode, the exercise runs forever. Should there be a memory limit?
- **A:** No limit, keep generating bars until user stops (may use 100+ MB RAM after hours)
- **B:** Soft limit: Remove old bars from DOM after 50 bars, keep only recent 20 bars visible
- **C:** Hard limit: Stop after 100 bars, show "Session complete, start new session?"

**Recommendation:** **B** (virtualization, keeps memory usage constant regardless of session length).

---

### Q14: Playback Bar Style
**Question:** What should the playback bar look like?
- **A:** Thin vertical line (1-2px, bright color like orange/red)
- **B:** Thick bar (4-6px, semi-transparent background, solid border)
- **C:** Highlighted column (background color change for current beat's area)
- **D:** Animated cursor (arrow or triangle pointing at current note)

**Recommendation:** **A** (thin line, high contrast, least visual obstruction).

---

### Q15: Exercise Behavior on Browser Tab Switch
**Question:** What should happen when user switches to another browser tab?
- **A:** Pause metronome and playback bar, resume when tab becomes visible again
- **B:** Continue playing (user may be practicing away from screen)
- **C:** Pause after 30 seconds of tab invisibility, resume on return

**Recommendation:** **A** (respects user's attention, prevents surprising audio when they return).

---

## Missing Test Cases (Added After Review)

### Additional Tests for `playbackController.test.js`
- AudioContext is created lazily on first `start()` call
- AudioContext resumes if suspended by browser
- `getCurrentBeat()` returns correct position after 100 beats (no drift)
- `stop()` properly cleans up (no lingering timeouts or audio)
- Multiple `start()` calls don't create duplicate metronomes (idempotent)

### Additional Tests for `endlessBarGenerator.test.js`
- Generator produces consistent results across 1000 calls (no random edge case failures)
- Memory usage stays constant (old bars discarded, not accumulated)
- Generator handles mid-stream note pool changes (user changes fret range)

### Additional Tests for `autoScroll.test.js`
- Manual scroll interruption detected and handled (auto-scroll pauses)
- Scroll position recalculated after window resize
- Scroll works correctly on touch devices (simulate touch scroll)

### New Test File: `tests/unit/vexflowConfig.test.js`
- VexFlow time signature strings are valid (e.g., "6/8" not "6/8/4")
- VexFlow voice configuration matches time signature
- VexFlow note keys are valid format (e.g., "c/4" not "C4")
- **Note:** Tests configuration only, not visual rendering

---

## Missing Edge Cases (Added After Review)

### Edge Case 1: User Has Only 1 String Active
- With 1 string, max notes = number of frets on that string (e.g., 4 notes for frets 0-3)
- Bar generation may repeat same note many times
- **Action:** Add warning in UI: "Only 1 string active — melody may be repetitive"

### Edge Case 2: User Sets BPM to Extremes
- 40 BPM: 1.5 seconds per beat — very slow, playback bar animation may look sluggish
- 240 BPM: 0.25 seconds per beat — very fast, bar moves quickly, may be hard to follow
- **Action:** Test animations at both extremes, adjust transition timing accordingly

### Edge Case 3: Time Signature Change Mid-Bar
- What if user changes from 4/4 to 3/4 while playback is on beat 3 of a 4-beat bar?
- **Action:** Stop playback immediately, regenerate bars, user presses Play to restart (consistent with Q8 answer)

### Edge Case 4: Endless Mode with 6/8 Time
- 6/8 has 6 beats per bar — more beats = more frequent bar generation needed
- **Action:** Adjust buffer size based on beats per bar (e.g., 12 bars for 6/8, 8 bars for 4/4)

### Edge Case 5: User Opens Exercise, Doesn't Press Play
- Metronome not started, playback bar not visible
- **Action:** Show instructional overlay: "Press Play to start metronome and playback bar"

### Edge Case 6: Very Long Endless Session
- After 1 hour at 120 BPM: ~7200 beats, ~1800 bars (in 4/4)
- **Action:** Virtualization mandatory for sessions >30 minutes, test with simulated 10,000-bar session

---

## Updated Success Criteria (Additions)

Add to existing success criteria:
12. ✅ AudioContext properly managed (created on Play, destroyed on Stop)
13. ✅ Playback bar stays in sync with metronome audio (no drift after 100+ beats)
14. ✅ VexFlow CDN failure handled gracefully (error message shown)
15. ✅ Exercise pauses when browser tab hidden, resumes on return
16. ✅ All controls meet WCAG 2.1 touch target size (44x44px minimum)
17. ✅ Performance: 4 bars generated in <50ms, metronome <2% CPU, scroll 60fps
18. ✅ Endless mode memory usage stays constant (virtualization active)

---

## Updated File List (Additions)

### Additional New Files
```
tests/unit/
└── vexflowConfig.test.js         — VexFlow configuration validation

tests/performance/                 — (Optional, run on demand)
└── barGeneration.perf.test.js    — Performance benchmarks
```

### Additional Modifications
```
sw.js                              — Verify VexFlow CDN caching (opportunistic)
js/games/sheetMusicReading/
└── CLAUDE.md                      — Update with new architecture
```

---

## Changelog

| Date | Change |
|------|--------|
| 2026-04-12 | Plan created |
| 2026-04-12 | Added 10 additional considerations (A1-A10), 5 more questions (Q11-Q15), missing test cases, edge cases, updated success criteria |
