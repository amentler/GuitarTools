---
name: sfp
description: >
  Führt den Sheet-Music + Note Fingerprint (npm run sfp) aus und zeigt
  Onset-Precision/Recall/F1 gegen die Golden-Werte. Verwenden wenn der
  Nutzer "sfp", "sheet fingerprint" oder den Erkennungsstand messen will.
---

# SFP – Sheet-Music & Note Fingerprint

Misst den aktuellen Onset-Erkennungsstand reproduzierbar.

## Workflow

### 1. Haupt-Fingerprint

```bash
npm run sfp
```

Liefert Precision, Recall, F1 pro Aufnahme + Aggregat-Metriken.

### 2. Nur Sheet-Music-Sequenz

```bash
npm run sheetfingerprint
```

### 3. Nur Note-Fingerprint

```bash
npm run notefingerprint
```

### 4. Goldens aktualisieren (nur bei neuen Fixtures)

```bash
npm run notefingerprint:goldens
```

> **Achtung:** Danach `npm run test:precommit` ausführen.

## Zielwerte

| Kennzahl | Ziel |
|----------|------|
| Precision | ≥ 0.80 |
| Recall | ≥ 0.92 |
| F1 | ≥ 0.85 |

## Pfade

- Fixtures: `tests/fixtures/sequences/sheet-music-reading/`
- Modell: `models/onset_detector_android_firefox.onnx`
- Registry: `models/strategies/registry.json`
