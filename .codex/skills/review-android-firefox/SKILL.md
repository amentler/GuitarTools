---
name: review-android-firefox
description: >
  Reviewt den Android-Firefox-XGBoost-Onset-Detektor: Metriken, Modell-Kandidaten,
  Trainings-Katalog. Verwenden wenn der Nutzer "review android" oder
  "android firefox review" schreibt, oder nach einem Training den Kandidaten
  beurteilen will.
---

# Review Android-Firefox Onset Detector

Bewertet den aktuellen oder einen neuen XGBoost-Onset-Kandidaten für die
Android-Firefox-Strategie.

## Workflow

### 1. Trainings-Review-Katalog erzeugen

```bash
npm run review:android-firefox
```

Erzeugt `js/data/android-firefox-training-review-catalog.json` aus den
getaggten ZIP/WAV-Fixtures und den aktuellen Metriken.

### 2. Aktuellen Kandidaten prüfen

```bash
cat models/onset_detector_android_firefox.metrics.json
```

Zielwerte:
- Recall ≥ 0.92
- Precision ≥ 0.45
- F1(β=3) so hoch wie möglich

### 3. Kandidaten übernehmen (nach Training)

```bash
./apply_android_firefox_onset_detector.sh
```

Aktualisiert:
- `models/onset_detector_android_firefox.{onnx,schema.json,metrics.json}`
- `js/data/android-firefox-training-review-catalog.json`

### 4. Nach Übernahme validieren

```bash
npm run sfp
npm run test:precommit
```

## Wichtige Dateien

| Datei | Beschreibung |
|-------|-------------|
| `models/onset_detector_android_firefox.onnx` | Aktives Modell |
| `models/onset_detector_android_firefox.metrics.json` | Aktuelle Metriken |
| `models/onset_detector_android_firefox.schema.json` | Feature-Schema |
| `models/onset_detector_android_firefox_candidate.*` | Kandidat (nach Training) |
| `js/data/android-firefox-training-review-catalog.json` | Review-Katalog |
| `ml/training_config.yaml` | Haupt-Trainingsconfig |

## Trainingsdaten

Training neu starten (erzeugt Kandidat):
```bash
./train_android_firefox.sh
```

Trainingsdaten kommen aus `tests/fixtures/sequences/sheet-music-reading/` (getaggte ZIPs).
Temporäre JSONs werden nach `/tmp/` geschrieben – keine dauerhaften JSON-Dateien im Repo.
