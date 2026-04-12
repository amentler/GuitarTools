# akkordTrainer –🎸 Chord Trainer

The user sees a random chord name (e.g., "C-Dur", "G-Dur", "A-Moll") and must place the correct finger positions on an interactive SVG chord diagram (first 5 frets).

## Files

### `akkordTrainer.js` – Exercise controller

Manages game state, round management, and DOM interactions. Exports `startExercise()` and `stopExercise()` for `js/app.js`.

**State shape:**

| Field | Type | Description |
|---|---|---|
| `currentChord` | `string` | Name of the chord to be found (e.g., "C-Dur") |
| `userPositions` | `Array<{string, fret, muted}>` | Current state per string (default each round: all strings open/played) |
| `feedback` | `null | 'correct' | 'wrong'` | Current feedback state after clicking "Check" |
| `score` | `{ correct, total }` | Running score |
| `level` | `1 | 2 | 3` | Current difficulty level |

**Flow per question:**
1. Pick a random chord from the current level's pool.
2. Every round starts with all 6 strings set to open/played.
3. User taps/clicks to set fretted notes or mute strings.
4. Clicking an already selected fret resets that string to open.
5. Clicking the nut toggle switches between open and muted for that string.
6. User clicks "Prüfen" (Check):
   - Correct → markers turn green, score++, advance after 1500ms.
   - Wrong → markers turn red, correct positions shown in gray/ghosted, advance after 2000ms.
7. `nextRound()` resets `userPositions` to all open strings and `feedback = null`.

---

### `akkordLogic.js` – Chord database and validation

Contains the chord definitions and logic to compare user input with the correct chord.

**Exports:**
- `CHORDS` – Object mapping chord names to their finger positions:
  `{ "C-Dur": [{ string: 2, fret: 1 }, { string: 4, fret: 2 }, { string: 5, fret: 3 }], "A-Moll": [...], ... }`
- `LEVELS` – Array of chord name groups for different difficulties.
- `getRandomChord(level)` → returns a random chord object `{ name, positions }`.
- `validateChord(chordName, userPositions)` → returns `true` if `userPositions` match the reference.

---

### `akkordSVG.js` – Interactive Chord Diagram renderer

Renders the first 5 frets of the guitar and handles click events to place markers.

**Export:**
- `renderChordDiagram(container, userPositions, referencePositions, feedback, onTogglePosition)`
  - `container`: DOM element to render into.
  - `userPositions`: Array of `{string, fret}` currently selected.
  - `referencePositions`: Array of `{string, fret}` for the correct chord (used for feedback).
  - `feedback`: `null | 'correct' | 'wrong'`.
  - `onTogglePosition`: Callback function `(string, fret)` triggered when a user clicks a spot.

**SVG layout:**
- Focused on the first 5 frets (nut + frets 1-5).
- 6 strings (horizontal or vertical, depending on common chord diagram style - usually vertical).
- Marker dots for user input.
- "X" for muted strings, "O" for open strings (if applicable).

## AI Collaboration & Documentation

**IMPORTANT FOR ALL AGENTS (Claude, Gemini, Codex):**
- **Update .md files:** After completing a task or implementing a feature, you MUST update all relevant `.md` files (root `CLAUDE.md`, root `GEMINI.md`, this `CLAUDE.md`, and any plans in `plans/`).
- **Keep Plans Current:** If a feature from `plans/` is implemented, update the file to reflect the new state and next steps.
- **Architecture:** Maintain the project's "Vanilla JS" and SVG-focused architecture.
