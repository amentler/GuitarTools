# GuitarTools – Backlog Index

Stand: 2026-05-02

Dieses Dokument ist der aktuelle Einstieg in offene und archivierte Planungsdokumente.

## Aktuell in Arbeit

- [plans/precisionplans/unified-precision-plan-2026-05-02.md](precisionplans/unified-precision-plan-2026-05-02.md)
  Chord-Precision-Steigerung (TDD). Phase 1–4 abgeschlossen (Precision 81.4%). Phase 5: Subset-/Toleranzregeln.

- [plans/open-strum-reject-plan-2026-05-02.md](open-strum-reject-plan-2026-05-02.md)
  Open-Strum-Reject teilweise umgesetzt (Phasen 1–4). Offene Phasen 5+ (robustere Abgrenzung).

## Nächste Schritte (priorisiert)

### P0 – Stabilität / reale Browser-Bugs

- ✅ AudioContext-Suspend-Fix umgesetzt
- ✅ sheetMusicMic Timeout-Handles in `state`; `stopListening()` räumt ab
- ✅ Leerer Note-Pool abgesichert (`generateNewBars()` zeigt Fehlermeldung)
- [plans/fretboard-tone-recognition-e2e-issues-2026-05-02.md](fretboard-tone-recognition-e2e-issues-2026-05-02.md)
  Drei offene Playwright-Cases in Fretboard-Ton-Erkennung; Analyse- und Reparaturplan.

### P1 – Testabdeckung

- [plans/playwright-testplan-2026-04-29.md](playwright-testplan-2026-04-29.md)
  Fehlende UI-Specs (Phase 2, Prio B): `guitar-tuner-ui`, `note-playing-ui`,
  `akkordfolgen-trainer-ui`, `sheet-music-mic-ui`. Keine Audio-Abhängigkeit, CI-stabil.

- [plans/notenzeilen-akustische-pruefung.md](notenzeilen-akustische-pruefung.md)
  Stufe 2 noch offen: `fastNoteMatcherLatency.test.js` (B1–B6) und Sequenz-Aufnahmen
  C5.2–C5.6. Braucht Gitarre + Mikrofon.

### P2 – Analyse / Beobachtung

- [plans/sheet-music-mic-auto-listen-analyse-2026-04-30.md](sheet-music-mic-auto-listen-analyse-2026-04-30.md)
  Nicht abgesicherte Browser-Pfade (Settings-Wechsel, Endlosmodus, Permission).

- [plans/architektur-review-2026-05-01.md](architektur-review-2026-05-01.md)
  Aktuelles Architektur-Review. P1-Maßnahmen nach P0 angehen.

### P3 – Features / Zukunft

- [plans/global-debug-mode-plan-2026-04-30.md](global-debug-mode-plan-2026-04-30.md)
  Globaler Debug-Modus (8 Phasen). Noch nicht begonnen.

## Backlog / Ideen

- [plans/backlog/improvement.md](backlog/improvement.md)
- [plans/backlog/intervall-gehoertraining.md](backlog/intervall-gehoertraining.md)
- [plans/backlog/skalenvisualisierer.md](backlog/skalenvisualisierer.md)
- [plans/backlog/ideen.md](backlog/ideen.md)
- [plans/backlog/codexanalyse.md](backlog/codexanalyse.md)

## Archiviert

- ✅ [plans/old/adaptive-item-selection-2026-05-01.md](old/adaptive-item-selection-2026-05-01.md)
  Spaced Repetition umgesetzt (tonFinder, fretboardToneRecognition, akkordTrainer).
- ✅ [plans/old/audiocontext-resume-ohne-button-2026-05-01.md](old/audiocontext-resume-ohne-button-2026-05-01.md)
  AudioContext-Suspend-Fix umgesetzt.
- ✅ [plans/old/global-settings-2026-05-01.md](old/global-settings-2026-05-01.md)
  Globale Einstellungen umgesetzt (`globalSettings.js`).
- ✅ [plans/old/open-strum-reject-plan-phasen-1-4-abgeschlossen-2026-05-02.md](old/open-strum-reject-plan-phasen-1-4-abgeschlossen-2026-05-02.md)
  Open-Strum-Reject Phasen 1–4 abgeschlossen.
- ✅ [plans/old/phase-6-test-ci-qualitaet-2026-04-29.md](old/phase-6-test-ci-qualitaet-2026-04-29.md)
- ✅ [plans/old/phase-5-conventions-plan-2026-04-26.md](old/phase-5-conventions-plan-2026-04-26.md)
- ✅ [plans/old/phase-4-shared-controls-plan-2026-04-25.md](old/phase-4-shared-controls-plan-2026-04-25.md)
- ✅ [plans/old/fretboard-unification-plan-2026-04-26.md](old/fretboard-unification-plan-2026-04-26.md)
- ✅ [plans/old/architektur-review-plan-phasen-1-4-abgeschlossen-2026-04-24.md](old/architektur-review-plan-phasen-1-4-abgeschlossen-2026-04-24.md)
