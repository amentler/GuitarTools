# Plan: 🔍 Ton-Finder (Griffbrett-Quiz umgekehrt)

**Status:** Geplant ⏳ (Nächstes Todo?)  
**Typ:** Übung  
**Zielgruppe:** Einsteiger bis Fortgeschrittene

---

## AI Collaboration & Mandate

**IMPORTANT FOR ALL AGENTS (Claude, Gemini, Codex):**
- **Update .md files:** After completing a task or implementing a feature, you MUST update all relevant `.md` files (root `CLAUDE.md`, root `GEMINI.md`, this plan, and any other relevant documentation).
- **Keep Plans Current:** If this plan is part of an ongoing task, update the status and next steps after each work session.
- **Consistency:** Maintain the project's "Vanilla JS" and SVG-focused architecture.

---

## Ziel

Inverse der bestehenden Griffbrett-Tonerkennung: Ein Tonname wird vorgegeben, der Nutzer tippt **alle** Positionen auf dem Griffbrett, an denen dieser Ton vorkommt.

---

## Funktionsumfang

### Kern-Feature
- Ein Tonname wird eingeblendet (z. B. „G")
- Das Griffbrett ist vollständig dargestellt (Bünde 0–12, alle 6 Saiten)
- Nutzer tippt auf alle korrekten Positionen (mehrere Treffer möglich)
- „Fertig"-Button schließt die Runde ab
- Richtige Positionen: grün markiert
- Verpasste Positionen: orange (du hättest tippen sollen)
- Falsch getippte Positionen: rot

### Einstellungen
- **Bund-Bereich:** Slider 0–12 (standard: 0–5)
- **Saiten:** Toggle-Buttons (E2–E4), mindestens 1 aktiv
- **Schwierigkeit:** Nur natürliche Töne (C, D, E, F, G, A, B) oder alle inkl. Halbtöne

### Bewertung
- Punkte für jede korrekt gefundene Position
- Abzug für falsch getippte Positionen
- Am Rundenende: Score-Anzeige + Wiederholung

---

## Technische Umsetzung

### Neue Dateien
```
js/games/tonFinder/
├── tonFinder.js      – Spielzustand, Rundenverwaltung, Auswertung
├── tonFinderLogic.js – Berechnung aller Positionen eines Tons auf dem Griffbrett
└── CLAUDE.md
```

### Wiederverwendung
- `fretboardSVG.js` – SVG-Rendering mit Klick-Interaktion pro Bund/Saite
- `fretboardLogic.js` – `getNoteAtFret(string, fret)` für inverse Berechnung
- Einstellungs-UI-Muster (Bund-Slider, Saiten-Toggles) aus `fretboardExercise.js`
- CSS Custom Properties und Farbklassen (`.correct`, `.wrong`) aus `style.css`

### Kern-Algorithmus
```js
// tonFinderLogic.js
function getAllPositions(noteName, maxFret, activeStrings) {
  const positions = [];
  for (const string of activeStrings) {
    for (let fret = 0; fret <= maxFret; fret++) {
      if (getNoteAtFret(string, fret) === noteName) {
        positions.push({ string, fret });
      }
    }
  }
  return positions;
}
```

### Interaktion
- Klick auf Griffbrett-SVG → Bund/Saite ermitteln, als „getippt" markieren
- Zweiter Klick auf bereits getippte Position → Markierung entfernen
- Klick auf „Fertig" → Auswertung starten

### index.html
- Neuer View `#view-ton-finder` mit Tonname-Anzeige, SVG-Griffbrett, Einstellungen, Buttons
- Menü-Eintrag „Ton-Finder" unter „Übungen"

### app.js
- Navigation zu `#view-ton-finder` verdrahten
- `startExercise()` / `stopExercise()` einbinden

---

## Offene Fragen / Erweiterungen

- Zeitlimit-Modus: Alle Positionen in X Sekunden finden
- Highscore pro Ton speichern (`localStorage`)
- Ton-Sequenz-Modus: mehrere Töne hintereinander, Griffbrett-Mapping trainieren
- Akustisches Feedback: korrekter Ton wird beim Tippen abgespielt
