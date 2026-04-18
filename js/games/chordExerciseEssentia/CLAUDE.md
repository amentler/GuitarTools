# chordExerciseEssentia – Akkord-Übung mit Essentia.js HPCP-Erkennung

Duplikat der `chordExercise`-Übung mit neuimplementierter Akkorderkennung via
**essentia.js WASM** (HPCP-basiert). Löst die Fehleranfälligkeit der bisherigen
FFT-Peak-Erkennung.

## Warum essentia.js?

Die alte Erkennung (`chordExercise/chordDetection.js`) nutzt einfache FFT-Peaks
und einen handgestrickten harmonischen Filter. Probleme:
- Gitarren-Obertöne werden fälschlicherweise als eigenständige Töne erkannt
- Stimmung/Dämpfung beeinflussen Peak-Positionen stark
- Kein stabiles Matching bei Voicings

**HPCP (Harmonic Pitch Class Profile)** – entwickelt von MTG Barcelona, auch in
essentia.js implementiert – löst das durch:
- Projektion der spektralen Peaks auf 12 Pitch-Class-Bins (C…B)
- Über mehrere Frames gemittelt → stabil gegenüber Transienten
- Cosine-Similarity-Matching gegen vordefinierte Akkord-Templates

## Dateien

```
chordExerciseEssentia/
├── chordExerciseEssentia.js   – Controller (factory + registerExercise)
├── essentiaChordDetection.js  – Audio-Pipeline: Mikrofon → HPCP → matchChord
├── essentiaChordLogic.js      – Reine Logik: Templates, cosineSimilarity, matching
├── essentiaLoader.js          – Singleton-Loader für essentia.js WASM
└── CLAUDE.md
```

## Essentia.js WASM-Dateien

Gespeichert in `/js/lib/essentia/` (nicht per CDN, für Offline-Support):

| Datei | Größe | Zweck |
|---|---|---|
| `essentia-wasm.web.js` | ~215 KB | Emscripten JS-Loader |
| `essentia-wasm.web.wasm` | ~1.9 MB | WASM-Binary |
| `essentia.js-core.umd.js` | ~333 KB | Hochlevel JS-API |

Alle drei sind in `sw.js` → `PRECACHE_URLS` eingetragen → Offline nach dem ersten Load.

**Lizenz:** essentia.js ist AGPL-3.0. Da GuitarTools Open-Source auf GitHub Pages
läuft, ist die AGPL-Nutzung kompatibel (Quellcode öffentlich zugänglich).

## Architektur

```
chordExerciseEssentia.js
  ├── essentiaChordDetection.js
  │     ├── essentiaLoader.js         ← window.EssentiaWASM + window.Essentia
  │     └── essentiaChordLogic.js     ← buildChordTemplates, matchHpcpToChord
  └── akkordLogic.js (getRandomChord)
  └── akkordSVG.js (renderChordDiagram)
```

## Audio-Pipeline (nach Anschlag-Erkennung)

1. `AnalyserNode.getFloatTimeDomainData()` → 4096 Samples (93 ms)
2. `essentia.Windowing(signal, 'hann')` → gefensterter Frame
3. `essentia.Spectrum(windowed)` → Magnitudenspektrum
4. `essentia.SpectralPeaks(spectrum, minFreq=40, maxFreq=5000)` → Peaks
5. `essentia.HPCP(frequencies, magnitudes, size=12)` → 12-Bin-Vektor
6. Mittelwert über 6 Frames
7. `matchHpcpToChord(avgHpcp, targetChord, templates)` → `{ isCorrect, confidence }`

## Chord-Template-Matching

Jeder Akkord aus `akkordData.js` wird in ein 12-Bit-Binärvektor übersetzt
(Bins C…B). `cosineSimilarity(hpcp, template) >= 0.65` und das Template mit dem
höchsten Score muss der Zielakkord sein → `isCorrect = true`.

## Tests

`tests/unit/essentiaChordLogic.test.js` – reine Logik:
- `cosineSimilarity`: Identität, Orthogonalität, Teilüberlappung
- `averageHpcps`: Leereingabe, Einzelframe, Mehrframes
- `buildChordTemplates`: Vollständigkeit, C-Dur/G-Dur/Am Bins, Float32Array-Format
- `matchHpcpToChord`: Perfekter Match, Null-Vektor, Falscher Akkord, Custom Threshold

## AI Collaboration

**IMPORTANT FOR ALL AGENTS:**
- Beim Hinzufügen von Akkorden in `akkordData.js` werden Templates automatisch
  neu gebaut (keine manuelle Pflege nötig).
- Schwellenwert `threshold=0.65` in `matchHpcpToChord` kann bei Bedarf angepasst
  werden (z. B. als Settings-Slider in der UI).
- essentia.js WASM-Dateien sind committed – bei Versionswechsel alle drei Dateien
  ersetzen und `sw.js` `CACHE_VERSION` erhöhen.
