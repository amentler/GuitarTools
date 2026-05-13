# Plan: Onset-Tagger Tool (`onsetTagger`)

## Kontext

Um die Onset-Erkennungsalgorithmen (Parameter-Sweeps in `sweep-runs/onset/`) mit echten Ground-Truth-Daten zu validieren und zu verbessern, werden manuell annotierte Onset-Zeitstempel benötigt. Dazu brauchen wir ein Browser-Werkzeug, das:

1. Eine WAV-Aufnahme + zugehörige Sidecar-JSON lädt
2. Den Nutzer die Anschlagszeitpunkte (Onsets) präzise markieren lässt
3. Alle Sidecar-Metadaten editierbar macht
4. WAV + aktualisiertes JSON als ZIP exportiert

Die ZIP wird später manuell ins Repo hochgeladen und durch ein Import-Skript in `tests/fixtures/` einsortiert.

---

## Was ich verstanden habe

Das Tool ist ein Offline-Annotationswerkzeug. Der Nutzer lädt eine existierende Gitarren-Aufnahme und ihre Sidecar-Datei, hört sich die Aufnahme ab (ggf. verlangsamt, in einer Schleife über einen eingegrenzten Bereich), markiert präzise die Anschlagszeitpunkte und speichert die Ergebnisse. Das Tool erzeugt kein Audio, erkennt nichts automatisch — es dient ausschließlich der manuellen Annotation.

---

## Präzise UI-Beschreibung

Die Oberfläche ist in **zwei aufeinanderfolgende Schritte** gegliedert, die visuell als nummerierte Sektionen dargestellt werden:

- **Schritt 1: Onset-Tagging** — Audio laden, Waveform, Slider, Onsets markieren
- **Schritt 2: Attribute + Export** — Sidecar-Felder editieren, ZIP exportieren

Schritt 2 ist erst vollständig sichtbar/aktiv, nachdem beide Dateien geladen wurden.

### Seitenaufbau (von oben nach unten)

```
┌──────────────────────────────────────────────────────────────┐
│  ONSET TAGGER                                    [← zurück]  │
├──────────────────────────────────────────────────────────────┤
│  DATEI-LADEN                                                 │
│  [WAV laden]  wave.wav  ✓   [JSON laden]  fast.json  ✓       │
├──────────────────────────────────────────────────────────────┤
│  ── SCHRITT 1: ONSET-TAGGING ─────────────────────────────── │
│                                                              │
│  WELLENFORM  (volle Breite, ~150px hoch, SVG)                │
│  ┌────────────────────────────────────────────────────────┐  │
│  │  Amplitude-Envelope für sichtbaren Bereich             │  │
│  │  ─────────  grüner Strich (Onset-Cursor)               │  │
│  │  |rot| |rot|     (bestätigte Onsets)                   │  │
│  │  ≡≡≡≡≡ orangefarbener Strich (Playhead, nur beim Play) │  │
│  │  Zeit-Achse unten                                       │  │
│  └────────────────────────────────────────────────────────┘  │
│                                                              │
│  BEREICH-SLIDER (gesamte Datei, zwei getrennte Slider)       │
│  Start: ├──●────────────────────────────────────────────┤   │
│  Ende:  ├────────────────────────────────────●──────────┤   │
│  Anzeige: 0.00 s – 4.00 s                                    │
│                                                              │
│  ONSET-CURSOR (nur innerhalb Start–Ende)                     │
│  Onset: ├──────────────●──────────────────────────────────┤ │
│  Anzeige: 1.23 s (absolut)                                   │
│  [+ Onset hinzufügen]                                        │
│                                                              │
│  WIEDERGABE                                                  │
│  [▶ Play / ⏸ Pause]  [■ Stop]                               │
│  Geschwindigkeit: [●100%] [ 75%] [ 50%] [ 25%]              │
│                                                              │
│  ONSETS-LISTE                                                │
│  1. 1234 ms  [✕]                                            │
│  2. 2567 ms  [✕]                                            │
│  3. 3891 ms  [✕]                                            │
│  (aufsteigend sortiert, ms-Einheit)                          │
│                                                              │
├──────────────────────────────────────────────────────────────┤
│  ── SCHRITT 2: ATTRIBUTE + EXPORT ───────────────────────── │
│                                                              │
│  METADATEN (Sidecar-Felder; ohne onsetsMs-Feld)              │
│  notes:       [Textarea, JSON-Array]                        │
│  tempoBpm:    [Zahl-Input]                                  │
│  category:    [Text-Input]                                  │
│  description: [Text-Input]                                  │
│  ...alle weiteren Felder dynamisch generiert...              │
│                                                              │
│  [📦 Als ZIP exportieren]                                    │
└──────────────────────────────────────────────────────────────┘
```

