# fretboardToneRecognition – Identify Notes on the Fretboard

The user sees a marked dot on an SVG guitar fretboard and must select the correct note name from 12 buttons (C, C#, D … B).

## Files

### `fretboardExercise.js` – Exercise controller

Manages all state and wires DOM interactions. Exports `startExercise()` and `stopExercise()` for `js/app.js`.

**State shape:**

| Field | Type | Description |
|---|---|---|
| `targetPosition` | `{ string, fret }` | Current question position |
| `feedbackState` | `null \| 'correct' \| 'wrong'` | Current feedback state |
| `score` | `{ correct, total }` | Running score |
| `settings` | `{ maxFret, activeStrings[] }` | Game settings (persisted across restarts) |
| `chancesLeft` | `1–3` | Remaining attempts for the current position |
| `wrongAnswers` | `string[]` | Already-guessed wrong notes (their buttons are disabled) |

**Flow per question:**
1. Random position within active strings and fret range
2. User clicks a note button:
   - Correct → green, score++, advance after 1200 ms
   - Wrong with chances left → button turns red + disabled, chance dot fades
   - Wrong, 0 chances left → correct note highlighted green, all wrong notes red, advance after 1200 ms
3. `advanceToNextPosition()` resets `chancesLeft = 3` and `wrongAnswers = []`

**Settings wiring:** attached once on first `startExercise()` call (`settingsWired` flag). Any settings change immediately triggers `resetAndAdvance()`.

---

### `fretboardLogic.js` – Pure note calculations

No side effects, no DOM access.

**Exports:**
- `CHROMATIC_NOTES` – 12-note chromatic scale array: `['C','C#','D',…,'B']`
- `OPEN_STRING_NOTES` – Open string notes (index 0 = low E): `['E','A','D','G','B','E']`
- `STRING_LABELS` – Display labels: `['E2','A2','D3','G3','B3','E4']`
- `getNoteAtPosition(stringIndex, fret)` → note name string (e.g. `"F#"`)
- `getRandomPosition(previous?, config?)` → `{ string: 0–5, fret: 0–maxFret }`
  - `config`: `{ maxFret?: number, activeStrings?: number[] }`

---

### `fretboardSVG.js` – SVG fretboard renderer

Stateless — clears the container and builds a fresh SVG on every call.

**Export:**
- `renderFretboard(container, targetString, targetFret, feedbackState, maxFret?)`
  - `feedbackState`: `null | 'correct' | 'wrong'`
  - `maxFret`: 1–12, default 4

**SVG layout:**
- `viewBox="0 0 640 290"`, scales via `width="100%"` to any screen size
- 6 strings (y 40–250), tempered fret spacing
- Inlay dots at frets 3, 5, 7, 9 (if within the visible range)
- Target dot: amber + pulsing (question), green (correct), red (wrong)

## AI Collaboration & Documentation

**IMPORTANT FOR ALL AGENTS (Claude, Gemini, Codex):**
- **Update .md files:** After completing a task or implementing a feature, you MUST update all relevant `.md` files (root `CLAUDE.md`, root `GEMINI.md`, this `CLAUDE.md`, and any plans in `plans/`).
- **Keep Plans Current:** If a feature from `plans/` is implemented, update the file to reflect the new state and next steps.
- **Architecture:** Maintain the project's "Vanilla JS" and SVG-focused architecture.
