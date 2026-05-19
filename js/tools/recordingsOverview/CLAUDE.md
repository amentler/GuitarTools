# recordingsOverview — Aufnahmen-Übersicht

Zeigt alle gespeicherten Aufnahmen aus beiden IndexedDB-Quellen in einer Mehrfachauswahl-Liste an.
Der Nutzer kann einzelne oder mehrere Aufnahmen per Checkbox auswählen, als ZIP herunterladen oder löschen.
Bulk-Aktionen erlauben Download und Löschen nach Quelle (Noten lesen / Akkord-Recorder).
Der sichtbare Primaername ist der gespeicherte `baseName`/Dateiname; fachliche
Metadaten bleiben Zusatzinformationen.
Am Seitenende zeigt die Trainingsdaten-Review einen statisch erzeugten Android-Firefox-Katalog
mit WAV- und ZIP(WAV+JSON)-Fixtures, Match-Status und Confusion-Matrix-Kennzahlen.

## Dateien

| Datei | Zweck |
|---|---|
| `recordingsOverview.js` | UI-Feature (`createRecordingsOverviewFeature`): Multi-Select, ZIP-Download, Bulk-Löschen, Navigation |
| `recordingsOverviewStorage.js` | IndexedDB-Zugriffe: Metadaten, Bulk-Löschen, WAV-Daten für ZIP-Export |
| `recordingsOverviewLogic.js` | Pure Hilfsfunktionen: Dateigröße, Datum, Anzeigename, URL-Builder, Sortierung, Trainingsdaten-Sortierung, `buildZipEntryName` |

## Quellen

| Quelle | DB | Store | Key |
|---|---|---|---|
| Noten lesen | `gt-audio-analyse-db` | `recordings` | eindeutige Take-ID/BaseName; Legacy-`'last'` lesbar |
| Akkord-Recorder | `chord-recorder` | `recordings` | `baseName` (mehrere Einträge) |
| Trainingsdaten-Review | statischer JSON-Katalog | `js/data/android-firefox-training-review-catalog.json` | Katalog-`id` |

## Navigation

- Button „Analyse öffnen" → `../audio-analyse/index.html?source=<source>&id=<id>` (nur bei genau 1 Auswahl)
- Button „Onset Tagger öffnen" → `../onset-tagger/index.html?source=<source>&id=<id>` (nur bei genau 1 Auswahl)
- Trainingsdaten-Review „Tagger" → `../onset-tagger/index.html?source=training-data&id=<catalog-id>` für WAV/ZIP-Einträge; ZIPs werden im Tagger gelesen und abgespielt

## Aktionen

### Auswahl-Aktionen (sichtbar wenn ≥1 Checkbox aktiv)
- 📊 Analyse öffnen / 🏷️ Onset Tagger öffnen (nur bei genau 1 Auswahl aktiviert)
- 📥 Als ZIP herunterladen
- 🗑 Auswahl löschen

### Bulk-Aktionen (sichtbar wenn Aufnahmen vorhanden)
- 📥 Alle als ZIP / Noten-lesen als ZIP / Akkord als ZIP
- 🗑 Alle löschen / Alle Noten-lesen löschen / Alle Akkord löschen

## ZIP-Infrastruktur

Verwendet `js/shared/zip.js` (`buildRecordingZip`, `buildCollectionZip`, `downloadBlob`) — das zentrale ZIP-Modul für alle Tools.

- Einzelne Aufnahme → `baseName.zip` mit `baseName.wav` + `baseName.json` direkt darin
- Mehrere Aufnahmen → Container-ZIP mit je einem Inner-ZIP pro Aufnahme

## Trainingsdaten-Review

Der Katalog wird mit `npm run review:android-firefox` aus `ml/data/android_firefox/`,
`tests/fixtures/sequences/` und `tests/fixtures/dropsequence/` erzeugt. Die Tabelle ist nach
Name, Typ, Match-Status sowie TP/FP/FN/Precision/Recall sortierbar. Server-Fixtures sind im
Onset Tagger read-only; Speichern legt eine lokale Sheet-Music-Aufnahme an.

## Seite

- `pages/recordings/index.html`
- `pages/recordings/bootstrap.js`
- Root-Element: `#view-recordings`

## Tests

- Unit: `tests/unit/recordingsOverviewLogic.test.js` — inkl. Dateiname/BaseName und `buildZipEntryName`
- Unit: `tests/unit/trainingDataReviewCatalog.test.js` — Katalog-Normalisierung und ZIP-Laden für `training-data`
- E2E: `tests/e2e/recordings-overview.spec.js` — 5 Playwright-Tests (Seite, Seeding, Checkbox, ZIP-Download)