### Interaktionsregeln

**Schritt 1 — Onset-Tagging:**
- **Waveform** zeigt immer nur den Bereich [Start, Ende]. Wenn Start/Ende sich ändern, wird die Waveform neu gerendert (Zoom).
- **Grüner Strich** = Onset-Cursor-Position. Bewegt sich mit dem Onset-Slider.
- **Rote Striche** = bestätigte Onsets im sichtbaren Bereich.
- **Orangefarbener Strich** = Playhead während der Wiedergabe (RAF-Animation).
- **Play** spielt von Start ab, läuft in einer Schleife zwischen Start und Ende.
- **Pause** hält an; bei erneutem Play wird an der gleichen Stelle weitergemacht.
- **Stop** stoppt die Wiedergabe, setzt Start=0, Ende=Gesamtdauer, Playhead zurück (View-Reset).
- **Onset hinzufügen**: fügt den Cursor-Wert in ms zur Liste hinzu, Liste bleibt aufsteigend sortiert.
- **✕ bei Onset**: entfernt diesen Onset aus der Liste.

**Schritt 2 — Attribute + Export:**
- **Metadaten-Editor**: generiert sich dynamisch aus den JSON-Schlüsseln (außer `onsetsMs`). Primitive → Input, Array/Objekt → Textarea (JSON). Erst vollständig bedienbar, sobald JSON geladen.
- **ZIP-Export**: WAV (Original-ArrayBuffer) + JSON (Sidecar-Felder aus dem Formular + `onsetsMs: [...]`) in ZIP verpackt und als Download angeboten.

### Sidecar-JSON-Erweiterung

Dem Sidecar-JSON wird ein neues Feld hinzugefügt:
```json
{
  "...bestehende Felder...",
  "onsetsMs": [1234, 2567, 3891]
}
```

---

## Betroffene Dateien

### Neu zu erstellen

| Datei | Inhalt |
|---|---|
| `pages/onset-tagger/index.html` | HTML-Seite mit `<gt-exercise-header>`, Struktur für alle UI-Bereiche |
| `pages/onset-tagger/bootstrap.js` | Mounts `createOnsetTaggerFeature` |
| `js/tools/onsetTagger/onsetTagger.js` | Haupt-Controller (`createOnsetTaggerFeature`) |
| `js/tools/onsetTagger/onsetTaggerWaveform.js` | SVG-Waveform-Rendering (Envelope, Marker, Playhead) |
| `js/tools/onsetTagger/onsetTaggerLogic.js` | Pure Functions: Envelope-Berechnung, Zeit-Pixel-Umrechnung, Sidecar-Builder |
| `js/tools/onsetTagger/CLAUDE.md` | Dokumentation |
| `scripts/import-onset-zip.mjs` | Node.js-Import-Skript: ZIP → korrektes `tests/fixtures/`-Verzeichnis |
| `tests/e2e/onset-tagger.spec.js` | Playwright-E2E-Tests für das Tool |

### Zu modifizieren

| Datei | Änderung |
|---|---|
| `index.html` | `<gt-menu-card>` für Onset Tagger in der Werkzeuge-Sektion hinzufügen |
| `js/shared/pwa/precacheManifest.js` | Neue Seiten in `PAGE_PRECACHED_URLS` aufnehmen |

