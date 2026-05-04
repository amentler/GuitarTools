# chordRecorder — Akkord-Aufnahme-Tool

Datensammlungs-Tool für das ML-Training der Akkorderkennung.  
Kein Lern-Tool — kein Nutzer-Feedback zur Akkord-Erkennung.

## Zweck

Nimmt Gitarren-Akkorde in verschiedenen Variationen auf (Technik, Lautstärke, Strum-Modus)
und lädt sie als WAV + Sidecar-JSON herunter. Die Dateien landen in
`tests/fixtures/chords/` und werden via `introduce-chord-fixture.mjs` eingebunden.

## Dateien

```
chordRecorder.js           — Factory createChordRecorderTool(), Haupt-Controller
chordRecorderVariations.js — Pure: buildVariationList(config) (Phase 2)
chordRecorderQuality.js    — Pure: Quality Gates (Phase 3)
chordRecorderAudio.js      — Mikrofon, MediaRecorder, Onset-Detektion (Phase 4)
chordRecorderUI.js         — Countdown, Metronom-Blinken, Buttons (Phase 4)
chordRecorderFiles.js      — Dateinamen, Sidecar-JSON, In-Memory-Store (Phase 5)
```

## Implementierungsphasen

Siehe `plans/chord_recognition_improvement/chord-recorder-phases.md`.
