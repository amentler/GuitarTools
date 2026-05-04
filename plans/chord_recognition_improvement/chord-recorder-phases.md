# Chord Recorder — Implementierungsphasen

Jede Phase ergibt einen eigenständig push-baren Stand.  
Architektur folgt dem bestehenden Muster: `pages/{name}/index.html` + `js/tools/{name}/` + Factory `createChordRecorderTool()`.

---

## Phase 1 — Grundgerüst

**Ziel:** Seite existiert, ist navigierbar, zeigt Platzhalter.

### Neue Dateien
| Datei | Inhalt |
|---|---|
| `pages/chord-recorder/index.html` | HTML-Shell mit `<gt-exercise-header>`, lädt `chordRecorder.js` |
| `js/tools/chordRecorder/chordRecorder.js` | `createChordRecorderTool()` — leeres Factory-Stub |
| `js/tools/chordRecorder/CLAUDE.md` | Kurzbeschreibung des Moduls |

### Geänderte Dateien
| Datei | Änderung |
|---|---|
| `index.html` | `<gt-menu-card icon="🎙️" title="Akkord-Recorder" href="pages/chord-recorder/index.html">` im Tools-Bereich |
| `sw.js` / `precacheManifest.js` | Neue Seite eintragen |

---

## Phase 2 — Setup-Screen

**Ziel:** Instrument-Konfiguration, Varianten-Auswahl, Akkord-Auswahl — alles funktional. Noch keine Aufnahme.

### Neue Dateien
| Datei | Inhalt |
|---|---|
| `js/tools/chordRecorder/chordRecorderVariations.js` | Pure Funktion `buildVariationList(config)` → sortierte Array von `{technik, lautstaerke, strumModus}` |
| `tests/unit/chordRecorderVariations.test.js` | Unit-Tests: leere Auswahl, alle Kombinationen, Reihenfolge |

### Funktionalität
- Gitarrengröße + Saiten: zwei Dropdowns, Wert in localStorage
- Technik-Checkboxen (Finger / Fingernagel / Plektrum), in localStorage
- Strum-Modi-Checkboxen (Single / Multi 1 Takt / Multi 2 Takte), in localStorage
- Live-Anzeige: „N Aufnahmen geplant" (aktualisiert bei jeder Änderung)
- Akkord-Auswahl: Liste aller Akkorde aus `akkordData.js`, bei Klick hervorgehoben
- „Aufnahme starten"-Button erscheint erst wenn mindestens 1 Technik, 1 Modus und ein Akkord gewählt sind

---

## Phase 3 — Quality Gates (Pure Logic)

**Ziel:** Alle Quality-Gate-Funktionen fertig und vollständig unit-getestet — unabhängig von DOM und Mikrofon.

### Neue Dateien
| Datei | Inhalt |
|---|---|
| `js/tools/chordRecorder/chordRecorderQuality.js` | Pure Funktionen, kein DOM |
| `tests/unit/chordRecorderQuality.test.js` | Vollständige Abdeckung aller Gates |

### Exports aus `chordRecorderQuality.js`
```js
checkClipping(samples)          // peak > 0.95
checkTooQuiet(samples)          // RMS < 0.01
checkTooShort(durationSec)      // < 1.5 s
checkNoOnset(samples, sampleRate) // kein RMS-Spike in ersten 3 s
checkSilenceRatio(samples)      // > 50 % stille Frames → WARN
runQualityGates(samples, sampleRate, durationSec)
  // → { passed: bool, failReasons: string[], warnReasons: string[] }
```

### Testfälle (Auswahl)
```
checkClipping([0.96, ...])          → { clipping: true }
checkClipping([0.5, ...])           → { clipping: false }
checkTooQuiet(nearZeroSamples)      → { tooQuiet: true }
checkNoOnset(flatSamples, 44100)    → { noOnset: true }
runQualityGates(goodSamples, ...)   → { passed: true, failReasons: [] }
runQualityGates(clippedSamples, ...) → { passed: false, failReasons: ['clipping'] }
```

---

## Phase 4 — Aufnahme-Grundflow (Single Strum)

**Ziel:** Single-Strum-Aufnahme läuft komplett durch — Einzähler, Onset, Countdown, Quality Gates, Download.

