# Archiv: Architektur-Review-Plan - Phasen 1-4

Quelle: `plans/architektur-review-plan-2026-04-21.md`  
Archiviert: 2026-04-24  
Grund: Die Phasen 1 bis 4 des Refactoring-Plans sind umgesetzt und verifiziert. Im aktiven Plan bleiben nur die offenen Phasen 5 und 6.

## Phase 1: Architektur konsolidieren

Status: abgeschlossen am 2026-04-22

Ergebnis:

- Multi-Page-Bootstrapping pro Seite unter `pages/<seite>/`.
- SPA-/Registry-Reste bereinigt bzw. auf einen konsistenten Seitenstart zurückgeführt.
- Gemeinsames Feature-Interface über `mount`/`unmount` bzw. kompatible Start-/Stop-Adapter vereinheitlicht.

## Phase 2: Schichtgrenzen sauber ziehen

Status: abgeschlossen am 2026-04-22

Ergebnis:

- `js/domain/` und `js/shared/` wurden als neutrale Schichten eingeführt.
- Fretboard-, Pitch-, Chord-, Metronom- und Sheet-Music-Bausteine liegen nicht mehr nur in Feature-Ordnern.
- `components` importiert keine Feature-Logik mehr direkt.
- Kritische Cross-Feature-Abhängigkeiten wurden auf Shared-/Domain-Module umgestellt; einzelne Altpfade bleiben als Kompatibilitäts-Re-Exports bestehen.

## Phase 3: Große Controller zerlegen

Status: abgeschlossen am 2026-04-22

Ergebnis:

- `guitarTuner`, `sheetMusicReading`, `sheetMusicMic`, `akkordfolgenTrainer` und `notePlayingExercise` wurden entlang von UI-, Audio-/Session- und zustandsnahen Verantwortungen geschnitten.
- Vor jedem Schnitt wurden gezielte Controller-Tests ergänzt; die Refactors liefen TDD-gestützt auf abgesichertem Verhalten.
- Die früher großen Einstiegsmodule koordinieren jetzt primär Lebenszyklus und Orchestrierung statt DOM, Audio und Ablaufsteuerung gemeinsam zu tragen.

## Phase 4: Shared Infrastructure einführen

Status: abgeschlossen am 2026-04-24

Ergebnis:

- `js/shared/storage/storageService.js` kapselt wiederkehrende `localStorage`-Zugriffe; Metronom und `sheetMusicReadingStorage` nutzen den Shared-Service.
- `js/shared/audio/microphoneService.js`, `js/shared/audio/audioSessionService.js` und `js/shared/audio/audioContextFactory.js` zentralisieren Mikrofon-, Session- und AudioContext-Lifecycle.
- Die Feature-spezifischen Audio-Session-Wrapper (`guitarTuner`, `sheetMusicMic`, `akkordfolgenTrainer`, `notePlayingExercise`) sowie `chordExerciseEssentia` hängen jetzt an den Shared-Audio-Bausteinen statt eigene Browser-Wiring-Logik zu duplizieren.
- `js/shared/pwa/precacheManifest.js` liefert die zentrale, getestete Precache-Liste für `sw.js`.

Verifikation:

- `npm run lint`
- `npx vitest run tests/unit/storageService.test.js tests/unit/microphoneService.test.js tests/unit/audioSessionService.test.js tests/unit/audioContextFactory.test.js tests/unit/precacheManifest.test.js tests/unit/essentiaChordDetection.test.js tests/unit/chordExerciseEssentiaController.test.js`
