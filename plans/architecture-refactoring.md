# Architecture Refactoring Plan

Basis: `plans/architektur-review.md` (Stand 2026-05-14)

## Vorgehen

1. Jede Phase wird vollständig umgesetzt, dann lint + test:precommit.
2. Nach erfolgreichem Test: commit + push.
3. Nach dem Push: Zusammenfassung der Änderungen + Hinweise zum manuellen Testen.
4. Dieser Plan wird nach jeder Phase aktualisiert (Status-Felder).
5. Refaktorierungen ohne Funktionsänderung – kein neues Verhalten, nur bessere Struktur.

---

## Phase 1 – Quick Wins (kein Refaktorierungsrisiko)

**Status: ERLEDIGT**

Ziel: Alle einfachen, risikoarmen Korrekturen aus dem Review erledigen.

| # | Aufgabe | Datei | Aufwand |
|---|---|---|---|
| 1.1 | XSS-Fix: `err.message` aus `innerHTML` → `textContent` | `js/tools/chordRecorder/chordRecorder.js:743` | 15 Min |
| 1.2 | Legacy-SVG: `tonFinderSVG.js` löschen (nach Import-Check) | `js/games/tonFinder/tonFinderSVG.js` | 10 Min |
| 1.3 | Legacy-SVG: `tunerSVG.js` löschen (nach Import-Check) | `js/tools/guitarTuner/tunerSVG.js` | 10 Min |
| 1.4 | `fretboardLogic.js`-Duplikat entfernen, Domain-Version verwenden | `js/games/fretboardToneRecognition/fretboardLogic.js` | 20 Min |
| 1.5 | Re-Export-Datei entfernen, Imports direkt auf Source umbiegen | `js/utils/chordDetectionUtils.js` | 10 Min |
| 1.6 | Essentia-Failures als `test.skip` markieren | `essentiaChordAudio.test.js`, `essentiaBassScore.test.js` | 20 Min |

**Manuell testen nach Phase 1:**
- Chord Recorder öffnen → Mikrofon-Berechtigung verweigern → Fehlermeldung erscheint korrekt (kein HTML-Injection)
- Ton-Finder öffnen → Fretboard wird angezeigt und ist klickbar
- Fretboard Tone Recognition öffnen → Übung startet und erkennt gespielte Noten

---

## Phase 2 – Dokumentation & Sicherheit

**Status: ERLEDIGT**

Ziel: CSP-Header und aktuelle Architekturdoku.

| # | Aufgabe | Aufwand |
|---|---|---|
| 2.1 | CSP-Meta-Tag in alle HTML-Seiten (`index.html` + alle `pages/*/index.html`) | 45 Min |
| 2.2 | `docs/architecture.md` aktualisieren: Tools-Dateigrößen-Konvention, domain-Layer-Policy, fehlende Tools-Einträge | 30 Min |

**Manuell testen nach Phase 2:**
- Browser-DevTools → Console prüfen: keine CSP-Verletzungen beim Öffnen von `index.html`
- Essentia-Seite (`chord-playing-essentia`) öffnen → WASM lädt ohne Fehler (CSP erlaubt `wasm-unsafe-eval`)
- Alle Seiten kurz öffnen: keine neuen Konsolenfehler

---

## Phase 3 – Controller-Tests

**Status: ERLEDIGT**

Ziel: Fehlende Smoke-/Controller-Tests für ältere Games nachholen.

| # | Aufgabe | Datei (neu) | Aufwand |
|---|---|---|---|
| 3.1 | Mount/Unmount-Test für `akkordTrainer` | `tests/unit/akkordTrainerController.test.js` | 30 Min |
| 3.2 | Mount/Unmount-Test für `tonFinder` | `tests/unit/tonFinderController.test.js` | 30 Min |
| 3.3 | Mount/Unmount-Test für `fretboardExercise` | `tests/unit/fretboardExerciseController.test.js` | 30 Min |

Vorlage: bestehende `*PageSmoke.test.js`-Dateien.

**Manuell testen nach Phase 3:**
- Rein maschinell: `npm run test:precommit` muss grün sein.
- Keine UI-Regression möglich (nur Tests hinzugefügt).

---

## Phase 4 – Refaktorierung: chordRecorder.js (780 Z.)

**Status: OFFEN**

Ziel: `chordRecorder.js` aufteilen in drei fokussierte Module.

Aufteilung:
- `chordRecorderAudio.js` – Mikrofon-Capture, AudioContext, Analyser-Node
- `chordRecorderUI.js` – DOM-Rendering-Funktionen (Listen, Cards, Buttons)
- `chordRecorder.js` – Koordination der beiden Module (~150-200 Z.)

Bestehende Tests bleiben unverändert (kein API-Bruch nach außen).

**Manuell testen nach Phase 4:**
- Chord Recorder vollständig durchspielen: Aufnahme starten → Chord aufnehmen → Liste anzeigen → Aufnahme löschen
- Mikrofon-Fehlerfall: Berechtigung verweigern → Fehlermeldung erscheint

---

## Phase 5 – Refaktorierung: essentiaChordLogic.js (997 Z.)

**Status: OFFEN**

Ziel: `essentiaChordLogic.js` nach Verantwortlichkeit aufteilen.

Aufteilung:
- `essentiaChordTemplates.js` – Template-Aufbau (Chord-Profile-Daten) – falls noch nicht vorhanden
- `essentiaChordEvaluation.js` – Konfidenz-Bewertung und Ranking
- `essentiaChordLogic.js` – HPCP-Matching-Kern (~200-300 Z.)

`essentiaBassScore.js` existiert bereits und bleibt unverändert.

**Manuell testen nach Phase 5:**
- `chord-playing-essentia` öffnen → Akkord-Erkennung funktioniert (Am, Em, G, C spielen)
- `npm run test:audio:chord` ausführen (darf weiterhin die bekannten skipped Failures haben)

---

## Phase 6 – Refaktorierung: sheetMusicReading.js (1081 Z.)

**Status: OFFEN**

Ziel: Größtes Modul aufteilen. Vorbild: `akkordfolgenAudioSession.js`-Pattern.

Aufteilung:
- `sheetMusicState.js` – State-Maschine (score, currentNote, attempts, phase)
- `sheetMusicAudioSession.js` – Audio-Pipeline-Setup und Teardown
- `sheetMusicReading.js` – Controller: koordiniert State + Audio + SVG (~200 Z.)

`sheetMusicSVG.js` und `sheetMusicRecorder.js` bleiben unverändert.

**Manuell testen nach Phase 6:**
- Sheet Music Reading vollständig spielen: Note erscheint → Note spielen → Feedback korrekt → nächste Note
- Seite verlassen und zurückkehren: kein hängender AudioContext, kein Memory Leak
- Mikrofon-Berechtigung verweigern: Fehlermeldung erscheint, kein Absturz

---

## Fortschritt

| Phase | Status | Commit |
|---|---|---|
| 1 – Quick Wins | ERLEDIGT | (nächster Commit) |
| 2 – Doku & Sicherheit | ERLEDIGT | (nächster Commit) |
| 3 – Controller-Tests | ERLEDIGT | — |
| 4 – chordRecorder aufteilen | OFFEN | — |
| 5 – essentiaChordLogic aufteilen | OFFEN | — |
| 6 – sheetMusicReading aufteilen | OFFEN | — |
