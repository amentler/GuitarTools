# Tuning Analysis - E4 Sensitivity & Precision

## Problembeschreibung
Die hohe E-Saite (E4, ~329,63 Hz) wird vom Stimmgerät oft unpräzise oder gar nicht erkannt. Der Zeiger "springt" beim Anschlag und der Ton wird sehr schnell ignoriert, obwohl er akustisch noch klingt.

## Analyseergebnisse
Die Untersuchung mittels `tests/unit/e4_sensitivity.test.js` und Code-Review ergab drei Hauptursachen:

### 1. Zu aggressives Noise Gate (RMS Threshold)
*   **Mechanismus:** `buildAdaptiveThreshold` berechnet die Schwelle als das 4-fache (`NOISE_FLOOR_SCALE_FACTOR`) des gemessenen Grundrauschens.
*   **Problem:** Bei leisem Hintergrundrauschen (z. B. Computerlüfter) steigt die Schwelle so hoch, dass das schnell ausklingende E4-Signal bereits nach wenigen hundert Millisekunden unter die Wahrnehmungsschwelle fällt.
*   **Beobachtung:** Ein simuliertes E4 mit moderatem Rauschuntergrund wurde nach nur 250 ms (5 Frames) nicht mehr erkannt.

### 2. Zu tiefer Hardware-Tiefpassfilter
*   **Mechanismus:** In `guitarTuner.js` ist ein `BiquadFilter` mit `type: 'lowpass'` und `frequency: 500` geschaltet.
*   **Problem:** Ein 500-Hz-Filter hat eine Flanke, die bereits bei 330 Hz (E4) eine leichte Dämpfung verursacht. Dies verringert den RMS-Wert des Nutzsignals zusätzlich und verstärkt das Problem des Noise Gates.

### 3. Attack-Dämpfung und Warm-up
*   **Mechanismus:** `dampAttack` dämpft die ersten 20 % jedes Puffers. Zudem wartet der Tuner 3 stabile Frames (`STABLE_CONFIRM_FRAMES`) ab.
*   **Problem:** Die Kombination führt dazu, dass der erste stabile Messwert erst spät erscheint. Wenn der Anschlag unharmonisch ist, "springt" der Zeiger zu Beginn, bis der Median-Filter greift.

## Optimierungsplan (Testgetrieben)

### Phase 1: Filter & Gate (Empfindlichkeit)
*   **Ziel:** E4-Signal länger halten und Grundwelle weniger dämpfen.
*   **Maßnahme A:** Hardware-Tiefpass in `guitarTuner.js` von 500 Hz auf **1000 Hz** anheben.
*   **Maßnahme B:** `NOISE_FLOOR_SCALE_FACTOR` in `tunerLogic.js` von 4 auf **2.5** senken.
*   **Validierung:** `e4_sensitivity.test.js` muss zeigen, dass das Signal bei gleichem Rauschpegel länger (mehr Frames) "Valid" bleibt.

### Phase 2: Attack & Stabilität (Ansprechverhalten)
*   **Ziel:** Schnellerer "Lock" auf den richtigen Ton ohne Springen.
*   **Maßnahme C:** `ATTACK_DAMPING_RATIO` von 0.2 auf **0.1** (10 %) reduzieren.
*   **Maßnahme D:** Prüfen, ob `STABLE_CONFIRM_FRAMES` auf 2 reduziert werden kann, ohne dass Störgeräusche durchkommen.
*   **Validierung:** Manueller Test und bestehende Regressionstests.

## Status
*   [x] Analyse abgeschlossen
*   [x] Testfall zur Reproduktion erstellt
*   [x] Implementierung Phase 1
*   [x] Implementierung Phase 2
