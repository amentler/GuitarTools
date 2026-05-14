# Onset Tagger

Browser-Werkzeug zur manuellen Annotation von Onset-Zeitstempeln in Gitarren-Aufnahmen. Erzeugt Ground-Truth-Daten für die Validierung der Onset-Erkennungsalgorithmen (`sweep-runs/onset/`).

## Dateien

| Datei | Zweck |
|---|---|
| `onsetTagger.js` | Haupt-Controller (`createOnsetTaggerFeature`): Datei-Laden, Playback, Slider-Logik, ZIP-Export |
| `onsetTaggerWaveform.js` | SVG-Waveform-Rendering: normalisierte Envelope, Zeitachse, Cursor (grün), Onset-Marker (rot/grün), Playhead (orange) |
| `onsetTaggerLogic.js` | Pure Functions: Envelope-Berechnung, Zeit-Pixel, Onset-Liste, Sidecar-Builder, Auswahl-/Merge-Helfer |
| `../../shared/audio/offlineOnsetDetection.js` | Offline-Ausführung der registrierten Gitarren-Onset-Strategien für Strategie-Importe |

## Seite

- `pages/onset-tagger/index.html` — Tool-Seite
- `pages/onset-tagger/bootstrap.js` — Imports + mount

## Workflow

1. WAV-Datei laden → Waveform erscheint, Schritt 1 aktiv
2. JSON-Sidecar laden → Metadaten-Formular befüllt, Schritt 2 aktiv
3. Start/Ende-Slider → Bereich einschränken (Waveform zoomt in den Bereich)
4. Onset-Cursor-Slider → grüner Strich positionieren (Range: Start bis Ende in ms)
5. „+ Hinzufügen" oder Klick in die Waveform → Onset in Liste
6. Onset in der Liste anklicken → Marker wird grün, Cursor springt dorthin, sichtbarer Bereich fokussiert den Onset
7. Ausgewählten Onset mit dem Cursor-Slider verschieben; Entfernen bleibt über das X am Listeneintrag möglich
8. Strategie-Button anklicken → erkannte Onsets werden additiv importiert, wenn sie mindestens 50 ms Abstand zu bestehenden Markierungen haben
9. Play/Pause/Stop → Wiedergabe in Schleife über Start–Ende, mit wählbarer Geschwindigkeit
10. Metadaten editieren (Schritt 2)
11. „Als ZIP exportieren" → WAV + JSON (mit `onsetsMs`-Feld) als ZIP-Download

Die Waveform ist rein visuell normalisiert: Der größte Peak im sichtbaren Bereich
füllt die verfügbare Graphhöhe aus. Das verändert weder Audiodaten noch
exportierte Onset-Zeiten.

Beim Auto-Load aus der Aufnahmen-Uebersicht (`source`/`id` in der URL) nutzt
der Tagger den gespeicherten `baseName` des Takes fuer WAV und JSON. Das gilt
insbesondere fuer Notenlesen-Aufnahmen nach dem Schema
`notenlesen_<takt>_<bpm>bpm_<noten>_<random5>`; der Dateiname darf im Tagger
nicht auf statische Namen wie `notenlesen.wav` oder `manifest.json`
zurueckfallen, solange ein BaseName vorhanden ist.

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

- Unit: `tests/unit/onsetTaggerLogic.test.js`
- E2E: `tests/e2e/onset-tagger.spec.js` — inklusive Listen-Auswahl, Waveform-Klick und Strategie-Import
