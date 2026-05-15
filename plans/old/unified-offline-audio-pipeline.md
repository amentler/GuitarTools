# Plan: Einheitliche Offline-Audio-Pipeline

## Kontext

**Problem:** Onset-Detection liefert auf Chrome (Tablet) unterschiedliche Ergebnisse zwischen
`audio-analyse` und `onset-tagger` für dieselbe Datei mit derselben Strategie. Auf Firefox
(Laptop) sind die Ergebnisse identisch.

**Root Cause:** Zwei verschiedene FFT-Codepfade:

| Tool | Pfad auf Chrome | Pfad auf Firefox |
|---|---|---|
| `audioAnalyseEngine.js` | `OfflineAudioContext + AnalyserNode` ✓ | `computeDbSpectrum` (Fallback) |
| `offlineOnsetDetection.js` | `computeDbSpectrum` ✗ | `computeDbSpectrum` |

- Chrome unterstützt `OfflineAudioContext.prototype.suspend` → `audioAnalyseEngine.js` nutzt den
  nativen Browser-FFT-Pfad (identisch zur Live-Analyse in `sheetMusicReading.js`)
- Firefox unterstützt `OfflineAudioContext.prototype.suspend` **nicht** → beide Tools fallen auf
  `computeDbSpectrum` zurück → Ergebnisse stimmen überein
- `computeDbSpectrum` verwendet `Hann-Fenster (N-1)` + Float64-JS-FFT; der AnalyserNode
  verwendet den hardware-beschleunigten Browser-FFT → bei Grenzwertfällen unterschiedliche
  dB-Werte → 1–2 Onsets kippen

**Ziel:** Alle Offline-Analyse-Pfade nutzen denselben Code: native `OfflineAudioContext +
AnalyserNode` wenn verfügbar, sonst `computeDbSpectrum` als Fallback. Live-Tools
(`sheetMusicReading`, `guitarTuner`, `chordExerciseEssentia`) sind bereits korrekt
(Real-Time-AnalyserNode) und benötigen keine Änderung.

---

## Betroffene Dateien

| Datei | Änderung |
|---|---|
| `js/shared/audio/collectFrameData.js` | **NEU** – extrahierte Funktion aus `audioAnalyseEngine.js` |
| `js/tools/audioAnalyse/audioAnalyseEngine.js` | `collectFrameData` entfernen, aus shared importieren |
| `js/shared/audio/offlineOnsetDetection.js` | sync → async, `computeDbSpectrum` durch `collectFrameData` ersetzen |
| `js/tools/onsetTagger/onsetTagger.js` | `requestAnimationFrame`-Callback: sync-Aufruf → async/await |
| `tests/unit/offlineOnsetDetection.test.js` | **NEU** – Unit-Tests für den Fallback-Pfad |

---

## Neue Funktionen / Exports

### `js/shared/audio/collectFrameData.js`

```js
/**
 * Sammelt { samples, frequencyData } pro Frame offline.
 * Bevorzugter Pfad: OfflineAudioContext + AnalyserNode (identisch zur Live-Analyse).
 * Fallback: computeDbSpectrum (JS-FFT) wenn OfflineAudioContext.prototype.suspend fehlt.
 *
 * @param {Float32Array} samples   – mono, normalisiert [-1, 1]
 * @param {number} sampleRate
 * @param {number} fftSize         – Potenz von 2
 * @param {number} hopSize         – Schrittweite (= fftSize für kein Overlap)
 * @returns {Promise<Array<{ samples: Float32Array, frequencyData: Float32Array }>>}
 */
export async function collectFrameData(samples, sampleRate, fftSize, hopSize)
```

Implementierung: identisch zur bisherigen privaten Funktion in `audioAnalyseEngine.js`
(Zeilen 58–111). Kein Code ändert sich – nur Datei und Export.

### `js/shared/audio/offlineOnsetDetection.js`

```js
/**
 * @param {Float32Array} samples
 * @param {number} sampleRate
 * @param {{ strategyKey?: string, fftSize?: number, hopSize?: number }} [options]
 * @returns {Promise<{ onsetsMs: number[], onsetsSec: number[] }>}  // war synchron!
 */
export async function detectOnsetsOffline(samples, sampleRate, options = {})
```

Intern ersetzt der Frame-Loop `computeDbSpectrum` durch `await collectFrameData(...)`.
Die `sliceFrame`-Hilfsfunktion entfällt (wird intern von `collectFrameData` übernommen).

---

## Teststrategie

### Was ist unit-testbar?

Der `OfflineAudioContext + AnalyserNode`-Pfad setzt einen Browser voraus und ist in Vitest
(Node.js) **nicht direkt testbar**. Der **Fallback-Pfad** (wenn `OfflineAudioContext.prototype.suspend`
fehlt) nutzt nur `computeDbSpectrum` und ist vollständig unit-testbar.

E2E-Abdeckung des Browser-Pfads existiert bereits in `tests/e2e/audio-analyse.spec.js`
(WAV-Upload ohne suspend-Fehler).

### Neue Testdatei: `tests/unit/offlineOnsetDetection.test.js`

