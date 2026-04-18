# akkordfolgenTrainer – Akkordfolgen-Trainer

Übt Akkordfolgen in allen 12 Dur-Tonarten mit Mikrofon-Erkennung und Metronom.

## Dateien

| Datei | Zweck |
|-------|-------|
| `akkordfolgenLogic.js` | Reine Logik – Tonarten, Akkordfolgen, Zufallsgenerator (kein DOM/Audio) |
| `akkordfolgenTrainer.js` | Haupt-Controller – Audio-Pipeline, Metronom, State, DOM |
| `CLAUDE.md` | Diese Datei |

## Architektur

```
akkordfolgenTrainer.js
  ├── MetronomeLogic (tools/metronome/)  ← Takt-Erzeugung (Web Audio API)
  ├── CHORDS (data/akkordData.js)        ← Akkord-Diagramme (sofern vorhanden)
  ├── renderChordDiagram (akkordSVG.js)  ← SVG-Darstellung des aktuellen Akkords
  ├── analyzeInputLevel (pitchLogic.js)  ← RMS-Strum-Erkennung
  └── akkordfolgenLogic.js               ← Tonart-/Folgen-Daten
```

## Spielablauf

1. **Setup**: Tonart wählen, Akkordfolge wählen (oder Zufallsfolge), BPM einstellen, Schläge/Akkord einstellen
2. **Aktiv**: Alle Akkorde der Folge als Karten nebeneinander; aktueller hervorgehoben
3. **Mikrofon-Erkennung**: Strum-Detektion via RMS-Schwelle (keine exakte Akkord-Klassifikation)
4. **Wechsel**: Bei erkanntem Strum → Akkord grün, nach 800 ms nächster Akkord
5. **Timeout**: Kein Strum innerhalb von `beatsPerChord` Schlägen → Auto-Wechsel, Fehler++
6. **Zusammenfassung**: Zeit, gespielte Akkorde, verpasste Akkorde, Runden

## Akkord-Erkennung

Nach jedem RMS-Strum-Spike analysiert der Trainer das Frequenzspektrum und prüft,
ob der gespielte Akkord dem erwarteten entspricht.

### Pipeline

```
RMS-Spike (> 2.5 × GUITAR_MIN_RMS)
  → 150 ms Settle (Anschlag-Transient abklingen lassen)
  → 5 × FFT-Frame (je 50 ms): Frequenzspitzen → Notenklassen
  → matchDetectedNotes(erkannte Noten, Zielakkord)
    → confidence ≥ 0.6 → "✓ Gespielt!", 1500 ms Cooldown
    → confidence < 0.6 → "Falscher Akkord", 700 ms Cooldown (nochmal versuchen)
```

### Modularer Aufbau

| Modul | Aufgabe |
|-------|---------|
| `akkordfolgenChordMatcher.js` | **Reine Logik** – Akkordname parsen, Notenklassen berechnen, Matching |
| `chordDetection.js` (chordExercise) | `detectPeaksFromSpectrum` – FFT-Peaks finden |
| `chordDetectionLogic.js` (chordExercise) | `identifyNotesFromPeaks` – Hz → Notenname |

### Akkordname-Parsing (`akkordfolgenChordMatcher.js`)

Alle diatonischen Akkordnamen aus `akkordfolgenLogic.js` werden direkt aus der
Musiktheorie abgeleitet (ohne Akkord-Datenbank-Einträge):

- **C-Dur** → C, E, G (Dur-Dreiklang: [0, 4, 7])
- **A-Moll** → A, C, E (Moll-Dreiklang: [0, 3, 7])
- **H-dim** → H(=B), D, F (vermindert: [0, 3, 6])
- **G7** → G, B, D, F (Dominantseptakkord: [0, 4, 7, 10])

Deutsche Tonnamen werden auf englische Sharp-Notation gemappt (H→B, B→A#, Fis→F# usw.)

### Cancellation

`analysisToken` wird inkrementiert wenn:
- Ein neuer Strum erkannt wird (neuere Analyse übernimmt)
- Der Akkord durch das Metronom wechselt (`advanceChord()`)
- Das Übung gestoppt wird (`cleanup()`)

Jede async Analyse prüft `token !== analysisToken` nach jedem `await`.

## Chord-Diagramme

Werden nur angezeigt, wenn der Akkordname exakt in `CHORDS` (akkordData.js) vorkommt.
Für Akkorde ohne Eintrag (z.B. Fis-Moll, H-Moll) wird nur der Name angezeigt.

## Akkordfolgen-Daten

In `akkordfolgenLogic.js`:
- `MAJOR_KEYS`: 12 Dur-Tonarten (Quintenzirkel-Reihenfolge, C bis Des)
- `PROGRESSIONS`: 7 klassische Folgen + 12-Bar Blues (mit Dominant-7-Akkorden)
- `buildProgression(keyId, progressionIndex)` → Akkord-Array
- `generateRandomProgression(keyId)` → Zufällige 4-Akkord-Folge (I + 3 aus ii/IV/V/vi)

## Navigation

- View ID: `#view-akkordfolgen-trainer`
- App key: `akkordfolgenTrainer`
- Menu button: `#btn-start-akkordfolgen-trainer`
- Back button: `#btn-back-akkordfolgen-trainer`
