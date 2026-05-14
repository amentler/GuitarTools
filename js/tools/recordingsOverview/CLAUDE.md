# recordingsOverview — Aufnahmen-Übersicht

Zeigt alle gespeicherten Aufnahmen aus beiden IndexedDB-Quellen in einer Liste an.
Der Nutzer wählt eine Aufnahme aus und öffnet sie direkt in der Audio-Analyse oder im Onset Tagger.

## Dateien

| Datei | Zweck |
|---|---|
| `recordingsOverview.js` | UI-Feature (`createRecordingsOverviewFeature`): Liste rendern, Auswahl, Navigation |
| `recordingsOverviewStorage.js` | IndexedDB-Lesezugriffe auf `gt-audio-analyse-db` und `chord-recorder` |
| `recordingsOverviewLogic.js` | Pure Hilfsfunktionen: Dateigröße, Datum, Anzeigename, URL-Builder, Sortierung |

## Quellen

| Quelle | DB | Store | Key |
|---|---|---|---|
| Noten lesen | `gt-audio-analyse-db` | `recordings` | eindeutige Take-ID/BaseName; Legacy-`'last'` lesbar |
| Akkord-Recorder | `chord-recorder` | `recordings` | `baseName` (mehrere Einträge) |

## Navigation

- Button „Audio-Analyse öffnen" → `../audio-analyse/index.html?source=<source>&id=<id>`
- Button „Onset Tagger öffnen" → `../onset-tagger/index.html?source=<source>&id=<id>`

Sowohl `audioAnalyse.js` als auch `onsetTagger.js` lesen diese URL-Parameter beim Mount
und laden die Aufnahme automatisch über `js/shared/recordingLoader.js`.

## Seite

- `pages/recordings/index.html`
- `pages/recordings/bootstrap.js`
- Root-Element: `#view-recordings`

## Tests

- Unit: `tests/unit/recordingsOverviewLogic.test.js` — 21 Tests
