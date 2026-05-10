# Plan: Sheet-Music-Onset-Reparatur

**Erstellt:** 2026-05-10  
**Status:** Analyse- und Reparaturplan — noch nicht implementiert

---

## Ziel

Die Onset-Erkennung fuer Sheet-Music-Sequenzen soll zuerst stabilisiert werden,
bevor Pitch-/Accept-Logik weiter optimiert wird. Ziel ist, dass `sfp` klar zeigt:

- wie viele Anschlaege in einer Sequenz erkannt werden,
- an welchen Zeitpunkten sie erkannt werden,
- ob ein fehlgeschlagener Sequence-Fingerprint primaer an fehlenden Onsets oder an
  fehlenden Pitch-Accepts liegt.

---

## Aktueller Wissensstand

`npm run sfp` zeigt aktuell:

| Bereich | Stand |
|---|---:|
| Sequence-Fixtures | 8 |
| Sequence passed | 5 |
| Sequence failed | 3 |
| Accepted notes | 100/128 |
| Note recall | 78.1% |
| Detected RMS onsets | 130/128 |
| Onset count ratio | 101.6% |

### Problematische Fixtures

| Fixture | Erwartete Noten | Erkannte Onsets | Akzeptierte Noten | Befund |
|---|---:|---:|---:|---|
| `open-strings/fast.wav` | 16 | 5 | 6 | Primaer Onset-Problem: zu wenige Onsets erkannt. |
| `open-strings/aeaedgdgbebeabab.wav` | 16 | 12 | 5 | Gemischt: erst fehlende Accepts ab Note 6, spaeter fehlende Onsets ab Note 13. |
| `sheet-music-reading/4-4_40bpm_EBGDA_1jtn8.wav` | 16 | 20 | 9 | Eher Pitch-/Accept-Problem: Onsets sind vorhanden, Accepts fehlen ab Note 10. |

### Interpretation

- `fast.wav` ist der wichtigste Onset-Reparaturfall, weil nur 5 von 16
  Anschlaegen erkannt werden.
- Die aktuelle Sequence-Erkennung ist nicht hart onset-gated: `fast.wav` kann
  mehr Accepts als gezaehlte Onsets haben. Das ist als Diagnose akzeptabel,
  muss aber bei der Interpretation beachtet werden.
- Mehrere Fixtures ueberzaehlen Onsets. Die Reparatur darf also nicht nur
  empfindlicher werden; sie muss schnelle echte Reattacks besser erkennen,
  ohne Sustain/Decay-Rauschen als Extra-Onsets zu zaehlen.
- Ein absoluter `minRms` ist wahrscheinlich nur als Noise-Floor geeignet. Der
  eigentliche Onset sollte relativ zum lokalen Verlauf erkannt werden:
  Energieanstieg, Spektral-Flux, neue aktive Frequenzbaender und Reattack
  waehrend ausklingendem Sustain.

---

## Relevante Pipeline-Teile

| Modul | Rolle |
|---|---|
| `js/shared/audio/noteOnsetGate.js` | RMS-basierter Onset-Gate fuer Note-/Sequenztests. |
| `js/shared/audio/guitarOnsetDetector.js` | Spektral-/Flux-basierter Gitarren-Onset-Detector. |
| `tests/helpers/sheetMusicSequenceFingerprint.js` | `sfp`-Sequenzdiagnose, Onset-Counts und Onset/Accept-Alignment. |
| `tests/unit/noteOnsetGateAudio.test.js` | Reale Audio-Regressionsfaelle fuer Onset-Gating. |
| `tests/unit/sheetMusicSequenceFingerprint.test.js` | Golden/Regression fuer aktuell gruen erkannte Sequenzen. |

---

## Todos: Analysen

- [ ] **A1: Onset-Trace pro problematischem Fixture ausgeben**
  - Fuer `fast.wav` und `aeaedgdgbebeabab.wav` pro 50ms-Frame loggen:
    `timeMs`, `rms`, `baselineRms`, `armThreshold`, `event`, `wasAboveThreshold`,
    `cooldownFramesRemaining`.
  - Ziel: erkennen, ob der Gate wegen zu hoher Baseline, Cooldown, fehlendem
    Release oder zu niedrigem RMS-Anstieg nicht feuert.

- [ ] **A2: Vergleich RMS-Gate vs. Guitar-Onset-Detector**
  - Gleiche Fixtures mit `noteOnsetGate` und `guitarOnsetDetector` zaehlen.
  - Ziel: pruefen, ob der spektrale Detector schnelle Reattacks besser erkennt
    oder ob er die bekannten Overcount-Faelle verschlechtert.

- [ ] **A3: Reattack-Fenster analysieren**
  - Fuer aufeinanderfolgende erwartete Noten die Zeitabstaende der Soll-Sequenz
    mit den erkannten Onset-Zeitpunkten vergleichen.
  - Ziel: herausfinden, ob `cooldownFrames`, `releaseFactor` oder
    `reattackMinDelta` schnelle Sequenzen blockieren.

