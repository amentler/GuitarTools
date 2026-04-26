# Plan: Fretboard Unification & Visual Upgrade

## Status Quo
- `<gt-fretboard>` (Web Component) is used in `ton-finder` and `griffbrett`. It is functional but visually "basic".
- `renderChordDiagram` (JS function) is used in chord-related exercises/tools. It looks "nicer" (labels, nut style, spacing) but is less flexible.

## Goal
Unify all fretboard/chord-diagram visualizations into a single, high-quality `<gt-fretboard>` Web Component that combines the flexibility of the current component with the aesthetics of the chord diagram.

## Strategy: Enhance `<gt-fretboard>`
Instead of creating a third implementation, we upgrade the existing component to be the "one source of truth".

## Execution Plan (TDD)

### Phase 1: Preparation & Baseline
1. **New E2E Test:** Create `tests/e2e/fretboard-unified.spec.js`.
   - Verify `ton-finder` renders labels and markers.
   - Verify `griffbrett` shows the target note.
   - Verify interaction (clicking works).
2. **New Unit Tests:** Add tests for the renderer in `tests/unit/gt-fretboard-render.test.js` (if not exists) to check coordinate calculations and SVG structure.

### Phase 2: Visual Implementation
1. **Upgrade `gt-fretboard-render.js`:**
   - Adopt the visual style from `chordDiagramRenderer.js` (colors, strokes, labels).
   - Ensure dynamic scaling (it must still support a variable number of frets, unlike the fixed 5 in the chord diagram).
   - Add support for "muted" strings and "open" circle markers (required for chords).
   - Add string labels (E, A, D, G, B, e) to the left of the nut.
2. **Update `<gt-fretboard>` API:**
   - Ensure `positions` array supports more states (e.g., `muted`, `open`).
   - Add `showLabels` attribute (default: true).

### Phase 3: Migration
1. **Automatic Update:** `ton-finder` and `griffbrett` will automatically use the new look as they already use the component.
2. **Chord Migration:** Refactor the following to use `<gt-fretboard>` instead of `renderChordDiagram`:
   - `js/games/akkordTrainer/akkordTrainer.js`
   - `js/games/akkordfolgenTrainer/akkordfolgenTrainer.js`
   - `js/tools/akkordUebersicht/akkordUebersicht.js`
   - `js/games/chordExerciseEssentia/chordExerciseEssentia.js`

### Phase 4: Cleanup
1. Remove `js/shared/rendering/chords/chordDiagramRenderer.js`.
2. Remove `js/games/akkordTrainer/akkordSVG.js`.
3. Delete any unused assets or CSS specifically for the old diagram.

## Safety & Transition
- **Visual Regression:** Use Playwright screenshots in the new E2E test to compare if possible, or manual verification.
- **Feature Parity:** The new component MUST support the "fingering" display (numbers inside circles) used in `akkord-uebersicht`.
- **TDD:** No migration of chord exercises until the updated `<gt-fretboard>` passes all baseline E2E tests for the existing users.
