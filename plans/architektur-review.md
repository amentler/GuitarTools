# Architektur-Review – GuitarTools

Stand: 2026-05-14 | Basis: letzter Review 2026-05-05 (`plans/architektur/code-review-2026-05-05.md`)

---

## Gesamtbewertung

Die Codebasis ist professionell strukturiert und zeigt eine konsequente Umsetzung des
Layer-Modells (Domain / Logic / Controller / Component / Shared). Architektur-Grenzen werden
maschinell durch `architectureBoundaryGuards.test.js` überwacht. Das Factory-Pattern mit
Lifecycle-API (`mount`/`unmount`) ist in allen 15 Features durchgängig implementiert.

Auffällig: Seit dem letzten Review (09 Tage) sind mehrere Controller-Dateien weiter gewachsen,
ohne Refaktorierung. `sheetMusicReading.js` ist um +271 Zeilen gewachsen (809 → 1080). Das
ist ein Indikator, dass das Dateigrößen-Limit nicht aktiv durchgesetzt wird.

**Kennzahlen (2026-05-14):**

| Metrik | Wert |
|---|---|
| JS-Dateien (ohne lib/) | ~130 |
| Anwendungscode gesamt | ~8.600 LOC |
| Games/Exercises | 7 |
| Tools | 8 |
| Web Components | 3 |
| Shared-Module | ~28 |
| Unit-Tests | 103 Dateien |
| E2E-Tests | 24 Specs |
| Production-Abhängigkeiten | 0 |

---

## 1. Layer-Architektur

### Bewertung: GUT

Das 6-Schichten-Modell ist klar definiert und weitgehend eingehalten:

```
Pages (pages/)
  ↓
Features (js/games/ + js/tools/)       ← Controller-Schicht
  ↓
Components (js/components/)            ← Web Components (zustandslos)
  ↓
Domain Logic (js/domain/ + *Logic.js)  ← Pure Functions, 100% Tests
  ↓
Shared (js/shared/)                    ← Audio, Storage, PWA, Debug
  ↓
Utils (js/utils/)                      ← Generische Helfer
```

**Positiv:**
- `architectureBoundaryGuards.test.js` verhindert unerlaubte Schicht-Überquerungen maschinell
- Alle 16 `*Logic.js`-Module haben Unit-Tests
- Shared-Dienste korrekt als injizierbare Factories implementiert

**Schwäche: `js/domain/` Layer ist dünn**

Der Domain-Layer enthält nur `chords/`, `fretboard/` und `pitch/`. Viele game-lokale
`*Logic.js`-Dateien (z.B. `akkordfolgenLogic.js`, `onsetTaggerLogic.js`) wären
konzeptionell Domain-Code, liegen aber beim jeweiligen Feature. Das ist pragmatisch
akzeptabel, sollte aber in `docs/architecture.md` explizit als Policy dokumentiert werden:
entweder konsequente Verschiebung in `js/domain/` oder klare Regel "Logic bleibt beim Feature".

---

## 2. Dateigrößen-Verstöße

Architektur-Spec (`docs/architecture.md` §4): Controller/Feature < 300 Z., Logic-Module < 150 Z.

### 2.1 Kritische Verstöße

| Datei | Ist | Limit | Δ seit 05.05. | Priorität |
|---|---|---|---|---|
| `js/games/sheetMusicReading/sheetMusicReading.js` | 1080 | 300 | **+271** | KRITISCH |
| `js/games/chordExerciseEssentia/essentiaChordLogic.js` | 996 | 150 | ±0 | KRITISCH |
| `js/tools/onsetTagger/onsetTagger.js` | 832 | 300 | NEU | HOCH |
| `js/tools/audioAnalyse/audioAnalyseSVG.js` | 840 | 300 | NEU | HOCH |
| `js/tools/chordRecorder/chordRecorder.js` | 780 | 300 | **+362** | HOCH |
| `js/games/akkordfolgenTrainer/akkordfolgenTrainer.js` | 474 | 300 | ±0 | MITTEL |
| `js/tools/audioAnalyse/audioAnalyse.js` | 416 | 300 | NEU | MITTEL |
| `js/tools/guitarTuner/tunerLogic.js` | 303 | **150** | NEU | MITTEL |

