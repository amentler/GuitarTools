# chordExercise – Akkord-Übung mit Mikrofon-Erkennung

Zeigt einen zufälligen Akkord an (z. B. "C-Dur"), der Nutzer spielt ihn auf der Gitarre, und das Tool erkennt per Mikrofon, ob der Akkord korrekt geklungen hat.

## Status

| Phase | Status |
|-------|--------|
| Phase 1: Logic (chordDetectionLogic.js) | ✅ Implementiert |
| Phase 2: Audio Pipeline (chordDetection.js) | ✅ Implementiert |
| Phase 3: Exercise Flow & UI (chordExercise.js) | ✅ Implementiert |
| Phase 4: Unit Tests (chordDetection.test.js) | ✅ Implementiert |

Detailplan: `plans/backlog.md` → "Active Plan: Chord Exercise with Audio Recognition"

---

## Dateien

### `chordDetectionLogic.js` – Reine Logik (kein DOM, kein Audio)

**Exports:**

- `getChordNotes(chordName)` → `Array<{ note, octave, string, fret }>`
  - Gibt alle klingenden Töne des Akkords zurück (inklusive Leersaiten, ohne gedämpfte Saiten).
  - Akkord-Daten kommen aus `js/data/akkordData.js`.
  - String-Mapping: 1 = hohe e-Saite (E4), 6 = tiefe E-Saite (E2).
  - Bundberechnung via MIDI: Leersaite + Bund = MIDI-Nummer → `{ note, octave }`.

- `identifyNotesFromPeaks(freqPeaks)` → `Array<{ note, octave, cents, frequency }>`
  - Wandelt FFT-Frequenzspitzen (Hz) in Noten-Objekte um.
  - Nutzt `frequencyToNote` aus `pitchLogic.js`.
  - Filtert 0 und negative Frequenzen heraus.

- `matchChordToTarget(detectedNotes, targetChordName)` → `{ isCorrect, missingNotes, extraNotes, confidence }`
  - **Note-Class-Matching** (Q1 Option A aus dem Backlog): Vergleicht nur Tonnamen (C, E, G), ignoriert Oktave.
  - `isCorrect = true` wenn alle erwarteten Tonnamen erkannt wurden (Extra-Töne sind erlaubt).
  - `confidence` = Anteil erkannter Tonnamen (0–1).
  - `missingNotes` = erwartete Tonnamen, die nicht erkannt wurden.
  - `extraNotes` = erkannte Tonnamen, die nicht im Akkord vorkommen.

---

## Architektur

```
chordDetectionLogic.js
  ├── CHORDS (akkordData.js)      ← Akkord-Definitionen
  ├── frequencyToNote (pitchLogic.js) ← Hz → Note/Oktave
  └── NOTE_NAMES (pitchLogic.js)  ← Chromatische Tonnamen
```

### OPEN_STRING_MIDI

Die Leersaiten-MIDI-Nummern (String 1–6):

| String | Note | MIDI |
|--------|------|------|
| 1 (high e) | E4 | 64 |
| 2 | B3 | 59 |
| 3 | G3 | 55 |
| 4 | D3 | 50 |
| 5 | A2 | 45 |
| 6 (low E) | E2 | 40 |

Jeder Bund addiert einen Halbton: `midi = openStringMidi + fret`.

---

## Tests

`tests/unit/chordDetectionLogic.test.js` — 28 Tests:
- `getChordNotes`: Tonanzahl, Tonnamen, Oktaven, gedämpfte Saiten, alle 8 Standard-Akkorde
- `identifyNotesFromPeaks`: Konvertierung, Filterung, Frequenz-Erhalt
- `matchChordToTarget`: korrekter Akkord, fehlende Töne, Extra-Töne, Oktav-Unabhängigkeit, falscher Akkord, Konfidenz-Berechnung

---

## Design-Entscheidungen

### Note-Class-Matching (Q1 Option A)
Nur die Tonnamen (C, E, G) werden verglichen, nicht die genaue Oktave/Voicing. Dies macht die Erkennung robuster gegen verschiedene Griffpositionen und Lagen.

**Zukünftige Erweiterung (Q1 Option C):** Exaktes Matching kann als "Schwer"-Modus hinzugefügt werden, wenn `matchChordToTarget` den Parameter `{ exactVoicing: true }` erhält.

### Kein toleranceCents-Parameter
Das aktuelle Note-Class-Matching operiert auf Note-Namen, nicht auf Frequenzen direkt. Die `±35 Cent`-Toleranz ist in `frequencyToNote` (pitchLogic.js) eingebaut. Ein expliziter `toleranceCents`-Parameter ist für Phase 2 (exaktes Frequency-Matching) vorgesehen.

---

## AI Collaboration & Documentation

**IMPORTANT FOR ALL AGENTS (Claude, Gemini, Codex):**
- **Update .md files:** Nach jeder Implementierung MÜSSEN alle relevanten `.md`-Dateien aktualisiert werden.
- **Keep Plans Current:** `plans/backlog.md` aktuell halten.
- **Architecture:** Vanilla JS, keine Frameworks.