### Neue Dateien
| Datei | Inhalt |
|---|---|
| `js/tools/chordRecorder/chordRecorderAudio.js` | Mikrofon-Zugriff, MediaRecorder, Onset-Detektion |
| `js/tools/chordRecorder/chordRecorderUI.js` | Visueller Countdown, Fortschrittsanzeige, Buttons |

### Flow
1. Visueller Einzähler 3–2–1 (kein Ton)
2. Mikrofon offen, Onset-Detektion (RMS-Spike)
3. Onset erkannt → Aufnahme läuft → Countdown 4–3–2–1 → Stop
4. Quality Gates → Pass/Fail anzeigen
5. Immer sichtbar: `[⛔ Stop]` `[↩ Wiederholen]` `[⏭ Weiter]` `[Schnarren]` `[Muted]`
6. Download: einzelne WAV mit vorläufigem Namen (random5-Schema, noch ohne vollständige Metadaten)

Nutzt `microphoneService.js` aus `js/shared/audio/` (bereits vorhanden).

---

## Phase 5 — Dateiausgabe + Sidecar-JSON

**Ziel:** Jede Aufnahme erhält den korrekten Dateinamen und eine vollständige Sidecar-JSON. Alle Aufnahmen werden in-memory gesammelt.

### Neue Dateien
| Datei | Inhalt |
|---|---|
| `js/tools/chordRecorder/chordRecorderFiles.js` | Dateiname generieren, Sidecar-JSON bauen, In-Memory-Store |

### Exports
```js
generateRandom5()                   // → z.B. "a3f2x" (0-9a-z, 5 Zeichen)
buildFileName(variation, chordKey)  // → "gdur_fingernagel_laut_single_a3f2x"
buildSidecarJson(variation, meta)   // → JSON-Objekt mit allen Feldern
```

### Dateiname-Schema
```
{chordKey}_{technik}_{lautstaerke}_{strumModus}_{random5}.wav
```
`chordKey`: Akkordname normiert auf ASCII-Kleinbuchstaben (z.B. `G-Dur` → `gdur`, `H7 (B7)` → `h7b7`).

### Sidecar-JSON-Felder
```json
{
  "chord": "G-Dur",
  "chordKey": "gdur",
  "guitarSize": "full",
  "guitarStrings": "steel",
  "volume": "laut",
  "technique": "fingernagel",
  "strumMode": "single",
  "quality": {
    "passed": true,
    "failReasons": [],
    "warnReasons": [],
    "userFlags": []
  },
  "recordedAt": "2026-05-04T14:32:00Z",
  "sampleRate": 44100,
  "durationSeconds": 2.8
}
```

---

## Phase 6 — Multi-Strum + Visuelles Metronom

**Ziel:** Multi-Strum-Modi (1 Takt / 2 Takte) mit visuellem Metronom funktionieren.

### Änderungen
- `chordRecorderAudio.js`: Aufnahmedauer für Multi-Modi via BPM berechnen (Standard: 80 BPM)
- `chordRecorderUI.js`: Metronom-Blinken (visuell, kein Ton) — Beat-Indikator blinkt im Takt

### Beat-Timing
```
1 Takt  @ 80 BPM = 4 × 750 ms = 3.0 s
2 Takte @ 80 BPM = 8 × 750 ms = 6.0 s
```

---

## Phase 7 — Tool-Menü: ZIP-Download + Clear

**Ziel:** Gesamtdownload und Speicher leeren funktionieren.

### Änderungen
- `chordRecorderFiles.js`: `getAllRecordings()`, `clearRecordings()`
- `chordRecorder.js`: Tool-Menü mit zwei Buttons oben
- ZIP-Erzeugung: natives `CompressionStream`-API (keine externe Abhängigkeit) oder `JSZip` falls nötig

### Buttons
| Button | Verhalten |
|---|---|
| `[⬇ Alles herunterladen]` | ZIP aller WAV + JSON aus In-Memory-Store |
| `[🗑 Aufnahmen löschen]` | Bestätigungsdialog → In-Memory-Store leeren, Zähler zurücksetzen |

---

## Reihenfolge & Abhängigkeiten

```
Phase 1 (Grundgerüst)
  └─ Phase 2 (Setup-Screen)
       └─ Phase 4 (Aufnahme-Grundflow)
            ├─ Phase 5 (Dateiausgabe)
            │    └─ Phase 7 (Tool-Menü)
            └─ Phase 6 (Multi-Strum)

Phase 3 (Quality Gates) — unabhängig, kann parallel zu Phase 2 gemacht werden
```
