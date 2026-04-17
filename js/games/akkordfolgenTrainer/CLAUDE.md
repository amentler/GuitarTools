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

## Strum-Erkennung

Verwendet RMS-Schwelle statt exakter Frequenzanalyse, da die meisten diatonischen Akkorde
nicht in `akkordData.js` vorhanden sind. Die Logik:

```
if (rms > GUITAR_MIN_RMS × 2.5) → Strum erkannt
Cooldown: 1500 ms nach jedem erkannten Strum
```

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
