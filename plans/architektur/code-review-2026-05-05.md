# Code Review – GuitarTools (2026-05-05)

Stand: Version 0.76 | Commit `1c62153`  
Scope: 90 JS-Dateien, ~8.460 LOC (ohne `js/lib/`), 92 Testdateien

---

## Gesamtbewertung

Die Codebasis ist gut strukturiert und professionell gepflegt. Die Layer-Trennung
(Logic / Controller / Component / Shared) ist konsequent umgesetzt, alle 16 `*Logic.js`-Module
haben Unit-Tests, und die Architektur-Grenzen werden durch `architectureBoundaryGuards.test.js`
maschinell bewacht.

---

## 1. Dateigrößen-Verstöße

Architektur-Spec: Logic <150 Z., Controller <300 Z.

| Datei | Zeilen | Limit | Priorität |
|---|---|---|---|
| `js/games/chordExerciseEssentia/essentiaChordLogic.js` | 996 | 150 | HOCH |
| `js/games/sheetMusicReading/sheetMusicReading.js` | 809 | 300 | HOCH |
| `js/games/akkordfolgenTrainer/akkordfolgenTrainer.js` | 474 | 300 | MITTEL |
| `js/tools/chordRecorder/chordRecorder.js` | 418 | 300 | NIEDRIG |

### essentiaChordLogic.js (996 Z.)

Enthält vier trennbare Verantwortlichkeiten:
- Template-Aufbau → `essentiaChordTemplates.js`
- HPCP-Matching → bestehende Struktur behalten
- Bass-Scoring → `essentiaBassScore.js` existiert bereits
- Konfidenz-Evaluation → `essentiaChordEvaluation.js`

Aufwand: ~4 h. Vorhandene Tests (`essentiaChordLogic.test.js` etc.) können 1:1 übernommen werden.

### sheetMusicReading.js (809 Z.)

Mischt UI-Setup, State-Mutationen und Audio-Verarbeitung.  
Vorbild für Extraktion: `akkordfolgenAudioSession.js`-Pattern.  
Aufwand: ~8 h.

---

## 2. Sicherheit

| Befund | Datei | Priorität |
|---|---|---|
| `err.message` in `innerHTML` | `chordRecorder.js:395` | MITTEL |
| Kein Content-Security-Policy-Header | alle HTML-Seiten | MITTEL |

### Fix: err.message (chordRecorder.js:395)

```js
// Statt:
root.innerHTML = `<p class="cr-error">Mikrofon-Fehler: ${err.message}</p>`;

// So:
const p = document.createElement('p');
p.className = 'cr-error';
p.textContent = `Mikrofon-Fehler: ${err.message}`;
root.replaceChildren(p, backButton);
```

### CSP-Header

Alle HTML-Seiten brauchen ein Meta-Tag. Wichtig: Essentia benötigt `wasm-unsafe-eval`.

```html
<meta http-equiv="Content-Security-Policy"
  content="default-src 'self'; script-src 'self' 'wasm-unsafe-eval'; style-src 'self';">
```

---

## 3. Fehlende Testabdeckung

Alle Logic-Module haben Tests. Lücken in Controller-Ebene:

| Modul | Fehlender Testtyp | Priorität |
|---|---|---|
| `akkordTrainer.js` | Controller-Test | MITTEL |
| `tonFinder.js` | Controller-Test | MITTEL |
| `fretboardExercise.js` | Controller-Test | MITTEL |
| `essentiaChordDetection.js` | WASM-Init-Fehlerfall | HOCH |
| Audio-Pipeline end-to-end | Mock-Mic → Matching → UI | HOCH |

Die drei älteren Module (akkordTrainer, tonFinder, fretboardExercise) nutzen keine
Audio-Pipeline — Controller-Tests wären einfach und wertvoll.

---

## 4. Architektur-Schulden

### fretboardLogic.js doppelt vorhanden

- `js/domain/fretboard/fretboardLogic.js` (Domain-Layer)
- `js/games/fretboardToneRecognition/fretboardLogic.js` (Game-Layer)

Die Domain-Version sollte kanonisch sein. Game-Version migrieren oder löschen.

### Legacy-SVG-Module

Nicht mehr importiert, aber noch vorhanden:
- `js/games/tonFinder/tonFinderSVG.js` (165 Z.)
- `js/tools/guitarTuner/tunerSVG.js` (216 Z.)

Können nach Verifikation gelöscht werden.

### js/domain/-Layer dünn

Enthält nur `chords/` und `fretboard/`. Entweder konsequent befüllen
(alle domänen-übergreifenden Logic-Module dorthin) oder nach `js/shared/` integrieren
und `domain/` entfernen.

---

## 5. Teststatus: 32 bekannte Failures

`npm test` schlägt lokal fehl. CI ist grün (beide Dateien aus `test:audio:ci` ausgeschlossen,
seit Commit `67ae048`).

| Datei | Failures | Ursache |
|---|---|---|
| `essentiaChordAudio.test.js` | 29 | Chord-Matching unterhalb Konfidenz-Schwellwert |
| `essentiaBassScore.test.js` | 3 | Bass-Score < upperNeighbor.score (Inversion?) |

**Problem:** `CLAUDE.md` schreibt `npm test` vor dem Commit vor — das schlägt lokal fehl.
Entweder `npm test` auf `test:ci` angleichen, oder die vorgeschriebene Prozedur anpassen.

Empfehlung: Failures als `test.skip` mit erklärendem Kommentar markieren, bis der
Algorithmus stabil ist — damit sie nicht im normalen `npm test` rauschen.

---

## 6. Performance

| Thema | Befund | Priorität |
|---|---|---|
| Web Worker für Pitch-Detection | YIN/Essentia laufen auf Main Thread (~50 ms/Frame) | NIEDRIG |
| FFT-Fenstergröße 4096 | 93 ms Latenz, für E2 korrekt und dokumentiert | kein Handlungsbedarf |
| Essentia WASM (1,9 MB) | nach erstem Load gecached, kein Problem | kein Handlungsbedarf |

---

## 7. Empfehlungen (priorisiert)

### Sofort (<1 h)
- [ ] `chordRecorder.js:395`: `err.message` aus `innerHTML` → `textContent`
- [ ] CSP-Meta-Tag in alle HTML-Seiten
- [ ] `npm test`-Diskrepanz in `CLAUDE.md` klären

### Kurzfristig (1–4 h)
- [ ] Controller-Tests für `akkordTrainer`, `tonFinder`, `fretboardExercise`
- [ ] `fretboardLogic.js`-Dopplung auflösen
- [ ] Legacy-SVG-Module löschen (nach Import-Check)
- [ ] `essentiaBassScore`-Inversion untersuchen (3 Failures)

### Mittelfristig (4–8 h je Task)
- [ ] `essentiaChordLogic.js` aufteilen (Templates / Evaluation / Confidence)
- [ ] `sheetMusicReading.js` refaktorieren (Audio-Pipeline auslagern)
- [ ] WASM-Fehlerfall in `essentiaChordDetection` testen

### Langfristig
- [ ] Web Worker für Pitch-Detection evaluieren (Mobile-Performance)
- [ ] Playwright E2E für vollständige User-Flows

---

## 8. Weitere empfohlene Analysen

- **Coverage-Report** (`npm test -- --coverage`): Zeilencoverage, nicht nur ob Tests existieren
- **Lighthouse-Audit**: Performance, Accessibility, Best Practices auf Mobile
- **Mutationstests** (Stryker): Prüfen ob Logic-Tests tatsächlich Fehler finden
- **Bundle-Analyse**: Welche Imports blockieren den First Load (kein Bundler → viele Requests)
