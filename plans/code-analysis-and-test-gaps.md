# Analysis and Plan: Playwright Test Gap Review

## 1. Current Baseline

Current Playwright coverage is broader than a pure fretboard baseline:

- `tests/e2e/fretboard-unified.spec.js` and `tests/e2e/fretboard-tone-recognition.spec.js` cover shared fretboard rendering and interaction.
- `tests/e2e/chord-trainer.spec.js` covers basic chord entry interaction.
- Multiple fake-microphone regression tests already exist for `chord-playing-essentia`, including positive and negative cases.
- `playwright.config.js` already provides reusable fake-media setup, including microphone permission and WAV-based audio capture.

This matters because the next expansion should build on the existing fake-audio setup instead of assuming audio E2E is still a greenfield problem.

---

## 2. Review of Missing Playwright Coverage

### 2.1 Corrections to the previous analysis

- The suite is not only focused on `gt-fretboard` and manual entry; chord-recognition regressions are already covered.
- Some previously proposed tests do not match the current product surface:
  - Guitar tuner has mode toggles and a guided flow, but no "guided mode string selection persistence" feature.
  - `akkordfolgenTrainer` has start, stop, beat dots, and a summary screen, but no pause button or progress bar.
  - Sheet-music-reading should be tested via concrete controls like playback, endless mode, tab toggle, time signature, and persistence rather than vague "selection highlighting".
- For audio-driven tests, WAV fixtures should be the first strategy. A custom injection harness for `AudioContext` or `microphoneService` is a fallback, not the first implementation step.

### 2.2 High-value gaps that remain

#### System-wide smoke coverage

- Main menu navigation from `index.html` to all exercise/tool pages.
- Shared `gt-exercise-header` back-link behavior on every subpage.
- Basic "page loads without obvious breakage" checks for every top-level page.
- Optional console-error smoke assertions for page boot.

#### Tool coverage

- **Metronome**
  - Start/stop button state.
  - BPM slider and increment/decrement buttons.
  - Beats-per-measure selector.
  - Persistence across reload via localStorage.

- **Guitar Tuner**
  - Standard vs chromatic mode toggle.
  - Guided-mode panel transitions: start, next, stop, restart, done.
  - Permission-denied fallback message.
  - Later: audio-driven note-detection assertions if fixtures prove stable.

#### Exercise coverage

- **Sheet Music Reading**
  - Initial score render.
  - Tab toggle.
  - Endless-mode toggle.
  - BPM and time-signature controls.
  - Persistence of reading preferences across reload.
  - Optional keyboard-shortcut coverage (`Space`, `ArrowUp`, `ArrowDown`, `R`, `T`, `E`).

- **Note Playing**
  - Initial notation render.
  - Hint 1 reveals note name.
  - Hint 2 reveals tab positions.
  - Skip advances to a new note.
  - Fret/string setting changes reset the round and regenerate the target.
  - Permission-denied fallback message.
  - Later: audio-driven success flow with note fixtures.

- **Sheet Music Mic**
  - Initial score render and score display.
  - Start/stop listening UI transitions.
  - "Neue Noten" regenerates bars.
  - Easy vs hard mode behavior.
  - Completion state after the whole sequence is finished.
  - Permission-denied fallback message.
  - Later: correct/wrong note flows with deterministic fixtures.

- **Akkordfolgen Trainer**
  - Setup screen renders key/progression controls.
  - Random progression toggle.
  - BPM and beats-per-chord controls.
  - Start enters active mode.
  - Stop reaches summary screen.
  - "Nochmal" and "Neue Einstellungen" flows.
  - Summary stats as main assertion surface.

#### PWA / infrastructure coverage

- Manifest link exists on the main page.
- Service worker registration is attempted.
- This should be treated as a secondary smoke layer because it may be more environment-sensitive than the core UI flows.

---

## 3. Recommended Playwright Expansion Plan

### Phase 1: Smoke, navigation, and persistence

1. Add `tests/e2e/navigation.spec.js` covering all top-level menu cards and the shared back link.
2. Add lightweight page smoke tests for all currently reachable pages.
3. Add persistence-focused tests where the behavior is explicit and low-risk:
   - metronome BPM and beats
   - sheet-music-reading BPM, time signature, tab mode, endless mode

### Phase 2: Deterministic non-audio interaction flows

1. Add `tests/e2e/metronome.spec.js`.
2. Add `tests/e2e/sheet-music-reading.spec.js`.
3. Add `tests/e2e/note-playing-ui.spec.js`.
4. Add `tests/e2e/tuner-ui.spec.js`.
5. Add `tests/e2e/akkordfolgen-trainer-ui.spec.js`.

These tests should focus on visible UI state transitions and persistent settings, not internal implementation details.

### Phase 3: Permission and failure-state coverage

1. Add Playwright tests that mock microphone denial for:
   - guitar tuner
   - note playing
   - sheet music mic
   - akkordfolgen trainer
2. Assert that each page shows the expected fallback message and remains usable enough to recover or navigate away.

### Phase 4: Audio-driven regressions using fixtures first

1. Reuse the existing fake-media setup and WAV fixtures pattern already used by chord-playing tests.
2. Add deterministic fixtures for:
   - single-note success cases in note playing
   - easy/hard divergence in sheet-music-mic
   - selected guided or unguided tuner detections if stable enough
3. Only introduce a lower-level injection helper if WAV fixtures cannot produce reliable coverage.

### Phase 5: Optional secondary coverage

1. Add console-error smoke checks to critical pages.
2. Add PWA smoke assertions for manifest and service-worker registration.
3. Add keyboard-shortcut tests for sheet-music-reading if they remain stable in CI.

---

## 4. Prioritization Notes

- Highest value per effort:
  - navigation smoke
  - metronome
  - sheet-music-reading persistence
  - tuner UI states
  - akkordfolgen trainer setup/summary flow

- Highest flake risk:
  - tuner pitch-detection assertions
  - note-playing and sheet-mic audio acceptance flows
  - service-worker behavior

- Default strategy:
  - prefer user-visible assertions
  - prefer existing fake-audio/WAV infrastructure over custom JS injection
  - keep audio-heavy flows behind proven deterministic fixtures