---

## Neue Funktionen / Exports

### `onsetTaggerLogic.js` (pure, unit-testbar)

```js
export function computeEnvelope(samples, sampleRate, startSec, endSec, buckets)
// → { mins: Float32Array, maxs: Float32Array }

export function timeToPixel(tSec, rangeStart, rangeEnd, plotWidth)
// → x-Koordinate (0..plotWidth), geclampet

export function addOnset(onsets, newOnsetMs)
// → neue aufsteigend sortierte Liste (Duplikate ignoriert)

export function removeOnset(onsets, index)
// → neue Liste ohne Element an index

export function buildSidecarWithOnsets(formValues, onsetsMs)
// → { ...formValues, onsetsMs }

export function clamp(value, min, max)
// → min wenn value < min, max wenn value > max, sonst value

export function computePlayheadPosition(startTime, ctxCurrentTime, playbackRate, rangeStart, rangeEnd, initialOffset)
// → Playhead-Position in Sekunden (loop-aware)
```

### `onsetTaggerWaveform.js`

```js
export function renderWaveform(container, samples, sampleRate, rangeStart, rangeEnd, options)
// options: { plotWidth?, plotHeight?, onsetsMs?, cursorSec?, playheadSec? }
// → SVGElement (wird in container eingefügt)

export function updatePlayhead(svgEl, playheadSec, rangeStart, rangeEnd)
export function updateCursor(svgEl, cursorSec, rangeStart, rangeEnd)
export function updateOnsetMarkers(svgEl, onsetsMs, rangeStart, rangeEnd)
```

### `onsetTagger.js`

```js
export function createOnsetTaggerFeature()
// → { mount(root), unmount() }
```

---

## Teststrategie

### ZIP-Code

Kein JSZip nötig — `buildZip` + `downloadBlob` aus `js/games/sheetMusicReading/sheetMusicZip.js` importieren.

### Unit-Tests (`tests/unit/onsetTaggerLogic.test.js`)

| Funktion | Testfälle |
|---|---|
| `computeEnvelope` | 1 Bucket über [0.5, -0.5, 0.5, -0.5] → max≈0.5, min≈-0.5; leere range → leeres Array |
| `timeToPixel` | t=rangeStart → 0; t=rangeEnd → plotWidth; t außerhalb → geclampt |
| `addOnset` | Hinzufügen sortiert; Duplikat wird ignoriert |
| `removeOnset` | Mittleres Element entfernen; ungültiger Index → unverändert |
| `buildSidecarWithOnsets` | Felder bleiben; onsetsMs gesetzt; vorheriger Wert überschrieben |
| `clamp` | Untere/obere Grenze; innerhalb |
| `computePlayheadPosition` | Normale Position; Loop-Wrapping |

### E2E-Tests (`tests/e2e/onset-tagger.spec.js`)

- Seite lädt → Buttons sichtbar
- WAV + JSON laden → Waveform-SVG erscheint
- Onset hinzufügen → erscheint in Liste
- Onset entfernen → verschwindet
- Metadaten-Feld ändern → persistiert
- ZIP-Export → Download-Event ausgelöst

---

## Implementierungsstatus

- [x] `plans/taggingsystem.md` geschrieben
- [x] `tests/unit/onsetTaggerLogic.test.js`
- [x] `js/tools/onsetTagger/onsetTaggerLogic.js`
- [x] `pages/onset-tagger/index.html`
- [x] `pages/onset-tagger/bootstrap.js`
- [x] `js/tools/onsetTagger/onsetTaggerWaveform.js`
- [x] `js/tools/onsetTagger/onsetTagger.js`
- [x] `scripts/import-onset-zip.mjs`
- [x] `tests/e2e/onset-tagger.spec.js`
- [x] `index.html` — Menu-Card hinzugefügt
- [x] `js/shared/pwa/precacheManifest.js` — neue Assets
- [x] `js/tools/onsetTagger/CLAUDE.md`