- [ ] **A4: Fehlende-Onset-Faelle isolieren**
  - Fuer `fast.wav` pro erwarteter Note ein lokales Zeitfenster um die
    erwartete Position analysieren.
  - Ziel: zwischen "kein physischer Anschlag im Audio", "Anschlag vorhanden,
    aber RMS-Gate sieht ihn nicht" und "Anschlag verschmilzt mit vorherigem
    Sustain" unterscheiden.

- [ ] **A5: Overcount-Faelle als Guardrails aufnehmen**
  - `medium.wav`, `slow.wav`, `sheet-music-reading/*` als Gegenbeispiele
    beobachten, weil sie aktuell eher zu viele Onsets liefern.
  - Ziel: jede Reparatur gegen Under- und Overcount gleichzeitig messen.

---

## Todos: Reparaturoptionen

- [ ] **R1: Relatives RMS-Reattack-Kriterium verbessern**
  - `minRms` nur als Noise-Floor behalten.
  - Onset/Reattack staerker ueber relativen Anstieg gegen lokale Floor-/Decay-
    Kurve entscheiden.
  - Kandidaten:
    - kuerzere lokale RMS-Historie,
    - adaptive Baseline,
    - Reattack relativ zu `aboveThresholdFloorRms`,
    - begrenzter Decay-Tracker fuer Sustain.

- [ ] **R2: Spektral-Flux als zusaetzliches Onset-Signal nutzen**
  - `guitarOnsetDetector` oder dessen Kernlogik fuer Sheet-Sequenzen evaluieren.
  - Vorteil: erkennt ploetzlich hinzukommende Frequenzanteile auch dann, wenn
    Gesamtlautstaerke nicht stark steigt.
  - Risiko: koennte bei Saitenwechseln oder Nebengeraeuschen ueberzaehlen.

- [ ] **R3: Hybrid-Onset-Detector bauen**
  - Onset, wenn mindestens eines gilt:
    - signifikanter relativer RMS-Reattack,
    - signifikanter spektraler Flux,
    - neue aktive Frequenzbaender bei ausreichendem Noise-Floor.
  - Danach Debounce/Cooldown anwenden, aber schnell genug fuer `fast.wav`.

- [ ] **R4: Cooldown dynamisch machen**
  - Cooldown nicht statisch in Frames, sondern abhaengig von Tempo/Abstand oder
    vom tatsaechlichen Signal-Release.
  - Ziel: schnelle Noten nicht blockieren, aber Sustain-Flattern nicht zaehlen.

- [ ] **R5: Onset-Gate in Sequence-Simulation optional erzwingen**
  - Fuer Diagnose separat testen: Sequence-Accepts nur direkt nach Onset
    erlauben.
  - Ziel: klaeren, wie viel der aktuellen Sequence-Erkennung ohne Onset-Gating
    durch Sustain/Pitch-Frames akzeptiert wird.
  - Nicht sofort als Produktverhalten aktivieren; zuerst als Diagnosemodus.

---

## Akzeptanzkriterien

- [ ] `fast.wav` erkennt deutlich mehr echte Onsets als aktuell 5/16, ohne dass
  die Overcount-Faelle stark schlechter werden.
- [ ] `open-strings/aeaedgdgbebeabab.wav` verbessert sich mindestens bei den
  fehlenden Onsets ab Note 13.
- [ ] Aktuell gruene Sequence-Fixtures bleiben im Sequence-Fingerprint gruen.
- [ ] `sfp` zeigt weiterhin pro Fixture:
  - erkannte Onsets,
  - Onset-Zeitpunkte,
  - Onset/Accept-Alignment,
  - konkrete Issues.
- [ ] Es gibt mindestens einen gezielten Regressionstest fuer `fast.wav` oder
  einen isolierten Onset-Count-Test mit realer Fixture.

---

## Vorgeschlagene Reihenfolge

1. A1 und A2 implementieren: Trace/Comparator ohne Verhaltensaenderung.
2. A3/A4 auswerten: konkrete Ursache fuer `fast.wav` festhalten.
3. R1 oder R2 als kleinste Reparatur testen.
4. Guardrails aus A5 laufen lassen.
5. Erst danach Hybrid/Dynamic-Cooldown angehen, falls einfache Reparatur nicht reicht.

---

## Offene Fragen

- Soll der Produktpfad fuer Sheet-Music-Reading spaeter wirklich onset-gated
  werden, oder bleibt Onset vorerst nur Diagnose?
- Welches Ziel ist wichtiger: `fast.wav` moeglichst voll erkennen oder Overcount
  bei langsameren Fixtures minimieren?
- Sollen Import-Sanity-Checks fuer WAVs separat in den Fixture-Import wandern,
  inklusive Clipping, Dauer, Sample-Rate und Fuehrungs-/Endstille?
