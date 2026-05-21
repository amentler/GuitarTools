# Onset Tagger

Browser-Werkzeug zur manuellen Annotation von Onset-Zeitstempeln in Gitarren-Aufnahmen. Erzeugt Ground-Truth-Daten für die Validierung der Onset-Erkennungsalgorithmen (`sweep-runs/onset/`).

## Dateien

| Datei | Zweck |
|---|---|
| `onsetTagger.js` | Haupt-Controller (`createOnsetTaggerFeature`): Datei-Laden, Playback, Slider-Logik, ZIP-Export |
| `onsetTaggerLoadMenu.js` | Verdrahtet den kompakten Laden-Flyout fuer WAV/JSON/ZIP |
| `onsetTaggerPersistence.js` | Speichert bearbeitete WAV+Sidecar-Takes direkt in die jeweilige IndexedDB-Quelle oder als Analyse-Handoff |
| `onsetTaggerWaveform.js` | SVG-Waveform-Rendering: normalisierte Envelope, Zeitachse, Cursor (grün), Onset-Marker (rot/grün), Playhead (orange) |
| `onsetTaggerLogic.js` | Pure Functions: Envelope-Berechnung, Zeit-Pixel, Onset-Liste, Sidecar-Builder, Auswahl-/Merge-Helfer |
| `../../shared/audio/offlineOnsetDetection.js` | Offline-Ausführung der registrierten Gitarren-Onset-Strategien für Strategie-Importe |

## Seite

- `pages/onset-tagger/index.html` — Tool-Seite
- `pages/onset-tagger/bootstrap.js` — Imports + mount

## Workflow

1. `Laden` oeffnet den Flyout fuer WAV-, JSON- oder ZIP-Import; WAV-Datei laden → Waveform erscheint, Schritt 1 aktiv
2. JSON-Sidecar laden → Metadaten-Formular befüllt, Schritt 2 aktiv
3. Play/Pause/Stop und Speed-Auswahl stehen oberhalb der Waveform; Wiedergabe läuft in Schleife über Start–Ende
4. Start/Ende-Slider → Bereich einschränken (Waveform zoomt in den Bereich). Der Start-Slider läuft von WAV-Start bis zur aktuellen Ende-Position; der Ende-Slider läuft von der aktuellen Start-Position bis zum WAV-Ende.
5. Kleine `+`/`-`-Zoom-Buttons neben „Hinzufügen" und „Entfernen" ziehen Start und Ende je Klick um 10% der aktuellen sichtbaren Distanz zusammen oder auseinander
6. Onset-Cursor-Slider → grüner Strich positionieren (Range: Start bis Ende in ms)
7. „+ Hinzufügen" oder Klick in die Waveform → Onset in Liste
8. Onset in der Liste oder ueber den Punkt vertikal oberhalb der Waveform-Linie anklicken → Marker wird grün, Cursor springt dorthin, sichtbarer Bereich zentriert den Onset in einem 0,6-s-Fenster
9. Ausgewählten Onset mit dem Cursor-Slider verschieben; Entfernen ist über den „Entfernen"-Button neben „Hinzufügen" möglich
10. Strategie-Button unter der Onset-Liste anklicken → erkannte Onsets werden additiv importiert, wenn sie mindestens 50 ms Abstand zu bestehenden Markierungen haben
11. Metadaten editieren (Schritt 2)
12. Dateiname/BaseName kann im Tagger editiert werden; Export, persistierte Aufnahme und Analyzer-Link verwenden den aktuellen Namen sofort
13. „Als ZIP exportieren" → WAV + JSON (mit `onsetsMs`-Feld) als ZIP-Download
14. „Im Analyzer öffnen" speichert die aktuelle WAV+Sidecar direkt und öffnet `audio-analyse` mit `source`/`id`

Die Waveform ist rein visuell normalisiert: Der größte Peak im sichtbaren Bereich
füllt die verfügbare Graphhöhe aus. Das verändert weder Audiodaten noch
exportierte Onset-Zeiten.

Beim Auto-Load aus der Aufnahmen-Uebersicht (`source`/`id` in der URL) nutzt
der Tagger den gespeicherten `baseName` des Takes fuer WAV und JSON. Das gilt
insbesondere fuer Notenlesen-Aufnahmen nach dem Schema
`notenlesen_<takt>_<bpm>bpm_<noten>_<random5>`; der Dateiname darf im Tagger
nicht auf statische Namen wie `notenlesen.wav` oder `manifest.json`
zurueckfallen, solange ein BaseName vorhanden ist.

Onset- und Metadaten-Aenderungen werden debounced direkt in die Sidecar der
geladenen Aufnahme geschrieben. Lokal geladene WAV/JSON/ZIP-Dateien werden beim
Analyzer-Handoff als vollstaendiger Sheet-Music-Take in IndexedDB gespeichert.

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

Nutzt `buildRecordingZip`, `readZip` + `downloadBlob` aus `js/shared/zip.js` (Store-mode, keine externen Deps).

Export: `baseName-tagged.zip` mit `baseName.wav` + `baseName.json` direkt darin.

Import: Neben WAV- und JSON-Button gibt es einen **ZIP-Button** (`tagger-zip-btn`). Beim Laden einer ZIP-Datei wird die WAV-Datei extrahiert und – falls vorhanden – die JSON-Sidecar automatisch mitgeladen. Import ohne Sidecar bleibt möglich (Formular-Defaults werden verwendet).

## Playback

- `AudioBufferSourceNode` mit `loopStart`/`loopEnd` für Schleife
- `playbackRate`: 1.0 / 0.75 / 0.5 / 0.25
- RAF-Schleife: `computePlayheadPosition` → `updatePlayhead`
- Stop-Button: setzt Range zurück auf gesamte Datei (View-Reset)

## Tests

- Unit: `tests/unit/onsetTaggerLogic.test.js`
- E2E: `tests/e2e/onset-tagger.spec.js` — inklusive Listen-Auswahl, Waveform-Klick und Strategie-Import
