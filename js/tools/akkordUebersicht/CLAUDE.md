# akkordUebersicht – 📋 Akkord Übersicht

Static chord overview tool. Displays all chords from the Akkord Trainer as non-interactive diagrams, grouped by category. Currently shows **35 chords** across 4 categories.

## Purpose

Reference lookup tool – no scoring, no interactivity. Shows every chord grip at a glance.

## Files

- `akkordUebersicht.js` – Tool controller; renders chord diagrams into `#akkord-uebersicht-container` on first open.

## Dependencies

- `../../games/akkordTrainer/akkordLogic.js` — `CHORDS`, `CHORD_CATEGORIES`
- `../../games/akkordTrainer/akkordSVG.js` — `renderChordDiagram`
- `../../exerciseRegistry.js` — `registerExercise`

## Architecture

- Rendering is **lazy and idempotent**: diagrams are rendered only once on the first `startExercise()` call (`rendered` flag).
- `renderChordDiagram` is called with `referencePositions = null`, `feedback = null`, and a no-op `onTogglePosition` to display static (non-interactive) chord finger positions as orange dots.
- `stopExercise()` is a no-op (no timers or audio to clean up).

## Registration

Registered in `js/app.js` under the key `akkordUebersicht`:

```js
{ key: 'akkordUebersicht', path: './tools/akkordUebersicht/akkordUebersicht.js' },
```

## HTML IDs

| ID | Purpose |
|---|---|
| `view-akkord-uebersicht` | View section |
| `btn-start-akkord-uebersicht` | Start button in main menu |
| `btn-back-akkord-uebersicht` | Back button inside the view |
| `akkord-uebersicht-container` | Container for category sections and chord cards |

## Category Labels

| Key | Label |
|---|---|
| `simplified` | Einsteiger (vereinfacht) |
| `standard` | Standard (CAGED) |
| `extended` | Weiterführend (7er, F) |
| `sus_add` | Sus & Add |
