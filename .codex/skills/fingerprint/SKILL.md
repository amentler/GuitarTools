---
name: fingerprint
description: Führt den Chord-Recognition-Fingerprint des Repos aus, indem der Statistik-Test für die Akkorderkennung samt TP/TN/FP/FN, Sensitivität, Spezifität, Precision, Accuracy, F1 und Falllisten gestartet wird. Verwenden, wenn der aktuelle Erkennungsstand kompakt und reproduzierbar gemessen werden soll.
---

# Fingerprint

## Zweck

Den aktuellen Stand der Chord-Erkennung reproduzierbar messen und ausgeben.

Der Fingerprint basiert auf den Frozen-HPCP-Fixtures und liefert:

- TP, FP, FN, TN
- Sensitivität
- Spezifität
- Precision
- Negative Predictive Value
- Accuracy
- False Positive Rate
- False Negative Rate
- F1
- Listen der False Positives, False Negatives, True Positives und True Negatives

## Workflow

1. Fingerprint-Skript ausführen:

```bash
node scripts/chord-recognition-fingerprint.mjs
```

2. Optional zusätzlich den zugehörigen Test laufen lassen:

```bash
npx vitest run tests/unit/essentiaChordConfusionMetrics.test.js
```

## Regeln

- Für den Fingerprint keine zweite, abweichende Statistiklogik bauen.
- Immer dieselbe Auswertung aus `tests/helpers/chordRecognitionMetrics.js` verwenden.
- Zahlen nur aus dem aktuellen Repo-Stand ableiten, nicht aus alten Notizen übernehmen.