### 2.2 Grenzwertige Dateien (< 10% über Limit)

| Datei | Ist | Limit |
|---|---|---|
| `js/games/notePlayingExercise/notePlayingExercise.js` | 373 | 300 |
| `js/games/fretboardToneRecognition/fretboardExercise.js` | 334 | 300 |
| `js/games/chordExerciseEssentia/chordExerciseEssentia.js` | 320 | 300 |
| `js/tools/guitarTuner/guitarTuner.js` | 310 | 300 |

### 2.3 Akzeptable Ausnahmen

| Datei | Ist | Begründung |
|---|---|---|
| `js/shared/audio/guitarPitchDetection.js` | 407 | Komplexer YIN+HPS-Algorithmus, schlecht teilbar |
| `js/data/akkordData.js` | 737 | Reine Datendatei, kein Code |

### 2.4 Refaktorierungs-Empfehlungen

**`sheetMusicReading.js` (1080 Z., KRITISCH)**

Mischt UI-Setup, State-Mutations, Audio-Verarbeitung und VexFlow-Integration.
Vorgeschlagene Aufteilung (analog zu `akkordfolgenAudioSession.js`-Pattern):
- `sheetMusicState.js` – State-Maschine (score, currentNote, attempts)
- `sheetMusicAudioSession.js` – Audio-Pipeline-Setup + Teardown
- `sheetMusicReading.js` – reiner Controller (~150-200 Z.)
- Aufwand: ~6-8 h

**`essentiaChordLogic.js` (996 Z., KRITISCH)**

Vier trennbare Verantwortlichkeiten identifiziert:
- Template-Aufbau → `essentiaChordTemplates.js` (existiert partiell?)
- HPCP-Matching → bestehende Struktur behalten
- Bass-Scoring → `essentiaBassScore.js` existiert bereits
- Konfidenz-Evaluation → `essentiaChordEvaluation.js` neu
- Aufwand: ~4 h

**`chordRecorder.js` (780 Z., +362 Z. seit letztem Review)**

Ist seit 09 Tagen um 87% gewachsen. Sofortiger Stopp weiteren Wachstums, dann:
- `chordRecorderAudio.js` – Audio-Capture-Pipeline
- `chordRecorderUI.js` – DOM-Rendering-Funktionen
- `chordRecorder.js` – Koordination (~200 Z.)
- Aufwand: ~4 h

**`tunerLogic.js` (303 Z.) – Logic-Layer-Verstoß**

Logic-Module haben ein Limit von 150 Zeilen. 303 Zeilen sind doppelt so viel.
Prüfen ob sich Pitch-Kalibrierung, Note-Matching und Stimmungs-Berechnung
sauber trennen lassen.

---

## 3. Sicherheit

**Beide Befunde aus dem Review vom 05.05. sind OFFEN.**

### 3.1 XSS-Risiko: err.message in innerHTML (MITTEL)

**Datei:** `js/tools/chordRecorder/chordRecorder.js:743`

```js
// AKTUELLER CODE (unsicher):
root.innerHTML = `<p class="cr-error">Mikrofon-Fehler: ${err.message}</p>`;

// FIX:
const p = document.createElement('p');
p.className = 'cr-error';
p.textContent = `Mikrofon-Fehler: ${err.message}`;
root.replaceChildren(p, backButton);
```

Obwohl `err.message` typischerweise Browser-kontrolliert ist, sollte `innerHTML`
mit Nutzerdaten (inklusive Fehlermeldungen) nie direkt verwendet werden.
Fix: < 30 Minuten.

### 3.2 Kein Content-Security-Policy-Header (MITTEL)

Alle HTML-Seiten fehlen ein CSP-Meta-Tag. Empfohlene Konfiguration für diese App
(Essentia benötigt `wasm-unsafe-eval`):

```html
<meta http-equiv="Content-Security-Policy"
  content="default-src 'self'; script-src 'self' 'wasm-unsafe-eval'; style-src 'self';">
```

