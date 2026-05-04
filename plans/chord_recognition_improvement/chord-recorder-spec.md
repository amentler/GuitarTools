# Chord Recorder Tool — Detailspec

**Status:** Spec abgeschlossen, bereit zur Implementierung  
**Zweck:** Datensammlung für ML-Training der Akkorderkennung — kein Lern-Tool

---

## Einordnung

Neues Tool, eigene Seite `pages/tools/chord-recorder.html`.  
Keine Akkord-Erkennungslogik — nur Aufnahme, Qualitätsprüfung, Download.

---

## Seitenaufbau (Entry Screen)

Die Seite hat drei Bereiche von oben nach unten — alles auf einer Seite, kein Modal, kein Wizard.  
Sobald ein Akkord ausgewählt ist, erscheint ein **„Aufnahme starten"**-Button.

```
┌─────────────────────────────────────────────────┐
│  ① INSTRUMENT                                   │
│  Gitarrentyp: [Akustik Steel        ▾]          │
└─────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────┐
│  ② VARIANTEN                                    │
│  Techniken:   ☑ Finger  ☑ Fingernagel  ☐ Plektrum │
│  Strum-Modi:  ☑ Single  ☐ Multi 1 Takt  ☐ Multi 2 Takte │
│                                                 │
│  → 8 Aufnahmen geplant                         │
└─────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────┐
│  ③ AKKORD WÄHLEN                                │
│  [Akkordübersicht — wie auf akkord-uebersicht]  │
│  Angeklickter Akkord wird hervorgehoben         │
└─────────────────────────────────────────────────┘

              [ Aufnahme starten ]
        (erscheint sobald Akkord gewählt)
```

Einstellungen unter ① und ② bleiben über Sessions hinweg erhalten (localStorage).

### Gitarrentyp-Optionen
- Akustik Nylon
- Akustik Steel
- E-Gitarre clean
- Kindergitarre 1/4 / 1/2 / 3/4

### Verfügbare Techniken (Checkboxen)
Nur aktivierte Techniken fließen in den Variationsdurchlauf ein.

### Strum-Modi (Checkboxen)
Nur aktivierte Modi werden aufgenommen.

### Resultierende Variationszahl
Wird live berechnet und angezeigt: **„8 Aufnahmen geplant"** (z.B. 2 Techniken × 2 Lautstärken × 1 Modus × 2 Wiederholungen).

---

## Variationen

### Dimensionen

| Dimension | Werte | Konfigurierbar? |
|---|---|---|
| Technik | Finger / Fingernagel / Plektrum | ✓ Checkboxen im Setup |
| Lautstärke | laut / leise | fest, immer beide |
| Strum-Modus | Single / Multi 1 Takt / Multi 2 Takte | ✓ Checkboxen im Setup |
| Wiederholungen | 2 pro Variante | fest |

### Beispiel: Kein Plektrum, nur Single-Strum
Finger + Fingernagel × laut + leise × Single = **4 Variationen × 2 Wiederholungen = 8 Aufnahmen**

### Beispiel: Alles aktiv
3 Techniken × 2 Lautstärken × 3 Modi = **18 Variationen × 2 = 36 Aufnahmen**

---

## Session-Limits

Das Tool stoppt automatisch (Hinweis + Akkord-Auswahl erscheint) wenn:

- **5 Minuten** Gesamtzeit erreicht, ODER
- **5 Wiederholungen** einer Variation aufgenommen (über mehrere Sessions summiert — im localStorage gespeichert)

Begründung: Datenmüdigkeit und Qualitätsverlust nach zu vielen Wiederholungen in einem Stück. 5 Minuten pro Akkord sind genug.

---

## UX-Flow pro Variation

