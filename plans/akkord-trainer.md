# Plan: 🎸 Akkord-Trainer

**Typ:** Übung  
**Zielgruppe:** Einsteiger

---

## Ziel

Der Nutzer sieht einen zufälligen Akkordnamen und legt die richtigen Finger­positionen auf einem interaktiven Griffbrett-Diagramm.

---

## Funktionsumfang

### Kern-Feature
- Zufälliger Akkordname wird angezeigt (C, G, Em, Am, D, F, …)
- Leeres Griffbrett-Diagramm (erste 5 Bünde, 6 Saiten)
- Nutzer tippt auf Saite + Bund → Punkt erscheint auf dem Diagramm
- „Prüfen"-Button vergleicht gesetzte Punkte mit Referenz-Akkord
- Richtige Töne werden grün markiert, falsche rot, fehlende grau

### Progression
- **Level 1:** Offene Akkorde (C, G, D, Em, Am)
- **Level 2:** Weitere offene Akkorde + 7-Akkorde
- **Level 3:** Barré-Akkorde (F, Bm, …)

### Bewertung & Feedback
- Punkteanzeige pro Runde
- Anzeige der korrekten Lösung nach Ablauf der Versuche
- Optionaler Hinweis-Button zeigt einen Finger auf dem Griffbrett

---

## Technische Umsetzung

### Neue Dateien
```
js/games/akkordTrainer/
├── akkordTrainer.js      – Spielzustand, Rundenverwaltung
├── akkordLogic.js        – Akkord-Datenbank (Name → Fingerpositionen)
├── akkordSVG.js          – Griffbrett-Diagramm mit Klick-Interaktion
└── CLAUDE.md
```

### Wiederverwendung
- `fretboardSVG.js` als Basis für das SVG-Rendering
- Farbsystem aus `style.css` (CSS Custom Properties)

### Datenstruktur Akkord-Datenbank
```js
// akkordLogic.js
const CHORDS = {
  "C":  [{ string: 2, fret: 1 }, { string: 4, fret: 2 }, { string: 5, fret: 3 }],
  "G":  [{ string: 1, fret: 3 }, { string: 5, fret: 2 }, { string: 6, fret: 3 }],
  // ...
};
```

### index.html
- Neuer View `#view-akkord-trainer` mit Akkordanzeige, SVG-Container und Buttons
- Menü-Eintrag „Akkord-Trainer" im Haupt-Menü

### app.js
- Navigation zu `#view-akkord-trainer` verdrahten
- `startExercise()` / `stopExercise()` aufrufen

---

## Offene Fragen / Erweiterungen

- Mikrofon-Erkennung: Nutzer spielt Akkord → App erkennt ihn (spätere Version)
- Animierter Finger-Übergang bei Level-Wechsel
- Akkord-Diagramm als PNG exportierbar
