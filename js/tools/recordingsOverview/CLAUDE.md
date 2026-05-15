# recordingsOverview — Aufnahmen-Übersicht

Zeigt alle gespeicherten Aufnahmen aus beiden IndexedDB-Quellen in einer Mehrfachauswahl-Liste an.
Der Nutzer kann einzelne oder mehrere Aufnahmen per Checkbox auswählen, als ZIP herunterladen oder löschen.
Bulk-Aktionen erlauben Download und Löschen nach Quelle (Noten lesen / Akkord-Recorder).

## Dateien

| Datei | Zweck |
|---|---|
| `recordingsOverview.js` | UI-Feature (`createRecordingsOverviewFeature`): Multi-Select, ZIP-Download, Bulk-Löschen, Navigation |
| `recordingsOverviewStorage.js` | IndexedDB-Zugriffe: Metadaten, Bulk-Löschen, WAV-Daten für ZIP-Export |
| `recordingsOverviewLogic.js` | Pure Hilfsfunktionen: Dateigröße, Datum, Anzeigename, URL-Builder, Sortierung, `buildZipEntryName` |

## Quellen

| Quelle | DB | Store | Key |
|---|---|---|---|
| Noten lesen | `gt-audio-analyse-db` | `recordings` | eindeutige Take-ID/BaseName; Legacy-`'last'` lesbar |
| Akkord-Recorder | `chord-recorder` | `recordings` | `baseName` (mehrere Einträge) |

## Navigation

- Button „Analyse öffnen" → `../audio-analyse/index.html?source=<source>&id=<id>` (nur bei genau 1 Auswahl)
- Button „Onset Tagger öffnen" → `../onset-tagger/index.html?source=<source>&id=<id>` (nur bei genau 1 Auswahl)

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

## Seite

- `pages/recordings/index.html`
- `pages/recordings/bootstrap.js`
- Root-Element: `#view-recordings`

## Tests

- Unit: `tests/unit/recordingsOverviewLogic.test.js` — 28 Tests (inkl. `buildZipEntryName`)
- E2E: `tests/e2e/recordings-overview.spec.js` — 5 Playwright-Tests (Seite, Seeding, Checkbox, ZIP-Download)