```
Testfall 1: detectOnsetsOffline ist eine async-Funktion
  Eingabe: beliebige Samples
  Erwartung: Rückgabewert ist ein Promise

Testfall 2: Stille → keine Onsets
  Eingabe: Float32Array(44100).fill(0), sampleRate=44100
  Erwartung: { onsetsMs: [], onsetsSec: [] }

Testfall 3: Impuls am Frame-Anfang → mindestens 1 Onset
  Eingabe: Float32Array von 3 Frames (3×4096 Samples), Frame 1 = silence,
           Frame 2 = amplitude spike (fill(0.1)), Frame 3 = silence
  Erwartung: onsetsMs.length >= 1, onsetsMs[0] im Bereich des 2. Frames

Testfall 4: Rückgabe enthält onsetsMs (ms gerundet) und onsetsSec (Sekunden)
  Eingabe: beliebige kurze Aufnahme mit einem Onset
  Erwartung: onsetsMs = onsetsSec.map(s => Math.round(s * 1000))

Testfall 5: strategyKey wird an resolveGuitarOnsetStrategy übergeben
  Eingabe: samples=silence, strategyKey='guitar-onset-broadband-or'
  Erwartung: keine Exception, Rückgabe ist { onsetsMs: [], onsetsSec: [] }

Testfall 6: fftSize-Option wird respektiert (Frame-Count-Prüfung)
  Eingabe: 8192 Samples, fftSize=4096, sampleRate=44100
  Erwartung: Aufruf löst kein Promise-Fehler aus; onsetsMs ist Array
```

**Mock-Setup:** `OfflineAudioContext.prototype.suspend` auf `undefined` setzen (oder nie
global setzen, da Node.js/jsdom es nicht hat) → Fallback-Pfad wird automatisch genutzt.

### Nicht neue Tests nötig

- `collectFrameData` selbst: Reine Code-Bewegung ohne Logikänderung. Bestehende
  E2E-Tests in `tests/e2e/audio-analyse.spec.js` bleiben der Abdeckung des Browser-Pfads.
- `audioAnalyseEngine.js`: Logik ändert sich nicht, nur Import-Quelle.
- `onsetTagger.js`: Keine Logik-Änderung, nur async/await-Wiring. Bestehende
  E2E-Tests in `tests/e2e/onset-tagger.spec.js` decken das Verhalten ab.

---

## TDD-Reihenfolge

1. **Rot:** `tests/unit/offlineOnsetDetection.test.js` schreiben (importiert noch die
   unveränderte synchrone Funktion → Tests schlagen fehl weil `.then` fehlt)
2. **Grün:** `js/shared/audio/collectFrameData.js` erstellen + `offlineOnsetDetection.js`
   auf async umstellen → Tests grün
3. **Refactor:** `audioAnalyseEngine.js` auf shared Import umstellen + `onsetTagger.js`
   auf await umstellen → Alle bestehenden Tests weiter grün

---

## Implementierungsreihenfolge

### Schritt 1: Shared Modul erstellen

Datei `js/shared/audio/collectFrameData.js` anlegen.  
Inhalt: die bisherige private Funktion `collectFrameData` aus `audioAnalyseEngine.js`
(Zeilen 58–111) unverändert extrahieren und als `export async function` exportieren.  
Imports: `computeDbSpectrum` aus `./dbSpectrum.js`.

### Schritt 2: `audioAnalyseEngine.js` anpassen

- Import von `collectFrameData` aus `./collectFrameData.js` hinzufügen  
  (statt `computeDbSpectrum` für den Fallback direkt zu importieren)
- Die private Funktion `collectFrameData` (Zeilen 58–111) entfernen
- `import { computeDbSpectrum }` entfernen (wird nur noch in `collectFrameData.js` benötigt)

### Schritt 3: Tests schreiben (rot)

`tests/unit/offlineOnsetDetection.test.js` mit den 6 Testfällen anlegen.
Tests importieren die aktuell noch synchrone `detectOnsetsOffline` → Async-Tests schlagen fehl.

### Schritt 4: `offlineOnsetDetection.js` auf async umstellen

- `import { collectFrameData } from './collectFrameData.js'` hinzufügen
- `import { computeDbSpectrum }` entfernen
- Funktion `detectOnsetsOffline` wird `async`
- Frame-Loop: `const frameInputs = await collectFrameData(samples, sampleRate, fftSize, hopSize);`
- danach `for`-Loop über `frameInputs` (analog `audioAnalyseEngine.js`)
- `sliceFrame`-Hilfsfunktion entfernen
- Return-Wert identisch: `{ onsetsMs, onsetsSec }`

### Schritt 5: `onsetTagger.js` auf async/await umstellen

Im Strategy-Button-Handler:

```js
// VORHER: requestAnimationFrame(() => { try { const result = detectOnsetsOffline(...); ... } })
// NACHHER:
detectOnsetsOffline(_samples, _sampleRate, { strategyKey })
  .then(result => { /* merge + updateUI */ })
  .catch(err => setStrategyStatus(ui, `Fehler: ${err.message}`))
  .finally(() => { btn.disabled = false; });
```

`requestAnimationFrame` entfällt – async gibt den Haupt-Thread von selbst frei.

### Schritt 6: Verifikation

```bash
npm run test:precommit   # alle Unit-Tests grün
npm test                 # inkl. Audio-Fixtures
```

E2E manuell: `onset-tagger` und `audio-analyse` mit derselben WAV-Datei auf Chrome →
Onset-Anzahl mit `broadband-or`-Strategie muss übereinstimmen.
