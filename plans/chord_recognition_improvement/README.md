# Plan: Verbesserung der Gitarren-Akkorderkennung

**Erstellt:** 2026-05-04  
**Status:** Ideen-Phase — noch nicht implementiert

---

## Kontext

Die aktuelle Akkorderkennung in `js/games/chordExerciseEssentia/` nutzt Essentia.js WASM für HPCP (Harmonic Pitch Class Profile) und vergleicht den resultierenden 12-Bin-Vektor per Cosine-Similarity gegen alle ~23 Akkord-Templates. Die Matching-Logik (`essentiaChordLogic.js`) ist durch viele hand-getunete Schwellwerte komplex und fehleranfällig geworden.

**Kernproblem:** Das ist ein *Erkennungs*-Problem (welcher Akkord?), obwohl der Use Case ein *Verifikations*-Problem ist (stimmt der gespielte Akkord mit dem vorgegebenen überein?). Diese Vereinfachung ermöglicht deutlich robustere Ansätze.

**Ziel:** Schrittweise Verbesserung in drei Phasen mit klaren Qualitätsgrenzen zwischen den Phasen.

---

## Vorbereitung: Testdaten sammeln

Vor der Implementierung der Erkennungsverbesserungen mehr WAV-Fixtures sammeln, um Qualität messbar zu machen. Aktueller Stand: 83 positive Fixtures über ~47 Akkorde, stark ungleich verteilt (E-Moll: 7, viele Akkorde: nur 1). Ziel: mindestens 3 Fixtures pro Akkord.

### Schritt V1: Coverage-Report-Skript

**Datei:** `scripts/chord-fixture-coverage.mjs`

Liest `frozen-hpcp-fixtures.json` und gibt aus, welche Akkorde unter einem Schwellwert (Standard: 3) liegen:

```
G-Moll:  1 Fixture  ⚠  aufnehmen
Fm7:     1 Fixture  ⚠  aufnehmen
...
E-Moll:  7 Fixtures ✓
```

Sofortiger Nutzen: zeigt vor jeder Aufnahmesession genau, wo Lücken sind.

### Schritt V2: In-App Recording Tool

**Detailspec:** siehe [`chord-recorder-spec.md`](chord-recorder-spec.md)

Kurzfassung:
- Akkord-Auswahl (wie Akkordübersicht), Session-Setup: Gitarrentyp
- Automatischer Durchlauf aller 18 Variationen (3 Techniken × 2 Lautstärken × 3 Strum-Modi)
- Vollautomatisch: visueller Einzähler 3–2–1, Onset-Detektion, Countdown, Stop — kein Button-Drücken
- Kein Ton (kein Metronom-Audio) — Einzähler und Metronom rein visuell
- Quality Gates: Clipping, zu leise, kein Onset, Silence-Ratio
- Schnellklassifikation [Schnarren] [Muted] immer sichtbar
- Download: WAV + Sidecar-JSON pro Aufnahme, ZIP am Ende
- Dateiname-Schema: `gdur_plektrum_laut_single_a3f2.wav`

### Schritt V3: Synthetische Akkord-WAVs

**Neues Skript:** `scripts/generate-chord-synth-fixtures.mjs`

Generiert für jeden Akkord aus `akkordData.js` eine synthetische WAV (überlagerte Sinuswellen der Akkordtöne, analog zu den bestehenden `tests/fixtures/synth/`-Einzelton-Fixtures). Kein Mikrofon nötig.

Ablage: `tests/fixtures/chords-synth/G-Dur/synth.wav` etc. (separater Ordner, nicht in `chords/`).

Nutzen: Regressionstests der HPCP-Pipeline ohne Mikrofon; prüft, ob algorithmische Änderungen die Grundfunktionalität brechen.

**Implementierungsreihenfolge Vorbereitung:** V1 → V3 → Aufnahmen mit V2 → `introduce-chord-fixture.mjs`

---

## Phase 1 – Kurzfristig: Zielorientierte Note-Verifikation

### Idee

Statt alle Akkorde zu ranken: für den **Zielakkord** prüfen, ob jede seiner Pitch-Classes ausreichend Energie im HPCP-Vektor hat. Zusätzlich prüfen, ob die charakteristische Terz (groß/klein) klar erkennbar ist und ob fremde Pitch-Classes dominieren.

### Vorteil gegenüber aktuellem Ansatz

- Am mit C-Dur verwechseln wird unmöglich: Am erwartet A, C, E; C-Dur erwartet C, E, G — der G-Check scheitert bei Am, der A-Check bei C-Dur.
- Keine konkurrierende Template-Rangliste mehr → keine Verwechslungen durch ähnliche Akkorde.
- Kein externer Download, keine neue Abhängigkeit.

### Betroffene Dateien

| Datei | Änderung |
|---|---|
| `js/games/chordExerciseEssentia/essentiaChordLogic.js` | Neue Funktion `verifyChordNotes(hpcp, targetChord, templates)` ergänzen |
| `js/games/chordExerciseEssentia/essentiaChordDetection.js` | Aufruf auf `verifyChordNotes` umstellen statt `matchHpcpToChord` |
| `tests/unit/essentiaChordLogic.test.js` | Tests für `verifyChordNotes` ergänzen |

### Neue Funktion

```js
// essentiaChordLogic.js
export function verifyChordNotes(hpcp, targetChord, options = {}) {
  // options: { minNoteEnergy, minThirdEnergy, maxLeakage }
  // Returns: { isCorrect: boolean, confidence: number, detail: object }
}
```

