# Codex Analyse – GuitarTools

Stand: 2026-04-02

## 1) Projektinitialisierung (für mich)

Ich habe das Repository strukturell und inhaltlich eingelesen:
- Stack: Vanilla HTML/CSS/JS (ES Modules), SVG-Rendering, Web Audio API, PWA (Service Worker + Manifest)
- Kein Build-Step, direkte Ausführung als statische GitHub-Pages-App
- Hauptbereiche:
  - `index.html`, `style.css`, `js/app.js` (Navigation/View-Wechsel)
  - Spiele unter `js/games/*`
  - Tools unter `js/tools/*`
  - Roadmap in `plans/*.md`

## 2) Code- und Architektur-Analyse

Positiv:
- Klare modulare Trennung pro Feature (Controller/Logik/SVG in separaten Dateien)
- Gute Wiederverwendung von Logikmodulen (z. B. fretboard note logic)
- Navigation in `js/app.js` übersichtlich gehalten
- PWA-Basis vorhanden (`sw.js`, `manifest.json`)

Risiken / Schwächen:
- Keine automatisierten Tests (Unit/Integration/E2E)
- Keine Linting-/Formatierungspipeline
- Keine CI-Workflows
- Service-Worker-Assetliste wirkt manuell versionsgeführt (Wartungsrisiko bei neuen Dateien)
- Qualitätssicherung aktuell primär manuell

## 3) Analyse der bisherigen Agentenarbeit

Dokumentation/Agentenstand:
- Root-Policies in `CLAUDE.md` und `GEMINI.md` klar definiert (Vanilla + SVG, Doku-Updates verpflichtend)
- In `plans/metronom.md` ist der Metronom-Plan als abgeschlossen dokumentiert
- Feature-spezifische `CLAUDE.md`-Dateien in den Untermodulen sind vorhanden und inhaltlich konsistent

Aktueller Git-Stand:
- Branch: `copilot/initialize-project-and-analyze-code-again`
- Sehr wenige Commits auf dem Branch (u. a. Initial-Plan-Commit)

## 4) Engineering-Disziplinen: Verbesserungs-vorschläge

### A. Architektur & Design
1. **Gemeinsame Konvention für Modul-APIs festhalten**  
   Für jedes Feature verbindlich: `startExercise()` / `stopExercise()`, klar dokumentierte State-Struktur.
2. **Leichte Entkopplung Navigation ↔ Feature-Lifecycle**  
   Optionaler zentraler Registry-Ansatz statt wachsender `if`-Ketten in `app.js`.

### B. Projektstruktur
1. **`docs/`-Bereich ergänzen**  
   Eine zentrale technische Übersicht (Architektur + Lifecycle + Konventionen), um Wissen aus verstreuten `.md`-Dateien zu bündeln.
2. **Roadmap-Priorisierung sichtbar machen**  
   In `plans/` Priorität/Status vereinheitlichen (z. B. `planned`, `in progress`, `done`).

### C. Qualitätsmanagement & Testfälle
1. **Schritt 1 (Quick Win): Unit-Tests für Pure Logic**  
   Kandidaten:
   - `js/games/fretboardToneRecognition/fretboardLogic.js`
   - `js/tools/guitarTuner/tunerLogic.js`
   - `js/tools/metronome/metronomeLogic.js`
2. **Schritt 2: Minimal-Linting einführen**  
   ESLint mit wenigen Kernregeln, um Fehler früh zu erkennen.
3. **Schritt 3: CI auf GitHub Actions**  
   Lint + Tests bei PRs/Pushes.
4. **Schritt 4: Manuelle QA-Checkliste**  
   Solange keine vollständige Testabdeckung existiert: reproduzierbare Browser-Testmatrix (Desktop + Mobile + Mic-Audio-Fälle).

## 5) Konkrete Testfall-Ideen

1. **Fretboard-Logik**
   - korrekte Note bei bekannten String/Fret-Kombinationen
   - zufällige Position innerhalb erlaubter Strings/Bundgrenze
2. **Tuner-Logik**
   - `frequencyToNote(440)` ergibt A4 mit kleiner Cent-Abweichung
   - Stille-/Rauschfälle liefern stabil `null` bei Pitch-Detection
3. **Metronom-Logik**
   - BPM-Änderung wird korrekt übernommen
   - Beat-Zählung/Taktart laufen konsistent

## 6) Offene Fragen an Maintainer

1. Soll mittelfristig eine minimale Toolchain (Tests + Lint + CI) verbindlich eingeführt werden?
2. Soll die Navigation in `app.js` bei zusätzlichen Features strukturell refaktoriert werden (Registry statt `if`-Kette)?
3. Welche der geplanten Features in `plans/` hat aktuell höchste Priorität?
4. Gibt es Zielvorgaben für Browser-/Mobile-Support und Audio-Verhalten (insb. iOS)?
5. Soll die Service-Worker-Assetverwaltung künftig automatisiert werden?
6. Ist Internationalisierung (de/en) geplant oder bleibt die App deutschsprachig?

## 7) Empfohlene nächste Schritte (kurzfristig)

1. Test-Setup für Pure-Logic-Module etablieren  
2. Kleinste mögliche ESLint-Basis ergänzen  
3. CI-Workflow für PR-Qualitätsgates aktivieren  
4. Danach erst größere Feature-Umsetzung aus `plans/`