Aufwand: ~1 h (alle `pages/*/index.html` + `index.html` anpassen).

---

## 4. Architektur-Schulden

### 4.1 fretboardLogic.js-Duplizierung (OFFEN seit 05.05.)

Zwei Versionen der gleichen Datei existieren:
- `js/domain/fretboard/fretboardLogic.js` – kanonische Domain-Version
- `js/games/fretboardToneRecognition/fretboardLogic.js` – lokale Kopie

Die Game-Version sollte die Domain-Version importieren (oder gelöscht werden),
nicht eigenständig existieren. Aufwand: < 30 Min nach Import-Überprüfung.

### 4.2 Legacy-SVG-Module (OFFEN seit 05.05.)

Anscheinend nicht mehr aktiv importierte Dateien:
- `js/games/tonFinder/tonFinderSVG.js` (165 Z.)
- `js/tools/guitarTuner/tunerSVG.js` (216 Z.)

Vor dem Löschen mit `grep -rn "tonFinderSVG\|tunerSVG" js/` bestätigen,
dass keine Imports existieren. Aufwand: < 15 Min.

### 4.3 Unnötige Re-Export-Datei

`js/utils/chordDetectionUtils.js` ist eine 1-Zeilen-Datei die nur re-exportiert.
Alle Importstellen sollten direkt auf das Quell-Modul zeigen.

### 4.4 Service-Worker Asset-Management manuell

`sw.js` benötigt manuell gepflegte `ASSETS`-Liste. Jedes neue Asset muss manuell
eingetragen werden (und AGENTS.md verlangt das auch). Langfristig könnte ein
Build-Skript die Liste automatisch aus dem Dateisystem generieren.

### 4.5 docs/architecture.md nicht aktuell

Letztes Update: 2026-04-26. Fehlende Einträge:
- Tools-Schicht hat keine Dateigrößen-Konvention (nur Controller/Logic dokumentiert)
- Die 8 Tools sind als Kategorie kaum erwähnt
- Keine Aussage zur Positionierung von `*Logic.js` im Feature vs. in `js/domain/`

---

## 5. Testqualität

### 5.1 Bekannte Failures im Full-Suite

`npm test` schlägt lokal fehl (CI exkludiert die Dateien seit Commit `67ae048`):

| Datei | Failures | Ursache |
|---|---|---|
| `essentiaChordAudio.test.js` | 29 | Chord-Matching unter Konfidenz-Schwellwert |
| `essentiaBassScore.test.js` | 3 | Bass-Score < upperNeighbor.score (Inversion?) |

**Problem:** AGENTS.md schreibt `npm run test:precommit` vor Commits vor – das
funktioniert. Aber `npm test` (Full-Suite) schlägt lokal fehl, was verwirrend ist.

**Empfehlung:** Failures als `test.skip` mit Kommentar markieren:
```js
test.skip('FIXME: chord matching confidence below threshold – see plans/chord_recognition_improvement', () => { ... });
```

### 5.2 Fehlende Controller-Tests

| Modul | Fehlender Testtyp | Schwierigkeit |
|---|---|---|
| `akkordTrainer.js` | Mount/Unmount Controller-Test | EINFACH (kein Audio) |
| `tonFinder.js` | Mount/Unmount Controller-Test | EINFACH (kein Audio) |
| `fretboardExercise.js` | Mount/Unmount Controller-Test | EINFACH (kein Audio) |
| `essentiaChordDetection.js` | WASM-Init-Fehlerfall | MITTEL |

### 5.3 Coverage-Lücken

- Branches in Controller-Dateien werden nicht gemessen (nur `*Logic.js`)
- Kein Coverage-Report im CI-Workflow

---

## 6. SOLID-Analyse

### Single Responsibility Principle

**Verletzung:** `sheetMusicReading.js` (1080 Z.) ist das klarste Beispiel.
Koordiniert VexFlow-Rendering, Audio-Pipeline, Onset-Detection, Score-State,
Error-Handling und UI-Updates in einer Datei.

**Alle anderen Controller:** Weitgehend gut eingehalten. `guitarTuner.js` wurde
bereits aufgeteilt in `guitarTunerAudioSession.js`, `guitarTunerGuidedMode.js`,
`guitarTunerState.js`, `guitarTunerUI.js` – das ist das richtige Muster.