**Algorithmus:**
1. Chord-Töne aus Template extrahieren (Pitch-Class-Bins)
2. Für jeden Chord-Ton: `hpcp[bin] >= minNoteEnergy` prüfen
3. Terz-Bin (Moll/Dur-Unterscheidung) mit `minThirdEnergy` prüfen
4. Summe der Nicht-Chord-Bins / Summe aller Bins = Leakage; wenn > maxLeakage → reject
5. `confidence` = Mittelwert der Chord-Ton-Energien normiert auf [0,1]

### Testfälle

```
verifyChordNotes(perfectAmTemplate, 'Am',   ...) → { isCorrect: true,  confidence: ~1.0 }
verifyChordNotes(perfectAmTemplate, 'Cdur', ...) → { isCorrect: false }  // G fehlt
verifyChordNotes(zeroVector,        'Am',   ...) → { isCorrect: false }  // keine Energie
verifyChordNotes(noiseVector,       'Am',   ...) → { isCorrect: false }  // Leakage zu hoch
verifyChordNotes(cDurTemplate,      'Cdur', ...) → { isCorrect: true  }
```

### TDD-Reihenfolge

1. Tests schreiben (rot) — `verifyChordNotes` noch nicht vorhanden
2. Funktion implementieren (grün)
3. `essentiaChordDetection.js` umstellen
4. Qualitätsmessung mit bestehenden WAV-Fixtures in `essentiaChordAudio.test.js`
5. Manuelle Probe mit Mikrofon

---

## Phase 2 – Mittelfristig: CQT statt FFT für bessere Frequenzauflösung

### Idee

Der **Constant-Q Transform (CQT)** hat logarithmische Frequenzauflösung — d.h. tiefe Gitarrentöne (E2 = 82 Hz, A2 = 110 Hz) werden mit deutlich besserer Auflösung erfasst als mit linearer FFT. Bei einem 4096er FFT bei 44100 Hz beträgt die Bin-Breite ~10 Hz — zu grob für saubere Terz/Quinte-Trennung im Bassbereich.

### Optionen

**Option A: Essentia `NSGConstantQ`** — bereits in essentia.js WASM vorhanden, kein zusätzlicher Download.

**Option B: Reine JS-CQT** — ~200 Zeilen, keine externe Abhängigkeit, gut unit-testbar.

Empfehlung: Option A zuerst ausprobieren (weniger Code), Option B als Fallback.

### Betroffene Dateien

| Datei | Änderung |
|---|---|
| `js/games/chordExerciseEssentia/essentiaChordDetection.js` | CQT-Extraktion statt `SpectralPeaks → HPCP` |
| `js/games/chordExerciseEssentia/essentiaChordLogic.js` | ggf. neue Chroma-Normalisierung für CQT-Output |
| `tests/unit/essentiaChordLogic.test.js` | Tests für neue Chroma-Hilfsfunktionen |

### Entscheidungskriterium

Phase 2 nur angehen, wenn Phase 1 bei echten Gitarrenaufnahmen noch **> 15 % Fehlerrate** hat (messbar via WAV-Fixtures).

---

## Phase 3 – Langfristig: TensorFlow.js CNN auf eigenen WAV-Fixtures

### Idee

Ein kleines **Convolutional Neural Network** auf Mel-Spektrogrammen der vorhandenen Akkord-WAV-Fixtures trainieren. Da nur ~23 Akkorde erkannt werden müssen und die Fixtures als Trainingsdaten dienen, bleibt das Modell sehr klein (< 1 MB).

### Stack

| Komponente | Tool |
|---|---|
| Training | Python + Keras (einmalig, außerhalb des Repos) |
| Konvertierung | `tensorflowjs_converter` → `model.json` + Gewichte |
| Inference im Browser | `@tensorflow/tfjs` (WASM-Backend) |

### Neue Dateien (bei Implementierung)

| Datei | Zweck |
|---|---|
| `js/games/chordExerciseEssentia/tfChordModel.js` | TF.js-Modell laden + Inference |
| `js/lib/tfjs/` | TF.js WASM-Dateien (offline-fähig, in `sw.js` eintragen) |
| `models/chord_cnn/` | `model.json` + Gewichts-Chunks |
| `scripts/train_chord_cnn.py` | Trainings-Skript (nicht deployed) |

### Entscheidungskriterium

Nur angehen, wenn Phase 1 + 2 zusammen nicht auf **> 90 % Genauigkeit** kommen. Aufwand: ~2–3 Tage (Trainingsdaten sammeln, trainieren, integrieren).

---

## Implementierungsreihenfolge (gesamt)

```
Phase 1 implementieren
  └─ Fehlerrate messen (WAV-Fixtures + manuell)
      ├─ ≤ 15 % → fertig
      └─ > 15 % → Phase 2
          └─ Fehlerrate messen
              ├─ ≤ 10 % → fertig
              └─ > 10 % → Phase 3
```

---

## Was nicht unit-testbar ist (und warum)

| Komponente | Grund |
|---|---|
| Mikrofon-Pipeline (`essentiaChordDetection.js`) | Web Audio API nicht in Node.js verfügbar |
| WASM-Ladevorgang (`essentiaLoader.js`) | Browser-only |
| Proxy-Test | `tests/unit/essentiaChordAudio.test.js` mit echten WAV-Fixtures |

---

## Offene Entscheidungen (vor Phase-1-Implementierung klären)

1. **Ersetzen oder ergänzen?** Soll `verifyChordNotes` `matchHpcpToChord` vollständig ersetzen, oder zunächst als zusätzliche Validierung parallel laufen?
2. **Schwellwert-UI?** Sollen `minNoteEnergy` und `maxLeakage` als Slider in der UI exponiert werden (Debugging-Hilfe)?
