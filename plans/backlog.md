# GuitarTools – Backlog & Plans

## Active Plan: Chord Exercise with Audio Recognition

**Status:** 📋 Planning  
**Created:** 2026-04-12  
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