```
┌──────────────────────────────────────────────────┐
│  [Akkorddiagramm + Tab]                           │
│  "laut · Fingernagel · Single-Strum"              │
│  Variation 3 / 8  ·  Gitarrentyp: Akustik Steel  │
│                                                   │
│  [⛔ Stop]  [↩ Wiederholen]  [⏭ Weiter]           │
│  [Schnarren]  [Muted]                             │
└──────────────────────────────────────────────────┘
         │
         ▼
  Visueller Einzähler: 3 – 2 – 1
  (kein Ton)
         │
         ▼
  Mikrofon offen — Onset-Detektion aktiv
         │
  ┌──────┴───────────────────────────────────────┐
  │ Single-Strum                                 │
  │  Onset erkannt → "0" blinkt kurz auf         │
  │  Countdown: 4 – 3 – 2 – 1 → Stop            │
  ├──────────────────────────────────────────────┤
  │ Multi 1 Takt                                 │
  │  Onset erkannt → Metronom blinkt (visuell)   │
  │  4 Schläge → Stop                           │
  ├──────────────────────────────────────────────┤
  │ Multi 2 Takte                                │
  │  Onset erkannt → Metronom blinkt (visuell)   │
  │  8 Schläge → Stop                           │
  └──────────────────────────────────────────────┘
         │
         ▼
  Quality Gates (< 200 ms)
         │
  ┌──────┴───────────────────────────────────────┐
  │ PASS                                         │
  │  Kurze Info (grün)                           │
  │  [Schnarren] [Muted] — Schnellklassifikation │
  │  Auto-Weiter nach 3 – 2 – 1                 │
  │  (oder sofort: [⏭ Weiter])                  │
  ├──────────────────────────────────────────────┤
  │ FAIL                                         │
  │  Fehlermeldung (rot) + Grund                 │
  │  [Schnarren] [Muted] [Weitere Fehler…]       │
  │  [↩ Nochmal]  [Behalten + taggen → weiter]  │
  └──────────────────────────────────────────────┘
         │
         ▼
  Nächste Variation — oder Session-Limit erreicht
  → Akkord-Auswahl für nächsten Akkord
```

### Immer sichtbare Steuerung

| Button | Funktion |
|---|---|
| [⛔ Stop] | Session abbrechen, ZIP-Download anbieten |
| [↩ Wiederholen] | Letzte Aufnahme verwerfen, Variation neu starten |
| [⏭ Weiter] | Aktuelle Aufnahme überspringen / nächste Variation |
| [Schnarren] | Schnell-Flag auf letzte Aufnahme setzen |
| [Muted] | Schnell-Flag auf letzte Aufnahme setzen |

---

## Quality Gates

Pure-JS-Modul `chordRecorderQuality.js` — Node.js-kompatibel, unit-testbar.

| Gate | Kriterium | Aktion |
|---|---|---|
| **Zu leise** | RMS < 0.01 | FAIL |
| **Clipping** | Peak > 0.95 | FAIL |
| **Zu kurz** | Dauer < 1.5 s | FAIL |
| **Kein Onset** | Kein RMS-Spike in ersten 3 s | FAIL |
| **Silence-Ratio** | > 50 % stille Frames | WARN (behalten möglich) |

WARN-Flags werden in der Sidecar-JSON eingetragen, blockieren aber nicht.

---

## Dateiausgabe

### WAV-Datei
Schema: `{chordkey}_{technik}_{lautstaerke}_{strumModus}_{random4}.wav`

```
gdur_fingernagel_laut_single_a3f2.wav
emoll_plektrum_leise_multi1_7c9b.wav
```

### Sidecar-JSON (gleicher Name, `.json`)
```json
{
  "chord": "G-Dur",
  "chordKey": "G-Dur",
  "guitarType": "acoustic-steel-full",
  "volume": "laut",
  "technique": "fingernagel",
  "strumMode": "single",
  "bpm": 80,
  "quality": {
    "passed": true,
    "gates": {
      "clipping": false,
      "tooQuiet": false,
      "tooShort": false,
      "noOnset": false,
      "highSilenceRatio": false
    },
    "userFlags": []
  },
  "recordedAt": "2026-05-04T14:32:00Z",
  "sampleRate": 44100,
  "durationSeconds": 2.8
}
```

### ZIP-Download
Am Ende der Session (oder bei Stop): alle WAV + JSON Paare als ZIP.  
Einzel-Download nach jeder Aufnahme optional weiterhin möglich.

---

## Ablage nach Download

```
tests/fixtures/chords/G-Dur/
  gdur_fingernagel_laut_single_a3f2.wav
  gdur_fingernagel_laut_single_a3f2.json
```

`introduce-chord-fixture.mjs` erkennt Sidecar-JSONs und übernimmt Metadaten in den Frozen-Fixture-Eintrag.

---

## Neue Dateien

```
pages/tools/chord-recorder.html
js/tools/chordRecorder/
  chordRecorder.js               — Controller (createChordRecorderTool)
  chordRecorderVariations.js     — Variationsliste aus Setup berechnen
  chordRecorderQuality.js        — Pure-JS Quality Gates (unit-testbar)
  chordRecorderUI.js             — Countdown, Metronom-Blinken, Waveform-Canvas
  CLAUDE.md
```

---

## Akustische Ausgabe

**Keine.** Einzähler und Metronom sind rein visuell (Zahl blinkt / Balken leuchtet auf).

---

## Spätere Erweiterung (Phase 2)

- **Mehrere Akkorde:** Session geht automatisch alle Akkorde durch, die im localStorage noch < 5 Fixtures haben.
- **BPM-Einstellung** im Setup (Standard: 80 BPM).
- **Review-Modus:** Aufnahmen nachträglich abhören und taggen.
