# GuitarTools – Backlog Index

Stand: 2026-05-01

Dieses Dokument ist der aktuelle Einstieg in offene und archivierte Planungsdokumente.

## Aktuell in Arbeit

- [plans/global-debug-mode-plan-2026-04-30.md](global-debug-mode-plan-2026-04-30.md)
  Globaler Debug-Modus mit In-App-Fenster, strukturiertem Log und „Alles kopieren". Wird gerade umgesetzt.

## Nächste Schritte (priorisiert)

### P0 – Stabilität / reale Browser-Bugs

- ✅ [plans/audiocontext-resume-ohne-button-2026-05-01.md](audiocontext-resume-ohne-button-2026-05-01.md)
  AudioContext-Suspend-Fix umgesetzt: nach `resume()` wird bei `suspended` geworfen; beide Mic-Controller zeigen Reload-Meldung.

- ✅ **sheetMusicMic Timeout-Handles** (Quelle: architektur-review-2026-05-01.md P0-1)
  `successTimeout` + `wrongTimeout` in `state`; `stopListening()` räumt beide ab.

- ✅ **Leerer Note-Pool** (Quelle: architektur-review-2026-05-01.md P0-2)
  `generateNewBars()` prüft jetzt auf leeren Pool und zeigt Fehlermeldung statt still auf Default-Pool zurückzufallen.

### P1 – Testabdeckung

- [plans/playwright-testplan-2026-04-29.md](playwright-testplan-2026-04-29.md)
  Fehlende UI-Specs (Phase 2, Prio B): `guitar-tuner-ui`, `note-playing-ui`,
  `akkordfolgen-trainer-ui`, `sheet-music-mic-ui`. Keine Audio-Abhängigkeit, CI-stabil.

- [plans/notenzeilen-akustische-pruefung.md](notenzeilen-akustische-pruefung.md)
  Stufe 2 noch offen: `fastNoteMatcherLatency.test.js` (B1–B6) und Sequenz-Aufnahmen
  C5.2–C5.6 (ascending, descending, repeat, chromatic, cmajor, leaps). Braucht Gitarre + Mikrofon.

### P2 – Analyse / Beobachtung

- [plans/sheet-music-mic-auto-listen-analyse-2026-04-30.md](sheet-music-mic-auto-listen-analyse-2026-04-30.md)
  Analyse der nicht abgesicherten Browserpfade (Settings-Wechsel bei aktivem Listening,
  Endlosmodus, echter Permission-Pfad). Kein sofortiger Handlungsbedarf, aber Referenz für
  zukünftige E2E-Erweiterungen.

- [plans/architektur-review-2026-05-01.md](architektur-review-2026-05-01.md)
  Aktuelles Architektur-Review. P1-Maßnahmen (sheetMusicMic Sequenzlogik extrahieren,
  generische FFT-Session-Factory, akkordTrainer Runden-/Input-Logik) können nach P0 angegangen
  werden.

### P2 – Lernqualität

- ✅ [plans/global-settings-2026-05-01.md](global-settings-2026-05-01.md)
  Globale Einstellungen umgesetzt. `globalSettings.js` + Einstellungen-Abschnitt in `index.html`.

- ✅ [plans/adaptive-item-selection-2026-05-01.md](adaptive-item-selection-2026-05-01.md)
  Spaced Repetition umgesetzt für tonFinder, fretboardToneRecognition, akkordTrainer.
  `srsLogic.js` mit 19 Unit-Tests. Standard: an. sheetMusicReading zurückgestellt.

## Backlog / Ideen

- [plans/backlog/improvement.md](backlog/improvement.md)
  Allgemeine Verbesserungswunschliste. Teilweise umgesetzt (factory pattern, settings, pre-commit).
  Noch offen: Service Worker Caching (P0), Shared AudioContext Manager (P1), Split large files (P2).
- [plans/backlog/intervall-gehoertraining.md](backlog/intervall-gehoertraining.md)
  Geplanter neuer Trainer.
- [plans/backlog/skalenvisualisierer.md](backlog/skalenvisualisierer.md)
  Geplantes neues Tool.
- [plans/backlog/ideen.md](backlog/ideen.md)
  Ideensammlung ohne Umsetzungsstatus.
- [plans/backlog/codexanalyse.md](backlog/codexanalyse.md)
  Ältere Meta-Analyse; weiterhin nur als Referenz und Ideensammlung.

## Archiviert

- [plans/old/phase-6-test-ci-qualitaet-2026-04-29.md](old/phase-6-test-ci-qualitaet-2026-04-29.md)
  Abgeschlossener Umsetzungsplan für die Test-/CI-Verbesserungen aus Phase 6.
- [plans/architektur-review-plan-2026-04-21.md](architektur-review-plan-2026-04-21.md)
  Architekturreview als Referenzdokument; die darin beschriebenen Phasen 1 bis 6 sind abgeschlossen.
- [plans/old/chord-exercise-essentia-plan-2026-04-12.md](old/chord-exercise-essentia-plan-2026-04-12.md)
  Der frühere Chord-Exercise-Plan aus diesem Dokument ist umgesetzt und wurde ausgelagert.
- [plans/old/review-2026-04-20.md](old/review-2026-04-20.md)
  Historische technische Review; die Nachfolgearbeit liegt im Architekturreview-Plan.
