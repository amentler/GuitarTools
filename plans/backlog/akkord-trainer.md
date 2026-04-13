# Plan: 🎸 Akkord-Trainer (COMPLETED ✅)

**Status:** Abgeschlossen ✅  
**Typ:** Übung  
**Zielgruppe:** Einsteiger

---

## AI Collaboration & Mandate

**IMPORTANT FOR ALL AGENTS (Claude, Gemini, Codex):**
- **Update .md files:** After completing a task or implementing a feature, you MUST update all relevant `.md` files (root `CLAUDE.md`, root `GEMINI.md`, this plan, and any other relevant documentation).
- **Keep Plans Current:** If this plan is part of an ongoing task, update the status and next steps after each work session.
- **Consistency:** Maintain the project's "Vanilla JS" and SVG-focused architecture.

---

## Ziel

Der Nutzer sieht einen zufälligen Akkordnamen und legt die richtigen Finger­positionen auf einem interaktiven Griffbrett-Diagramm.

---

## Umgesetzter Funktionsumfang

### Kern-Feature
- Zufälliger Akkordname wird angezeigt (C, G, Em, Am, D, F, …)
- Leeres Griffbrett-Diagramm (erste 5 Bünde, 6 Saiten)
- Nutzer tippt auf Saite + Bund → Punkt erscheint auf dem Diagramm
- „Prüfen"-Button vergleicht gesetzte Punkte mit Referenz-Akkord
- Richtige Töne werden grün markiert, falsche rot, fehlende grau
- Startzustand pro Aufgabe: alle 6 Saiten sind automatisch als „zu spielen“ (offen) gesetzt
- Für Saiten, die nicht gespielt werden sollen, wird per Klick auf den Saitenanfang auf „nicht zu spielen“ (X) umgeschaltet
- Fehlklick-Korrektur ohne leeren Zwischenzustand: erneuter Klick auf Bund setzt die Saite zurück auf „offen“

### Progression
- **Kategorien:** Nutzer kann über Checkboxen wählen, welche Akkorde abgefragt werden.
- **Simplified:** 1-2 Finger Akkorde (G1, C1, Em2, Am2)
- **Standard:** CAGED System (C, G, D, Em, Am, E, A, Dm)
- **Extended:** 7er-Akkorde und F-Dur klein (G7, C7, D7, A7, E7, F, H7)
- **Sus & Add:** Asus2, Asus4, Dsus2, Dsus4, Esus4, Cadd9, G-Dur (Rock)
- **Standard-Einstellung:** Nur "Simplified" ist aktiv, um Einsteiger nicht zu überfordern.

---

## Technische Umsetzung

### Neue Dateien
- `js/games/akkordTrainer/akkordTrainer.js`: Spielzustand, Rundenverwaltung, Kategorie-Filterung
- `js/games/akkordTrainer/akkordLogic.js`: Akkord-Datenbank (Name → Fingerpositionen), Kategorisierungs-Logik
- `js/games/akkordTrainer/akkordSVG.js`: Interaktives Griffbrett-Diagramm (vertikal)
- `js/games/akkordTrainer/CLAUDE.md`: Modulspezifische Dokumentation

### Integration
- **index.html**: View `#view-akkord-trainer` mit Checkboxen für Kategorien erweitert.
- **style.css**: Styling für Checkboxen und Layout-Anpassungen.
- **js/app.js**: Navigation und Lifecycle-Management integriert.

---

## Offene Fragen / Erweiterungen

- Mikrofon-Erkennung: Nutzer spielt Akkord → App erkennt ihn (spätere Version)
- Animierter Finger-Übergang bei Level-Wechsel
- Akkord-Diagramm als PNG exportierbar
