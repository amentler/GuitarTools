# Onset Tagger

Browser-Werkzeug zur manuellen Annotation von Onset-Zeitstempeln in Gitarren-Aufnahmen. Erzeugt Ground-Truth-Daten für die Validierung der Onset-Erkennungsalgorithmen (`sweep-runs/onset/`).

## Dateien

| Datei | Zweck |
|---|---|
| `onsetTagger.js` | Haupt-Controller (`createOnsetTaggerFeature`): Datei-Laden, State, Callbacks (~515 LOC) |
| `onsetTaggerEventWiring.js` | Alle addEventListener-Aufrufe und Handler-Logik; wird von `mount()` über `wireOnsetTaggerEvents(ui, ctx)` initialisiert |
| `onsetTaggerLoadMenu.js` | Verdrahtet den kompakten Laden-Flyout für WAV/JSON/ZIP |
| `onsetTaggerPersistence.js` | Speichert bearbeitete WAV+Sidecar-Takes direkt in die jeweilige IndexedDB-Quelle oder als Analyse-Handoff |
| `onsetTaggerWaveform.js` | SVG-Waveform-Rendering: normalisierte Envelope, Zeitachse, Cursor (grün), Onset-Marker (rot/grün), Playhead (orange) |
| `onsetTaggerAnalysisFlyout.js` | Analyse-Flyout mit Strategieauswahl, Charts und per Analyse-Lauf eingefrorener Onset-Statistik gegen aktuelle Tags |
| `onsetTaggerLogic.js` | Pure Functions: Envelope-Berechnung, Zeit-Pixel, Onset-Liste, Sidecar-Builder, Auswahl-/Merge-Helfer |
| `../../shared/audio/audioTransport.js` | Gemeinsame Web-Audio-Playback-Engine (auch von `audioAnalyse.js` genutzt) |
| `../../shared/audio/taggedOnsetMetrics.js` | Gemeinsame Pure Functions für TP/FP/FN, Precision/Recall/F1, Timing-Metriken und baseName-basierten Trainingsstatus |
| `../../shared/audio/offlineOnsetDetection.js` | Offline-Ausführung der registrierten Gitarren-Onset-Strategien für Strategie-Importe |

## Seite

- `pages/onset-tagger/index.html` — Tool-Seite
- `pages/onset-tagger/bootstrap.js` — Imports + mount

## Architektur

`mount()` setzt `_ui` als Modul-Variable und ruft dann `wireOnsetTaggerEvents(_ui, ctx)` auf.
Das `ctx`-Objekt enthält Getter/Setter für alle Mutable-State-Variablen sowie gebundene Callback-Funktionen (`startPlayback`, `stopPlayback`, `loadWav`, `updateOnsetUI`, …).

Playback läuft über `createAudioTransport()` aus `js/shared/audio/audioTransport.js`:
- `_transport.start(buf, { loopStart, loopEnd, playbackRate, onTick })` für loopende Wiedergabe
- `_transport.pause()` / `_transport.stop()` zum Pausieren/Stoppen
- `_transport.setRate(rate)` rebased die Timeline für Mid-Play Ratenänderungen
- `_transport.getCtx()` gibt den lazy-initialisierten `AudioContext` zurück

## Workflow

1. `Laden` öffnet den Flyout für WAV-, JSON- oder ZIP-Import; WAV-Datei laden → Waveform erscheint, Schritt 1 aktiv
2. JSON-Sidecar laden → Metadaten-Formular befüllt, Schritt 2 aktiv
3. Play/Pause/Stop und Speed-Auswahl stehen oberhalb der Waveform; Wiedergabe läuft in Schleife über Start–Ende
4. Start/Ende-Slider → Bereich einschränken (Waveform zoomt in den Bereich)
5. Zoom-Buttons ziehen Start und Ende je Klick um 10% zusammen oder auseinander
6. Onset-Cursor-Slider → grüner Strich positionieren (Range: Start bis Ende in ms)
7. „+ Hinzufügen" oder Klick in die Waveform → Onset in Liste
8. Onset in der Liste oder über den Punkt in der Waveform anklicken → Marker wird grün, Cursor springt dorthin
9. Ausgewählten Onset mit dem Cursor-Slider verschieben; „Entfernen"-Button entfernt ihn
10. Strategie-Button → erkannte Onsets additiv importieren (min. 50 ms Abstand)
11. Analyse-Flyout → Onset-Modell aus der asynchron geladenen XGBoost-Registry auswählen; gespeicherte Registry-Keys bleiben nach dem Laden aktiv
12. Metadaten editieren (Schritt 2)
13. „Als ZIP exportieren" → WAV + JSON als ZIP-Download
14. „Im Analyzer öffnen" speichert und öffnet `audio-analyse`

## Analyse-Statistik

Das Flyout berechnet TP/FP/FN, Precision, Recall, F1, Treffer- und Timing-Metriken direkt im Browser aus den erkannten Onsets der gewählten Strategie und den aktuell geladenen Tags.
Die Statistik wird beim ersten Analyse-Lauf nach WAV-Laden, nach Sidecar-Laden und bei Strategiewechsel neu berechnet; spätere manuelle Tag-Edits aktualisieren sie erst beim nächsten Analyse-Lauf.
Der Trainingsstatus ist ein baseName-Abgleich gegen `trainingDataFiles` im XGBoost-Schema (`training_data_<baseName>.json`) und kein Audio-Hash-Beweis.

## ZIP-Implementierung

Nutzt `buildRecordingZip`, `readRecordingZip` und `downloadBlob` aus `js/shared/zip.js`.

Export: `baseName-tagged.zip` mit `baseName.wav` + `baseName.json` direkt darin.

Import: ZIP-Button (`tagger-zip-btn`) extrahiert WAV + optional JSON via `readRecordingZip(file)`.

## Sidecar-Format

Das exportierte JSON enthält alle Original-Felder plus:
```json
{
  "id": "notenlesen_4-4_120bpm_demo",
  "baseName": "notenlesen_4-4_120bpm_demo",
  "recordedAt": "2026-05-22T18:30:00.000Z",
  "updatedAt": "2026-05-22T18:45:00.000Z",
  "onsetsMs": [1234, 2567, 3891]
}
```

Bestehende Sequence-Fixture-ZIPs werden mit `node scripts/normalize-sequence-zip-sidecars.mjs` normalisiert. Das Skript leitet `id` und `baseName` aus dem ZIP-Basisnamen ab und setzt `updatedAt` auf den Normalisierungszeitpunkt; fehlendes `recordedAt` wird ebenfalls ergänzt.

## Tests

- Unit: `tests/unit/onsetTaggerLogic.test.js`
- Unit: `tests/unit/taggedOnsetMetrics.test.js`
- Unit: `tests/unit/onsetTaggerAnalysisFlyout.test.js`
- E2E: `tests/e2e/onset-tagger.spec.js` — inklusive Listen-Auswahl, Waveform-Klick und Strategie-Import
