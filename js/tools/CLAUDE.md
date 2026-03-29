# js/tools – Wiederverwendbare Hilfsfunktionen

Reine Hilfsfunktionen ohne DOM-Abhängigkeiten (außer `fretboardSVG.js`, das SVG-Elemente erstellt).
Können von mehreren Übungen importiert werden.

## Dateien

### `fretboardLogic.js`

Reine Ton-Berechnungen, keinerlei Seiteneffekte.

**Exports:**
- `CHROMATIC_NOTES` – Array der 12 Halbtöne: `['C','C#','D',…,'B']`
- `OPEN_STRING_NOTES` – Leersaiten-Töne (Index 0 = tiefe E-Saite): `['E','A','D','G','B','E']`
- `STRING_LABELS` – Anzeigebeschriftungen: `['E2','A2','D3','G3','B3','E4']`
- `getNoteAtPosition(stringIndex, fret)` → Tonname als String (z.B. `"F#"`)
- `getRandomPosition(previous?, config?)` → `{ string: 0–5, fret: 0–maxFret }`
  - `config`: `{ maxFret?: number, activeStrings?: number[] }`

### `fretboardSVG.js`

SVG-Rendering des Gitarren-Griffbretts. Zustandslos — löscht den Container und erstellt das SVG neu.

**Export:**
- `renderFretboard(container, targetString, targetFret, feedbackState, maxFret?)`
  - `container`: HTMLElement, wird geleert und mit SVG befüllt
  - `feedbackState`: `null | 'correct' | 'wrong'`
  - `maxFret`: 1–12, Standard 4

**SVG-Layout:**
- `viewBox="0 0 640 290"`, skaliert per `width="100%"` auf alle Bildschirmgrößen
- 6 Saiten (y 40–250), temperierter Bundabstand
- Inlay-Dots bei Bund 3, 5, 7, 9 (sofern im sichtbaren Bereich)
- Markierungspunkt: amber pulsierend (Frage), grün (richtig), rot (falsch)
