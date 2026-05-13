# Onset Tagger

Browser-Werkzeug zur manuellen Annotation von Onset-Zeitstempeln in Gitarren-Aufnahmen. Erzeugt Ground-Truth-Daten für die Validierung der Onset-Erkennungsalgorithmen (`sweep-runs/onset/`).

## Dateien

| Datei | Zweck |
|---|---|
| `onsetTagger.js` | Haupt-Controller (`createOnsetTaggerFeature`): Datei-Laden, Playback, Slider-Logik, ZIP-Export |
| `onsetTaggerWaveform.js` | SVG-Waveform-Rendering: Envelope, Zeitachse, Cursor (grün), Onset-Marker (rot), Playhead (orange) |
| `onsetTaggerLogic.js` | Pure Functions: Envelope-Berechnung, Zeit-Pixel, Onset-Liste, Sidecar-Builder |

## Seite

- `pages/onset-tagger/index.html` — Tool-Seite
- `pages/onset-tagger/bootstrap.js` — Imports + mount

## Workflow

1. WAV-Datei laden → Waveform erscheint, Schritt 1 aktiv
2. JSON-Sidecar laden → Metadaten-Formular befüllt, Schritt 2 aktiv
3. Start/Ende-Slider → Bereich einschränken (Waveform zoomt in den Bereich)
4. Onset-Cursor-Slider → grüner Strich positionieren (Range: Start bis Ende in ms)
5. „+ Hinzufügen" → Onset in Liste (roter Strich in Waveform)
6. Play/Pause/Stop → Wiedergabe in Schleife über Start–Ende, mit wählbarer Geschwindigkeit
7. Metadaten editieren (Schritt 2)
8. „Als ZIP exportieren" → WAV + JSON (mit `onsetsMs`-Feld) als ZIP-Download

## Sidecar-Format

Das exportierte JSON enthält alle Original-Felder plus:
```json
{
  "onsetsMs": [1234, 2567, 3891]
}
```

## Onsets einsortieren

```
node scripts/import-onset-zip.mjs <path-to-zip> [--force] [--dry-run]
```

Routing:
- `chord`-Feld → `tests/fixtures/chords/{chord}/`
- `category`-Feld → `tests/fixtures/sequences/{category}/`
- Sonst → `tests/fixtures/tagged/`

## ZIP-Implementierung

Nutzt `buildZip` + `downloadBlob` aus `js/games/sheetMusicReading/sheetMusicZip.js` (Store-mode, keine externen Deps).

## Playback

- `AudioBufferSourceNode` mit `loopStart`/`loopEnd` für Schleife
- `playbackRate`: 1.0 / 0.75 / 0.5 / 0.25
- RAF-Schleife: `computePlayheadPosition` → `updatePlayhead`
- Stop-Button: setzt Range zurück auf gesamte Datei (View-Reset)

## Tests

- Unit: `tests/unit/onsetTaggerLogic.test.js` — 35 Tests
- E2E: `tests/e2e/onset-tagger.spec.js` — 8 Playwright-Tests
