# sheetMusicReading – Noten lesen Übung

Zeigt 4 zufällige Takte in C-Dur (Viertelnoten) auf einer Notenzeile an.
Optional: Tabs unterhalb der Notenzeile.

## Dateien

### `sheetMusicLogic.js`
- `NOTES` – 8 Noten in C-Dur, Bünde 0–3, Saiten 1–3 (G4, F4, E4, D4, C4, B3, A3, G3)
- Jede Note: `{ name, octave, step, string, fret }`
  - `step`: Notenlinien-Position (0 = E4, Grundlinie des Violinschlüssels; negativ = tiefer)
  - `string`: Gitarrensaite in Tab-Notation (1 = Hochton-E … 6 = Tiefton-E)
- `generateBars(numBars, beatsPerBar)` → `Note[][]`

### `sheetMusicSVG.js`
- `renderScore(container, bars, showTab)` – baut SVG neu auf
- Notenzeile: 5 Notenlinien, Violinschlüssel (SVG-Pfad), 4/4-Takt, 4 Takte, doppelter Schlusstaktstrich
- Noten: ausgefüllter Notenkopf (Ellipse), Notenhals (oben für Noten unter B4, unten sonst)
- Hilfslinien unterhalb der Notenzeile für G3–D4
- Tab-Sektion (6 Saiten, Bundnummern, "T/A/B"-Beschriftung)

### `sheetMusicReading.js`
- `startExercise()` / `stopExercise()`
- Zustand: `{ bars, showTab }`
- Buttons: `#btn-new-bars` (neue Takte) und `#btn-show-tab` (Toggle)
- `wired`-Flag verhindert doppeltes Event-Listener-Wiring

## AI Collaboration & Documentation

**IMPORTANT FOR ALL AGENTS (Claude, Gemini, Codex):**
- **Update .md files:** After completing a task or implementing a feature, you MUST update all relevant `.md` files (root `CLAUDE.md`, root `GEMINI.md`, this `CLAUDE.md`, and any plans in `plans/`).
- **Keep Plans Current:** If a feature from `plans/` is implemented, update the file to reflect the new state and next steps.
- **Architecture:** Maintain the project's "Vanilla JS" and SVG-focused architecture.