### Open/Closed Principle

Eingehalten durch das Factory-Pattern. Neue Features brauchen keine bestehenden
Module zu verändern.

### Dependency Inversion

Audio-Dienste (`audioSessionService`, `microphoneService`) werden korrekt als
Parameter injiziert, nicht direkt importiert. Gut.

**Schwäche:** Einige Controller importieren `storageService` direkt statt
Injektion – akzeptabel für eine App dieser Größe, aber nicht OCP-konform.

### Interface Segregation

Web Components haben kleine, fokussierte APIs (`<gt-fretboard>`, `<gt-exercise-header>`).
Gut.

---

## 7. Performance

| Thema | Befund | Handlungsbedarf |
|---|---|---|
| Pitch-Detection (YIN+HPS) | Main Thread, ~50 ms/Frame | Web Worker – langfristig |
| FFT-Fenstergröße 4096 | 93 ms Latenz, für E2 korrekt | keiner |
| Essentia WASM (1,9 MB) | gecacht nach erstem Load | keiner |
| ES Module Requests | viele parallele HTTP-Requests ohne Bundler | Lighthouse messen |
| Service Worker | Offline-Caching aktiv | keiner |

---

## 8. Empfehlungen (priorisiert)

### Sofort (< 1 h)
- [ ] `chordRecorder.js:743`: `err.message` aus `innerHTML` → `textContent`
- [ ] Legacy-SVG-Module prüfen und löschen (`tonFinderSVG.js`, `tunerSVG.js`)
- [ ] `fretboardLogic.js`-Duplizierung auflösen
- [ ] `test.skip` für bekannte Essentia-Failures mit erklärendem Kommentar

### Kurzfristig (1–4 h je Task)
- [ ] CSP-Meta-Tag in alle HTML-Seiten einfügen
- [ ] Controller-Tests für `akkordTrainer`, `tonFinder`, `fretboardExercise`
- [ ] `chordDetectionUtils.js` (1-Zeiler) entfernen, Imports direkt auf Source
- [ ] `docs/architecture.md` aktualisieren (Tools-Dateigrößen, domain-Layer-Policy)

### Mittelfristig (4–8 h je Task)
- [ ] `chordRecorder.js` aufteilen (Audio / UI / Controller)
- [ ] `sheetMusicReading.js` refaktorieren (State / AudioSession / Controller)
- [ ] `essentiaChordLogic.js` aufteilen (Templates / Evaluation / Matching)
- [ ] `tunerLogic.js` prüfen auf Teilbarkeit (über Logic-Limit von 150 Z.)

### Langfristig
- [ ] Web Worker für Pitch-Detection evaluieren (Mobile-Performance)
- [ ] Automatische SW-Asset-Liste aus Dateisystem generieren
- [ ] Coverage-Report in CI integrieren
- [ ] Lighthouse-Audit für Mobile-Performance
- [ ] Playwright E2E für vollständige User-Flows erweitern

---

## 9. Positive Hervorhebungen

1. **Architektur-Grenzen maschinell bewacht** – seltene Best Practice in Vanilla-JS-Projekten
2. **0 Production-Abhängigkeiten** – maximale Portabilität, kein Supply-Chain-Risiko
3. **Factory-Pattern + Lifecycle-API** konsistent in allen 15 Features umgesetzt
4. **Audio-Pipeline korrekt** – AudioSession-Lifecycle, Mikrofon-Cleanup, Context-Resume
5. **PWA vollständig** – Service Worker, Manifest, Offline-Cache, Update-Flow
6. **16 Logic-Module alle unit-getestet** – 100%-Coverage-Ziel aktiv verfolgt
7. **Web Components korrekt** – Lifecycle, Custom Events, reactive Attributes
8. **`guitarTuner` als Refaktorierungs-Vorbild** – erfolgreich in 4 Subdateien aufgeteilt

---

*Erstellt: 2026-05-14 | Vorheriges Review: `plans/architektur/code-review-2026-05-05.md`*
