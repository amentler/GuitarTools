# Plan: 🗺️ Skalenvisualisierer

**Typ:** Tool  
**Zielgruppe:** Einsteiger bis Fortgeschrittene

---

## Ziel

Nutzer wählt eine Skala und einen Grundton. Das gesamte Griffbrett zeigt alle Töne der Skala farbig an – als schnelles Nachschlage- und Übungstool ohne Scoring.

---

## Funktionsumfang

### Kern-Feature
- Dropdown „Skala" (Dur, Natürliches Moll, Pentatonik Dur, Pentatonik Moll, Blues-Skala, Dorisch, …)
- Dropdown „Grundton" (C, C#, D, D#, E, F, F#, G, G#, A, A#, B)
- Vollständiges Griffbrett (Bünde 0–12, alle 6 Saiten) als SVG
- Grundton: Akzentfarbe (`--color-accent`)
- Übrige Skalentöne: Sekundärfarbe (`--color-correct`)
- Töne außerhalb der Skala: unsichtbar / ausgeblendet

### Optionale Features
- Toggle: Tonnamen auf den Punkten einblenden / ausblenden
- Toggle: Skalenstufen (1, 2, 3, …) statt Tonnamen
- Highlight-Modus: nur eine Lage (z. B. Pentatonik-Box-Pattern) hervorheben

---

## Technische Umsetzung

### Neue Dateien
```
js/tools/skalenVisualisierer/
├── skalenVisualisierer.js   – Controller, Event-Handling für Dropdowns
├── skalenLogic.js           – Skala-Datenbank, Ton-Berechnung pro Saite/Bund
└── CLAUDE.md
```

### Wiederverwendung
- `fretboardSVG.js` – SVG-Griffbrettrendering als direkte Basis
- `fretboardLogic.js` – `getNoteAtFret(string, fret)` Hilfsfunktionen
- CSS Custom Properties aus `style.css`

### Skala-Datenbank
```js
// skalenLogic.js
const SCALES = {
  "Dur":              [0, 2, 4, 5, 7, 9, 11],
  "Natürliches Moll": [0, 2, 3, 5, 7, 8, 10],
  "Pentatonik Moll":  [0, 3, 5, 7, 10],
  "Blues":            [0, 3, 5, 6, 7, 10],
  // ...
};
function getScaleNotes(root, scaleName) { /* gibt Set von MIDI-Klassen zurück */ }
```

### Render-Logik
- Für jeden Bund jeder Saite: `getNoteAtFret` aufrufen, prüfen ob in Skala
- Grundton-Punkte in Akzentfarbe rendern, andere Skalentöne in Sekundärfarbe
- Kein Scoring, kein Timer – rein visuell

### index.html
- Neuer View `#view-skalen-visualisierer` mit Dropdowns, SVG-Container, Toggles
- Menü-Eintrag „Skalenvisualisierer" unter „Tools"

### app.js
- Navigation zu `#view-skalen-visualisierer` einbinden (kein `stopExercise` nötig, da Tool)

---

## Offene Fragen / Erweiterungen

- Exportfunktion: Griffbrett als SVG/PNG herunterladen
- Mehrere Skalen gleichzeitig überlagern (z. B. Dur + Pentatonik)
- Animierter Übergang beim Wechsel von Grundton oder Skala
- Positionsmarkierungen (Lagendots) auf dem Griffbrett
