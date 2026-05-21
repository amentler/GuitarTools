---
description: Führt npm run sfp (Sheet-Music/Note-Fingerprint) aus und zeigt die Ergebnisse. Verwenden wenn der Nutzer "sfp", "fingerprint" oder "sheet fingerprint" schreibt, oder den aktuellen Erkennungsstand für Sheet-Music/Note-Onset messen will.
---

# SFP – Sheet-Music & Note Fingerprint

Misst den aktuellen Stand der **Sheet-Music-Onset-Erkennung** und der **Note-Fingerprint-Regression** reproduzierbar.

## Workflow

### 1. Sheet-Music + Note Fingerprint ausführen

```bash
npm run sfp
```

`sfp` führt `scripts/sheet-and-note-fingerprint.mjs` aus und liefert:
- Onset-Precision / Recall / F1 pro Aufnahme
- Aggregierte Metriken über alle Fixtures
- Vergleich gegen gespeicherte Golden-Werte (Regression-Check)

### 2. Optional: Nur Sheet-Music-Sequenz-Fingerprint

```bash
npm run sheetfingerprint
```

### 3. Optional: Note-Fingerprint isoliert

```bash
npm run notefingerprint
```

### 4. Goldens aktualisieren (nur wenn neue Fixtures hinzugefügt wurden)

```bash
npm run notefingerprint:goldens
```

> **Achtung:** Goldens nur aktualisieren, wenn die neuen Werte intentional besser/gleich sind.
> Nach der Aktualisierung immer `npm run test:precommit` laufen lassen.

## Ausgabe interpretieren

| Kennzahl | Zielwert | Beschreibung |
|----------|----------|--------------|
| Precision | ≥ 0.80 | Anteil korrekt erkannter Onsets |
| Recall | ≥ 0.92 | Anteil gefundener Onsets |
| F1 | ≥ 0.85 | Harmonisches Mittel |

Wenn Werte unter Ziel fallen → `plans/ideen.md` oder neues Plan-File anlegen.

## Repo-Besonderheiten

- Fixture-Verzeichnis: `tests/fixtures/sequences/sheet-music-reading/`
- Aktives Onset-Modell: `models/onset_detector_android_firefox.onnx`
- Strategie-Registry: `models/strategies/registry.json`
