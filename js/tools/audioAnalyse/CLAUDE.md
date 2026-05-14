# Audio-Analyse Werkzeug

Ein Statistik- und Debugging-Werkzeug, das WAV-Aufnahmen aus der „Noten lesen"-Übung offline analysiert und als SVG-Zeitreihen-Charts darstellt.

## Dateien

| Datei | Zweck |
|---|---|
| `audioAnalyse.js` | Haupt-Controller (`createAudioAnalyseFeature`): UI-Verdrahtung, IndexedDB-Laden, Datei-Upload, Drag & Drop |
| `audioAnalyseEngine.js` | Reine Analyse-Logik: WAV-Decode + Frame-Loop (Onset + Pitch + InputLevel) |
| `audioAnalyseSVG.js` | SVG-Chart-Renderer: 9 Charts untereinander + synchroner Crosshair mit Tooltip |

Der Storage-Dienst liegt in `js/shared/audioAnalyseStorage.js` (wegen Cross-Layer-Zugriffen aus Games und Tools).

## Datenfluss

```
Noten lesen (stopRecording)
  → saveSheetMusicTake(wav, manifest, { baseName })
      [js/shared/audioAnalyseStorage.js]
      → IndexedDB gt-audio-analyse-db / recordings / <take-id>

Audio-Analyse Werkzeug (mount)
  ← loadLatestSheetMusicTake()    [js/shared/audioAnalyseStorage.js]
  → decodeWav(arrayBuffer)        [audioAnalyseEngine.js]
  → analyzeAudio(samples, sr)     [audioAnalyseEngine.js]
  → renderAllCharts(wrapper, ..)  [audioAnalyseSVG.js]
  → initCrosshair(wrapper)        [audioAnalyseSVG.js]
```

## Analyse-Engine (`analyzeAudio`)

- `fftSize = getRecommendedFftSize(null, sampleRate)` (4096 bei 44,1 kHz)
- `hopSize = fftSize` (kein Overlap, wie in der Live-Übung)
- Pro Frame: `analyzeInputLevel` + `onsetStrategy.update` + `detectPitch` + `frequencyToNote`
- Onset-Strategie aus `SETTING_KEYS.SHEET_MUSIC_ONSET_STRATEGY` (global settings)

Rückgabe:

```ts
{
  frames: FrameData[],   // t, rms, clippingRatio, isValid, broadbandFlux, bandRatio,
                         // activeBandRatio, confidence, isOnset, hz, note, octave, cents
  onsets: number[],      // Sekunden der erkannten Onsets
  sampleRate, fftSize, hopSize, duration
}
```

## SVG-Charts (`renderAllCharts`)

9 Charts in fixer Reihenfolge, gemeinsame X-Achse (Zeit):

1. **Wellenform** – Envelope min/max per Bin (H=90)
2. **RMS** – Energie über Zeit (H=72)
3. **Spektralfluss** – `broadbandFlux` (H=72)
4. **Band-Ratio** – `bandRatio` (H=72)
5. **Aktive Bänder** – `activeBandRatio` (H=72)
6. **Onset-Konfidenz** – 0..1 (H=72)
7. **Frequenz Hz** – log-Skala 70..1200 Hz, Gitarren-Saitenlinien (H=110)
8. **Erkannte Note** – diskrete Y-Achse, nach Frequenz sortiert (H=dynamisch)
9. **Clipping-Rate** – Übersteuerungsindikator (H=72)

Onset-Marker: rote gestrichelte Linien (`#e74c3c`) auf allen Charts.

### Layout-Konstanten

```js
CHART_W = 1000
PAD_L = 58, PAD_R = 12, PAD_T = 10, PAD_B = 26
PLOT_W = 930
```

### Crosshair

- Modul-Level: `_crosshairLines[]`, `_tooltipEl`, `_analysisFrames`, `_analysisDuration`
- `initCrosshair(wrapper)` setzt `pointermove`-Listener auf Wrapper-`<div>`
- Alle SVG-Crosshair-`<line>`-Elemente werden synchron aktualisiert
- Tooltip zeigt: Zeit, RMS, Hz, Note, Onset-Konfidenz, Onset-Indikator

## IndexedDB-Schema

- **Database**: `gt-audio-analyse-db`
- **Object Store**: `recordings`
- **Key**: eindeutige Take-ID/BaseName; Legacy-`'last'` bleibt lesbar, wenn WAV und Manifest vorhanden sind
- **Value**: `{ id, baseName, wav: Uint8Array, sidecar, manifest: sidecar, savedAt: ISO-String }`
- Notenlesen-BaseNames werden upstream erzeugt und stabil weitergereicht:
  `notenlesen_<takt>_<bpm>bpm_<noten>_<random5>`. Audio-Analyse zeigt und
  verwendet diesen Wert, berechnet ihn aber nicht neu.

## Seite

- `pages/audio-analyse/index.html` – statische Seite mit `<gt-exercise-header>`
- `pages/audio-analyse/bootstrap.js` – importiert Components + mountet `createAudioAnalyseFeature`
- Root-Element: `#view-audio-analyse`

## Zugriff aus Noten lesen

In `js/games/sheetMusicReading/sheetMusicReading.js`:
- Import: `saveSheetMusicTake` aus `../../shared/audioAnalyseStorage.js`
- Automatisches Speichern vollständiger WAV+JSON-Takes nach `stopRecording()`
- Ohne URL-Parameter lädt die Audio-Analyse beim Mount den neuesten vollständigen Notenlesen-Take automatisch
