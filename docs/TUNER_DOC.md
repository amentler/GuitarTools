# Gitarrentuner – Technische Dokumentation

Diese Dokumentation beschreibt die Architektur, die Algorithmen und die Stabilisierungsmechanismen des Gitarrentuners in GuitarTools.

## 1. Architektur-Übersicht

Der Tuner folgt einer strikten Schichtentrennung:

- **Logic Layer (`tunerLogic.js`)**: Reine Funktionen für Pitch-Detection (YIN, HPS), Frequenz-zu-Note-Konvertierung und Stabilisierungs-Mathematik.
- **Controller Layer (`guitarTuner.js`)**: Orchestrierung von Audio-Hardware (Web Audio API), State-Management und Analyse-Loop.
- **UI Layer (`tunerSVG.js`)**: Responsive SVG-Messuhr mit Nadel-Animation.

## 2. Signal-Verarbeitungskette

Bevor eine Frequenz erkannt wird, durchläuft das Signal mehrere Stufen:

1.  **Hardware-Filter (BiquadFilter):**
    - Highpass (60 Hz): Entfernt Infraschall-Rumpeln.
    - Lowpass (500 Hz): Entfernt Obertöne und Rauschen oberhalb des Gitarrenbereichs.
2.  **Adaptive FFT-Größe:**
    - Tiefe Töne (E2): 32768 Samples für hohe Frequenzauflösung.
    - Hohe Töne (E4): 8192 Samples für geringe Latenz.
3.  **Software-Preprocessing:**
    - **Bandpass-Filter:** Zusätzliche digitale Filterung auf dem Buffer.
    - **Attack-Dämpfung (`dampAttack`):** Reduziert die Amplitude des ersten Transienten (Anschlag), um Oberton-Sprünge zu vermeiden.

## 3. Pitch-Detection-Algorithmen

Der Tuner nutzt eine hybride Erkennung für maximale Robustheit:

### YIN-Algorithmus
- Arbeitet im Zeitbereich basierend auf der *Cumulative Mean Normalized Difference Function* (CMND).
- **Sub-Sample-Interpolation:** Nutzt parabolische Interpolation (5-Punkt-Methode), um die Frequenz präziser zu bestimmen, als es die Sample-Rate allein erlauben würde.
- **Subharmonik-Check:** Verhindert das "Einrasten" auf eine Oktave tiefer.

### HPS (Harmonic Product Spectrum)
- Arbeitet im Frequenzbereich (FFT).
- Multipliziert das Spektrum mit seinen gestauchten Versionen, um den Grundton zu isolieren.
- Dient als Validierung für YIN, um Oktavfehler bei obertonreichen Signalen zu korrigieren.

## 4. Stabilisierung & Fehlerkorrektur

Um das "Zappeln" der Nadel zu verhindern, werden mehrere Filter kombiniert:

### Warm-up Phase (`STABLE_CONFIRM_FRAMES`)
- Die Anzeige wird erst aktiviert, wenn 3 aufeinanderfolgende Frames einen gültigen Pitch liefern. Dies überspringt den chaotischen Moment direkt beim Saitenanschlag.

### Zeitbasierte Historie & Median (Temporal Aging)
- Ein gleitender Median über 5 Werte glättet Ausreißer.
- **Temporal Aging:** Werte, die älter als 1000ms sind, werden verworfen.
- **Silence Reset:** Bei mehr als 300ms Stille wird der gesamte Puffer geleert, damit ein Saitenwechsel sofort erkannt wird und keine "alten" Werte die neue Messung verfälschen.

### EMA-Glättung (Exponential Moving Average)
- Die Cents-Abweichung für die Nadel wird mit einem Faktor von 0.4 geglättet (`smoothCents`), was zu einer trägen, aber präzisen Nadelbewegung wie bei analogen Geräten führt.

### Outlier Rejection
- Frequenzsprünge von mehr als 350 Cents (ca. 3,5 Halbtöne) innerhalb eines Frames werden als Fehler ignoriert, es sei denn, sie bleiben über mehrere Frames stabil (Saitenwechsel).

## 5. Guided Tuning Mode

Der geführte Modus bietet aktives Feedback:
- **Trend-Analyse:** Erkennt, ob sich der Nutzer dem Ziel nähert oder sich entfernt (`approaching` vs. `moving-away`).
- **3-Sekunden-Regel:** Feedback-Hinweise (Pfeile) bleiben für mindestens 3 Sekunden sichtbar, um visuelle Unruhe bei kurzen Signalaussetzern zu vermeiden.
- **Präzisions-Fenster:** "In Tune" wird bei ±5 Cents erreicht.

## 6. Adaptive Noise Gate

In den ersten 500ms nach dem Start kalibriert der Tuner das Hintergrundrauschen und setzt eine dynamische RMS-Schwelle (`adaptiveMinRms`), um eine Erkennung bei absoluter Stille zu verhindern.
