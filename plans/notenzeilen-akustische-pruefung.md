# Plan: Akustische Prüfung von Notenzeilen beim Gitarrenspiel

**Status:** In Überarbeitung – Fehleranalyse abgeschlossen ⏳  
**Typ:** Übung / Audio-Erkennung  
**Stand:** 2026-04-11 (Fehleranalyse & Plan-Korrektur)  
**Betrifft Modul:** `js/games/sheetMusicMic/` (Menüeintrag „Noten spielen") und – nachgelagert – das verwandte `js/games/notePlayingExercise/` („Ton spielen"), das denselben Audio-Pfad nutzt.

---

## Ziel

Eine Übung soll prüfen, ob eine vorgegebene Notenzeile auf der Gitarre akustisch korrekt gespielt wird.
Dabei ist **nicht** die hohe Präzision eines Stimmgeräts das Hauptziel, sondern eine **möglichst schnelle und robuste Notenerkennung** für Gitarrentöne.

Die Übung soll dadurch musikalisch flüssiges Spielen unterstützen: richtige Töne sollen schnell akzeptiert werden, leichte Verstimmungen dürfen toleriert werden, und kurze Fehlframes durch Anschlag oder Nebengeräusche sollen nicht sofort zu Fehlauswertungen führen.

---

## Aktuelle Fehleranalyse (2026-04-11)

Eine statische Analyse des bestehenden Codes zeigt einen konkreten Bug, der das aktuelle Fehlverhalten weitgehend erklärt. Er muss vor oder parallel zur fachlichen Überarbeitung behoben werden.

### Symptom

Die Übung „Noten spielen" akzeptiert Töne unzuverlässig, insbesondere tiefe Saiten werden häufig gar nicht oder falsch erkannt.

### Ursache

Sowohl `js/games/sheetMusicMic/sheetMusicMicExercise.js` (Zeile ~208) als auch `js/games/notePlayingExercise/notePlayingExercise.js` (Zeile ~105) setzen beim Initialisieren der `AnalyserNode`:

```js
analyser.fftSize = 2048;
```

und lesen je Frame `new Float32Array(analyser.fftSize)` — also **2048 Samples** (~46 ms bei 44,1 kHz). Damit kollidiert die Konfiguration mit dem gemeinsam genutzten `detectPitch` aus `tunerLogic.js`:

1. `detectPitch` wird ohne `referenceHz` aufgerufen, nutzt also `minFreq = GUITAR_MIN_FREQUENCY = 70 Hz`.
2. Wegen `minFreq < 120` greift intern `minPeriods = 4`.
3. `detectPitchYin` verlangt dann `buffer.length ≥ (sampleRate / minFreq) * minPeriods = (44100 / 70) * 4 ≈ 2520 Samples`.
4. **2048 < 2520 → `detectPitchYin` gibt für jeden einzelnen Frame sofort `null` zurück.**
5. Es verbleibt nur `detectPitchHps` auf 2048 Samples. Dessen Bin-Auflösung ist `44100 / 2048 ≈ 21,5 Hz`. Zwischen E2 (82,4 Hz) und F2 (87,3 Hz) liegen rund 4,9 Hz — **deutlich weniger als ein Bin**. Halbtöne auf den tiefen Saiten sind so algorithmisch schlicht nicht zu trennen, und der Median verrutscht bei jedem Anschlag.

### Zusätzliche Schwachstellen im gleichen Audiopfad

- **Feste `pushAndMedian` über 5 Werte bei 100 ms Interval** → effektive Smoothing-Fenster ≈ 500 ms. Für den Tuner korrekt, für flüssiges Notenzeilen-Spiel zu träge.
- **Keine adaptive Fenstergröße** wie im Tuner (`getAdaptiveFftSize`).
- **Keine Zielnotenkenntnis** → `detectPitch` sucht jeden Frame über den vollen Gitarrenbereich.
- **Ringing der Vorgängernote** wird weder durch Onset-Sperre noch durch Referenznote erkannt.

### Minimal-Fix (Regression-Guard)

Unabhängig von der geplanten fachlichen Umgestaltung sollte die `fftSize` in beiden Übungen sofort an die Anforderungen des YIN-Pfads angepasst werden (oder `detectPitch` mit einem passenden `referenceHz` aufgerufen werden, das den internen `minFreq` anhebt). Der dauerhafte Zielzustand ist allerdings der adaptive Schnell-Erkennungsmodus, der weiter unten beschrieben ist.

---

## Fachliche Anforderungen

- Die richtige **klingende Note** muss erkannt werden, nicht exakte Cent-Genauigkeit.
- Leichte Verstimmungen sollen weiterhin als korrekt gelten.
- Notenwechsel innerhalb einer Zeile müssen schnell erkannt werden.
- Anschlag-Transienten, kurzes Nachklingen und einzelne Fehlframes dürfen die Bewertung nicht sofort verfälschen.
- Eine falsche Oktave muss als falsch erkannt werden.
- Falls nur die Tonhöhe geprüft wird, soll dieselbe klingende Note auf anderer Saite oder anderer Lage ebenfalls als korrekt gelten.
- Rhythmusbewertung ist nicht Teil der ersten Ausbaustufe und sollte getrennt betrachtet werden.

---

## Ausgangslage im Projekt

Bereits vorhanden sind im Projekt:

- ein präziser Pitch-Detection-Pfad im Tuner (`detectPitch`, `frequencyToNote`, Vorfilterung, Median-Stabilisierung)
- Fixture-Tests mit echten Gitarrenaufnahmen in `tests/fixtures/audio/{Note}/` und `tests/fixtures/audio-imprecise/{Note}/`
- Fixture-Tests mit synthetischen Sinuswellen in `tests/fixtures/synth/{Note}/`
- bestehende Mikrofon-Übungen `notePlayingExercise` („Ton spielen") und `sheetMusicMic` („Noten spielen")
- bereits vorhandene, aber ungenutzte **Zielnotensuche** in `detectPitch(buffer, sampleRate, { referenceHz })`: Setzt man `referenceHz`, verengt sich der Suchraum automatisch auf `[referenceHz × 0,55 … referenceHz × 1,8]`. Genau der Hebel, den die Notenzeilen-Übung braucht.
- bereits vorhandene adaptive FFT-Größen über `getAdaptiveFftSize(referenceHz)`

Für die neue Übung sollte **kein reiner Tuner-Ansatz 1:1 übernommen** werden, da der aktuelle Fokus dort auf Stabilität und Genauigkeit liegt. Für die Notenzeilen-Prüfung wird stattdessen ein eigener, auf Geschwindigkeit optimierter Prüfpfad benötigt — der aber die bereits vorhandenen Bausteine (`detectPitch({referenceHz})`, `getAdaptiveFftSize`, `applyGuitarBandpass`, `dampAttack`) wiederverwendet.

---

## Empfohlene Erkennungsstrategie

### 1. Separater Schnell-Erkennungsmodus

Neben dem präzisen Tuner sollte ein eigener Erkennungsmodus für die Übung entstehen:

- optimiert auf schnelle Note+Oktave-Erkennung
- toleranter gegenüber leichter Verstimmung
- kürzere Stabilitätslogik als im Tuner
- keine UI-Anzeige in Cent notwendig

### 2. Zielgerichtete statt freie Vollsuche

Für die aktuelle Note in der Notenzeile sollte die Erkennung nicht den gesamten Gitarrenbereich gleich behandeln.
Stattdessen sollte die Analyse die **aktuelle Zielnote** berücksichtigen:

- aktuelle Zielnote
- optional vorherige / nächste Note der Sequenz
- optional benachbarte Halbtöne als Fehlkandidaten

Dadurch kann der Suchraum kleiner werden, was die Erkennung beschleunigt und Fehlklassifikationen reduziert.

**Konkrete Umsetzung:** `detectPitch` unterstützt bereits `options.referenceHz`. Wird dieser auf `noteToFrequency(targetNote, targetOctave)` gesetzt, verengt sich `minFreq` auf `targetHz × 0,55` und `maxFreq` auf `targetHz × 1,8`. Das senkt automatisch den für YIN nötigen `minPeriods`-Schwellwert (wenn `minFreq ≥ 120 Hz`, reichen `minPeriods = 3`), erlaubt damit kleinere Fenster und eliminiert zudem Subharmonien-Fehler unterhalb der Zielnote.

### 3. Note-Klassifikation statt Tuner-Präzision

Die Übung soll nicht primär mit Cent-Abweichung entscheiden, sondern mit einer robusten Klassifikation auf:

- **richtige Note+Oktave**
- **falsche Note**
- **unsicher / noch nicht stabil**

---

## Technische Empfehlung zu Algorithmen

### Primär empfohlen

Ein schneller zeitdomänenbasierter Pitch-Ansatz ist für Gitarrentöne am sinnvollsten:

- **McLeod Pitch Method (MPM / NSDF)** oder
- **vereinfachtes YIN / CMNDF** mit eingeschränktem Suchbereich

Begründung:

- gut geeignet für monophone Gitarrensignale
- schnell genug für kurze Analysefenster
- robust gegen typische Obertonstruktur von Gitarrensaiten
- browserfreundlich ohne schwere Infrastruktur

### Unterstützende Maßnahmen

Zusätzlich sinnvoll:

- Gitarren-Bandpass
- RMS-/Noise-Gate
- Attack-Dämpfung oder kurze Onset-Sperre direkt nach dem Anschlag
- optionale Zweitmeinung bei niedriger Konfidenz (z. B. HPS oder spektrale Plausibilitätsprüfung)

### Nicht als erste Wahl

Schwere Frameworks oder große Audio-ML-Lösungen sollten zunächst vermieden werden, solange ein leichter klassischer Ansatz ausreicht.

---

## Analyse-Ablauf

### 1. Audio-Erfassung

- Mikrofon über Web Audio API
- kontinuierliches Sampling mit überlappenden Analysefenstern
- Analyse-Callback-Intervall **≈ 30–50 ms** (schneller als die 100 ms der bisherigen Übung, aber nicht schneller als der Tuner bei 50 ms)
- **Wichtiger Hinweis zur Latenz:** Das Callback-Intervall bestimmt nur, wie oft eine neue Analyse angestoßen wird. Die **tatsächliche Bestätigungslatenz** wird durch die Fenstergröße und die Mindestanzahl geforderter stabiler Frames bestimmt und ist untereinander entkoppelt. Für E2 bei einem 4096-Sample-Fenster liegt die untere Grenze bereits bei ~93 ms zuzüglich Streak-Zeit. 20 ms Callback-Intervall bringt also keinen Gewinn, wenn das Fenster noch nicht neu gefüllt ist.

### 2. Adaptive Fenstergröße

Je nach Zielnote unterschiedliche Fenstergrößen. Die Werte orientieren sich am YIN-internen Minimum `bufferLen ≥ (sampleRate / minFreq) × minPeriods` mit `referenceHz`-verengtem Suchraum:

| Zielnote | minFreq (Hz) | minPeriods | YIN-Minimum @44,1 kHz | Empfohlene fftSize |
|----------|--------------|-----------:|----------------------:|-------------------:|
| E2 (82 Hz) | ≈ 45 | 4 | ~3920 Samples | **8192** |
| A2 (110 Hz) | ≈ 60 | 4 | ~2940 Samples | **4096** |
| D3 (147 Hz) | ≈ 81 | 4 | ~2180 Samples | **4096** |
| G3 (196 Hz) | ≈ 108 | 4 | ~1640 Samples | **2048** |
| B3 (247 Hz) | ≈ 136 | 3 | ~ 980 Samples | **2048** |
| E4 (330 Hz) | ≈ 182 | 3 | ~ 730 Samples | **2048** |
| C5+ (523 Hz) | ≈ 288 | 3 | ~ 460 Samples | **2048** |

`minPeriods` folgt der heutigen Regel in `tunerLogic.js::detectPitch`: `minPeriods = minFreq < 120 ? 4 : 3`. Die 120-Hz-Grenze bezieht sich auf die **verengte** `minFreq`, nicht auf die Zielfrequenz.

`getAdaptiveFftSize(referenceHz)` aus `tunerLogic.js` liefert bereits eine ähnliche Abstufung (32768 / 16384 / 8192) — das ist für den Tuner passend konservativ, für die Notenzeilen-Übung aber zu träge. Entweder eine neue Funktion `getFastFftSize(referenceHz)` nach obiger Tabelle einführen oder `getAdaptiveFftSize` um einen `mode: 'fast' | 'precise'` erweitern.

**Muss-Bedingung:** In keiner Konfiguration darf `fftSize` unter das YIN-Minimum der aktuellen Zielnote fallen — sonst liefert YIN wie im aktuellen Bug dauerhaft `null`. Das ist als expliziter Unit-Test abzusichern (siehe Testplan).

Ziel ist ein Kompromiss zwischen:

- genügend Perioden für tiefe Töne
- möglichst geringer Latenz bei höheren Tönen

### 3. Vorverarbeitung

Vor jeder Tonerkennung:

- RMS-Prüfung / Noise-Gate
- Gitarren-Bandpass
- leichte Attack-Dämpfung oder kurzes Ignorieren direkt nach Onset
- optional Pegelnormalisierung

### 4. Pitch-Schätzung

- Tonhöhenkandidat im erwarteten Frequenzraum bestimmen
- Ergebnis auf nächste Note+Oktave abbilden
- zusätzlich Konfidenz oder Qualitätsmaß erfassen

### 5. Entscheidungslogik

Statt langer Median-Ketten:

- kurze Stabilitätslogik, z. B. **2 aus 3 letzten Frames** für „correct"
- richtige Zielnote wird schnell bestätigt
- unsichere Frames werden vorerst neutral behandelt
- falsche Einzel-Frames führen nicht sofort zum Fehler
- für den „schwer"-Modus wird ein separater **Wrong-Streak** geführt (z. B. „3 aus 4 konsekutiven Frames auf Halbton-/Oktav-Nachbar" → wrong), so dass Ringing der Vorgängernote nicht sofort als Fehler zählt

Der Zustand ist damit ein 3-Wertiges Ergebnis je Frame:
`correct` | `wrong` | `unsure` — nicht nur `correct/else` wie im bestehenden Code.

### 6. Fortschalten in der Übung

Sobald die aktuelle Zielnote mit ausreichender Konfidenz bestätigt wurde:

- Note als korrekt markieren
- sofort oder mit sehr kurzer Pause zur nächsten Note wechseln
- Restschwingung der vorherigen Note kurz tolerieren

---

## Toleranzmodell

Da keine Tuner-Präzision gefordert ist, sollte intern ein bewusst gröberes Akzeptanzmodell verwendet werden.

Empfohlener Startbereich:

- Akzeptanzfenster etwa **±30 bis ±40 Cent**
- bei sehr tiefen Tönen ggf. leicht großzügiger

Wichtig ist dabei:

- richtige Note schnell akzeptieren
- leichte Verstimmung tolerieren
- Oktavfehler nicht akzeptieren
- Halbtonfehler zuverlässig abweisen

---

## Open-Source-Optionen

**Vorläufige Empfehlung: keine externe Bibliothek einführen.**

Das Projekt hat bereits eine ausgereifte YIN + HPS-Pipeline in `tunerLogic.js`, inklusive Bandpass, Attack-Dämpfung, Subharmonien-Check und 5-Punkt-Parabelinterpolation. Der Aufwand, diese durch eine externe Bibliothek zu ersetzen, ist höher als der Aufwand, sie um einen „schnellen" Modus zu erweitern. Außerdem würden fremde Libraries den Vanilla-JS-/No-Build-Ansatz des Projekts aufweichen.

Eine externe Bibliothek sollte nur dann evaluiert werden, wenn ein konkreter Test-Satz beweist, dass der erweiterte interne Pfad die Akzeptanzkriterien nicht erreicht.

---

## Empfohlene Architektur im Repository

### Neuer fachlicher Baustein

Für diese Übung sollte ein separater Logik-Baustein vorgesehen werden, statt die Tuner-Logik direkt umzuwidmen.

Vorgeschlagene Trennung:

- **präziser Tuner-Pfad** bleibt für Stimmung / Cents-Anzeige zuständig
- **schneller Notenzeilen-Prüfpfad** bewertet nur die gespielte Zielnote

### Konkreter Vorschlag für Dateien

```
js/games/sheetMusicMic/
  sheetMusicMicExercise.js   ← Controller (heute ~400 LOC, wird entschlackt)
  sheetMusicMicSVG.js        ← VexFlow-Render (bleibt)
  fastNoteMatcher.js         ← NEU, reine Logik, frei von DOM/Audio
  CLAUDE.md                  ← NEU, dokumentiert Matcher-API und Defaults
```

### API-Skizze `fastNoteMatcher.js`

Kernidee: eine einzige reine Funktion pro Frame. Zustand wird extern gehalten, damit Tests jederzeit frame-für-frame simulieren können.

```js
// Ein-Frame-Klassifikation gegen eine Zielnote.
export function classifyFrame(samples, sampleRate, targetPitch, options = {}) {
  // targetPitch: "E2" | "C#4" | ...
  // options: { minRms, tolerateCents = 35 }
  // Returns: { status: 'correct'|'wrong'|'unsure',
  //            detectedPitch: "E2"|null,
  //            hz: number|null,
  //            cents: number|null }
}

// Entscheidungslogik über mehrere Frames. Kein eigener Timer, keine DOM.
// Aufrufer übergibt das nach jedem Frame zurückgegebene State-Objekt erneut.
export function updateMatchState(state, frameResult) {
  // state: { correctStreak, wrongStreak, accepted, rejected }
  // returns: { nextState, event: 'accept'|'reject'|null }
}

// Helferfunktionen, die die Konstanten zentral halten:
export const FAST_ACCEPT_STREAK   = 2;   // 2 aus 2 korrekten Frames
export const FAST_REJECT_STREAK   = 3;   // 3 aus 3 wrong-Frames → reject
export const FAST_CENTS_TOLERANCE = 35;  // ±35 Cent Akzeptanzfenster
```

`classifyFrame` ruft intern:
1. `analyzeInputLevel` (Noise-Gate)
2. `applyGuitarBandpass` + `dampAttack`
3. `detectPitch(prepared, sampleRate, { referenceHz: noteToFrequency(targetPitch) })`
4. `frequencyToNote(hz)` → Vergleich mit Zielnote

### Integration in den Controller

`sheetMusicMicExercise.js` wird dahingehend geändert, dass es:

- `analyser.fftSize` anhand der aktuellen Zielnote auf den Wert aus der obigen Tabelle setzt (und nur dann neu setzt, wenn sich die Zielnote tatsächlich in eine andere Oktave-/Frequenzklasse bewegt, sonst gibt es hörbares Klicken)
- das Callback-Intervall von 100 ms auf 40 ms senkt
- je Frame `classifyFrame` + `updateMatchState` aufruft
- auf `event === 'accept'` die Note als richtig markiert
- auf `event === 'reject'` im „schwer"-Modus neu startet

`notePlayingExercise.js` bekommt denselben Pfad. Beide Controller teilen sich den Matcher.

### Wiederverwendbare Bausteine

Weiter nutzbar oder adaptierbar:

- `noteToFrequency` / `frequencyToNote`
- `applyGuitarBandpass`, `dampAttack`, `analyzeInputLevel`, `detectPitch({ referenceHz })`
- Audio-Fixture-Teststruktur
- bestehende Mikrofon-Übungs-Controller als Integrationsvorbild

### Testbare Logik

Die Kernerkennung sollte möglichst als reine Logik kapselbar sein, damit sie mit:

- synthetischen Sinuswellen
- echten Gitarrenaufnahmen
- Übergangs- und Fehlerszenarien

automatisiert geprüft werden kann.

---

## Testplan

Der Testplan ist bewusst in drei Ebenen gegliedert, weil jede eine andere Aussage trifft:

| Ebene | Art | Zweck |
|-------|-----|-------|
| **A. Regressions-Unit-Tests** | rein synthetisch, deterministisch | fachliche Korrektheit jedes einzelnen Bausteins — laufen in <1 s in der CI |
| **B. Synthetische Simulationstests** | Frame-für-Frame, deterministisch | messen Latenz und Sequenzverhalten ohne echten Ton |
| **C. Gitarren-Aufnahmen** (vom Nutzer einspielbar) | reale WAV-Fixtures | robustes End-to-End-Verhalten gegen echte Gitarrensignale |

---

### Ebene A – Synthetische Unit-Tests (deterministisch, schnell)

Datei: `tests/unit/fastNoteMatcher.test.js` (neu). Helper nutzen die bereits vorhandene `synth(freq, sr, n, amp)`-Funktion aus `tunerAudio.test.js`.

#### A1. Grundverhalten `classifyFrame`

Für jede Zielnote E2, A2, D3, G3, B3, E4, C5:

- **A1a** Perfekter Sinus auf Zielfrequenz → `status === 'correct'`, Note+Oktave korrekt.
- **A1b** Sinus auf Zielfrequenz +20 Cent → `status === 'correct'` (innerhalb Toleranz).
- **A1c** Sinus auf Zielfrequenz +35 Cent → `status === 'correct'` (Grenzfall, innerhalb).
- **A1d** Sinus auf Zielfrequenz +50 Cent → `status !== 'correct'` (außerhalb Toleranz).
- **A1e** Sinus auf Halbton oberhalb (Zielfrequenz × 2^(1/12)) → `status === 'wrong'`.
- **A1f** Sinus auf Halbton unterhalb → `status === 'wrong'`.
- **A1g** Sinus eine Oktave oberhalb → `status === 'wrong'`.
- **A1h** Sinus eine Oktave unterhalb → `status === 'wrong'`.
- **A1i** Stille / Rauschen unterhalb `GUITAR_MIN_RMS` → `status === 'unsure'`, `detectedPitch === null`.

#### A2. Buffergrößen-Regression

Muss-Tests, die den heute aktiven Bug dauerhaft verhindern:

- **A2a** Für jede Zielnote: die empfohlene `fftSize` ist groß genug, dass `detectPitch({ referenceHz })` auf einem reinen Sinus der Zielfrequenz **nicht null** zurückgibt. Das ist der Regressionsschutz gegen „YIN liefert nie etwas".
- **A2b** Für E2 bei `fftSize = 2048` muss der Matcher **explizit** `status === 'unsure'` liefern (oder das Modul wirft, wenn man es so falsch konfiguriert) — damit der heutige Fehler sichtbar wird, wenn jemand die Größe versehentlich wieder absenkt.

#### A3. `updateMatchState`-Logik (rein funktional)

- **A3a** Zwei aufeinanderfolgende `correct`-Frames → `event === 'accept'`.
- **A3b** Ein `correct`, dann ein `unsure`, dann ein `correct` → kein Accept (Streak wurde unterbrochen — alternative Regel „2 aus 3" ist bewusst explizit zu entscheiden, Test folgt der gewählten Regel).
- **A3c** Drei aufeinanderfolgende `wrong`-Frames → `event === 'reject'`.
- **A3d** Ein `wrong`-Frame zwischen zwei `correct` → weder Accept noch Reject.
- **A3e** Nach `accept` bleibt der State idempotent, bis er extern zurückgesetzt wird.

#### A4. Guitar-ähnlichere Synthetik

- **A4a** Grundton + 2. Harmonische (Amp 0,5) + 3. Harmonische (Amp 0,25) auf jeder Zielnote → `correct`. Deckt das Subharmonien-Verhalten ab (aktueller YIN-Pfad ist hier bekannt empfindlich auf B3/E4 — Regressionsschutz).
- **A4b** Exponentiell abklingender Sinus (Amp `e^(-t/0.5)`) → `correct` innerhalb der ersten 300 ms, danach darf Gating greifen.
- **A4c** Sinus mit Anfangsimpuls (ein Sample auf ±1,0 am Start, sonst sauber) → erster Frame darf `wrong`/`unsure` sein, aber innerhalb weniger Frames `correct`.

---

### Ebene B – Latenz- und Sequenzsimulation

Datei: `tests/unit/fastNoteMatcherLatency.test.js` (neu). Die Tests sind immer noch deterministisch, aber sie simulieren die laufende Übung Frame für Frame.

Hilfsfunktion (Skizze):

```js
// Returns the frame index at which the matcher first emits 'accept'.
function framesUntilAccept(samples, sampleRate, targetPitch, fftSize, hopSize)
```

#### B1. Bestätigungslatenz je Zielnote

Für jede Zielnote eine Grenze definieren (Startwerte, ggf. nach erster Messung feinjustieren):

| Zielnote | fftSize | Maximale Latenz bis `accept` |
|----------|--------:|------------------------------:|
| E2       | 8192    | ≤ 300 ms |
| A2       | 4096    | ≤ 200 ms |
| D3       | 4096    | ≤ 200 ms |
| G3       | 2048    | ≤ 150 ms |
| B3       | 2048    | ≤ 150 ms |
| E4       | 2048    | ≤ 150 ms |

Zählung: ab dem Zeitpunkt, zu dem der vorherige Frame noch `unsure` war.

#### B2. Notenwechsel-Latenz

- **B2a** E4-Sinus 400 ms, hart überblendet auf F4-Sinus 400 ms → F4 wird nach höchstens `N` Frames als `accept` erkannt (Zielwert ≤ 200 ms nach dem Wechsel).
- **B2b** Gleiches mit 50 ms Stille als Übergangspause — Akzeptanzlatenz muss besser oder gleich sein.
- **B2c** E4-Sinus, der exponentiell ausklingt, überlagert mit neu einsetzendem F4 (Ringing-Simulation) — F4 wird akzeptiert, **ohne** dass E4 vorher als `wrong` zum Reject geführt hat.

#### B3. Gleicher Ton mehrfach hintereinander

- **B3a** 4×E4, je 300 ms, getrennt durch 80 ms Stille → genau 4 separate `accept`-Events.
- **B3b** 4×E4 ohne Pause, nur kleine Amplitude-Modulation → mindestens 2 `accept`-Events (wir verlangen nicht 4, weil ohne Onset-Trennung Attack-Detection nötig wäre, die dieser Baustein explizit nicht abdeckt).

#### B4. Oktavsprung in Sequenz

- **B4a** Sequenz E2 → E3 → E4 (je 400 ms). Für jeden Ton wird die jeweils korrekte Oktave akzeptiert, kein Ton wird mit einem anderen verwechselt.
- **B4b** Sequenz C-Dur-Tonleiter C3 bis C4 → alle Töne werden in Reihenfolge akzeptiert.

#### B5. Rausch- und Pegel-Grenzfälle

- **B5a** Sinus + weißes Rauschen mit SNR ≈ 20 dB → `accept` innerhalb der B1-Grenzen.
- **B5b** Sinus knapp oberhalb `GUITAR_MIN_RMS` (Amplitude 0,02) → `accept` (Low-Level-Akzeptanz).
- **B5c** Nur Rauschen ohne Zielton → **nie** `accept` über 2 s Simulation.

---

### Ebene C – Echte Gitarrenaufnahmen

**Vorhandene Fixtures** (bereits nutzbar ohne neue Aufnahmen):

- `tests/fixtures/audio/E2|A2|D3|G3|B3|E4/*.wav` – gut gestimmte Einzeltöne
- `tests/fixtures/audio-imprecise/B3|E4/*.wav` – leicht verstimmte Einzeltöne
- `tests/fixtures/synth/{33 Noten}/synth.wav` – reine Sinuswellen E2–C5

Diese sollten zusätzlich zur bestehenden Tuner-Prüfung auch durch den neuen `fastNoteMatcher` laufen — in einer neuen Test-Datei `tests/unit/fastNoteMatcherAudio.test.js`, nach dem gleichen Ordner-Scan-Muster wie `tunerAudio.test.js`.

**Neue Aufnahmen, die du einspielen kannst** — jede Datei landet in ihrem Ordner, Dateiname frei wählbar:

#### C1. Einzeltöne für die Basisabdeckung

Ziel: je Note mindestens eine klar gespielte Aufnahme, ca. 1–2 Sekunden, Ruhe vor und nach dem Ton.

```
tests/fixtures/audio/C3/…wav  A#2/…wav  B2/…wav  C#3/…wav  D#3/…wav  F3/…wav  F#3/…wav
tests/fixtures/audio/G#3/…wav A3/…wav   C4/…wav  D4/…wav   F4/…wav   G4/…wav  A4/…wav
tests/fixtures/audio/B4/…wav  C5/…wav   D5/…wav  E5/…wav   F5/…wav   G5/…wav
```

Gut gestimmte Einzeltöne aller Halbtöne, die innerhalb der Standard-Settings (max Bund 5, alle 6 Saiten) vorkommen. Aktuell fehlen besonders C3–D#3, F3–G#3, A#3, C4–G5.

#### C2. Gleicher Ton auf verschiedenen Saiten/Lagen

Dateinamen-Konvention: `E4-string{N}-fret{M}.wav`. Reicht je Ton 2–3 Varianten.

- E4 auf: offenes hohes E, B3-Saite Bund 5, G3-Saite Bund 9
- A3 auf: G3-Saite Bund 2, D3-Saite Bund 7, A2-Saite Bund 12
- C4 auf: B3-Saite Bund 1, G3-Saite Bund 5, D3-Saite Bund 10

Grund: Obertonstruktur unterscheidet sich je nach Lage; Matcher muss jede Variante akzeptieren.

#### C3. Leichte Verstimmung (Regressionsschutz „≤ 35 Cent → correct")

Neuer Ordner `tests/fixtures/audio-imprecise/` (bereits vorhanden, nur erweitern):

```
tests/fixtures/audio-imprecise/E2/…wav  A2/…wav  D3/…wav  G3/…wav  B3/…wav  C4/…wav
```

Je Datei: sauber gespielter Ton, Saite absichtlich leicht verstimmt (ca. ±15 bis ±30 Cent). Zielnote ist in beiden Fällen der Ordnername.

#### C4. Grenzfälle der Akzeptanz

Neuer Ordner `tests/fixtures/audio-edge/`:

- `halftone-off/E4-played-F4.wav` – F4 gespielt, Test prüft, dass gegen Ziel E4 `status !== 'correct'`
- `octave-off/E2-played-E3.wav` – E3 gespielt, Ziel E2, darf nicht akzeptiert werden
- `pre-click/E4.wav` – kurzer Fehlanschlag, dann sauberer E4
- `ringing/E4-then-F4-overlap.wav` – E4 klingt noch nach während F4 einsetzt
- `quiet/E4-soft.wav` – sehr leise gespielt (knapp über Noise-Gate)
- `loud/E2-strong.wav` – sehr kräftig angeschlagenes E2 (Attack-Impuls)

#### C5. Sequenzen (Notenzeilen)

Neuer Ordner `tests/fixtures/sequences/`. Jede Aufnahme braucht eine Beschreibung der erwarteten Notenfolge. Einfachstes Format: eine `.json`-Datei neben der `.wav` oder der Dateiname trägt die Sequenz.

Vorgeschlagenes Schema für automatisches Einlesen:

```
tests/fixtures/sequences/
  slow/c-major-asc.wav      + c-major-asc.json  { "notes": ["C3","D3","E3","F3","G3","A3","B3","C4"] }
  slow/leaps.wav            + leaps.json       { "notes": ["E2","E4","E3","E2"] }
  medium/chromatic-up.wav   + chromatic-up.json
  fast/scale-fast.wav       + scale-fast.json
  repeat/e4-x4.wav          + e4-x4.json       { "notes": ["E4","E4","E4","E4"] }
  legato/hammer-on.wav      + hammer-on.json   { "notes": ["E3","G3"], "note": "ein Anschlag, zwei Töne" }
```

Testerwartung: Für jede Sequenz wird der `fastNoteMatcher` frame-für-frame gefüttert; die Reihenfolge der `accept`-Events muss die Soll-Sequenz ergeben (ggf. mit Toleranz für Anzahl der Events, wenn Ringing vorkommt).

#### C6. Umgebungsbedingungen

Gleiche Sequenz (z. B. `sequences/slow/c-major-asc.wav`) zusätzlich einmal aufnehmen in:

- `sequences/env/quiet.wav` – Ruheraum
- `sequences/env/living.wav` – normale Wohnumgebung, Grundrauschen
- `sequences/env/typing.wav` – Tastaturgeräusche im Hintergrund
- `sequences/env/strum-bleed.wav` – Nachbarsaiten klingen mit

---

### Schnell-Checkliste für den Nutzer

Wenn du nur etwas Zeit zum Einspielen hast, bringen folgende Aufnahmen den **höchsten Testwert**:

1. **Chromatische Leiter** auf einer Saite, langsam, klar getrennt (Datei `sequences/slow/chromatic-up.wav`) — deckt Latenz, Halbton-Unterscheidung und Sequenzfortschritt auf einen Schlag ab.
2. **Einzeltöne C3, F3, B3, C4, F4, G4** — schließt die größten Lücken in `tests/fixtures/audio/`.
3. **Ringing-Fall** `E4-then-F4-overlap.wav` — härtester Stress-Test für den Übergang.
4. **Oktav-Falsch** `octave-off/E2-played-E3.wav` — deckt die häufigste Fehlklassifikation ab.
5. **Ein leises E4 und ein kräftiges E2** — testet dynamischen Bereich.

---

## Fachliche Akzeptanzkriterien

Die Lösung ist fachlich geeignet, wenn sie folgende Ziele erfüllt:

- richtige Gitarrentöne werden spürbar schneller erkannt als im präzisen Tuner-Pfad
- leichte Verstimmung verhindert die Anerkennung nicht unnötig
- falsche Halbtöne werden zuverlässig abgelehnt
- falsche Oktaven werden zuverlässig abgelehnt
- kurze Anschlagartefakte führen nicht zu voreiligen Fehlentscheidungen
- Notenwechsel in einer Notenzeile werden schnell genug erkannt, um flüssiges Spielen zu ermöglichen

---

## Empfohlene Umsetzungsreihenfolge

1. **Regression sichern:** Ebene-A-Tests A2a/A2b schreiben, die die aktuelle Buffergröße von 2048 als fachlich fehlerhaft markieren. Diese Tests schlagen zunächst gegen den heutigen Code fehl und werden grün, sobald Schritt 2 abgeschlossen ist.
2. **Sofort-Fix `fftSize`:** In `sheetMusicMicExercise.js` und `notePlayingExercise.js` die `fftSize` adaptiv an die Zielnote koppeln (oder vorerst konstant auf 8192, als Minimalschritt zur Wiederherstellung der Funktionsfähigkeit).
3. **`fastNoteMatcher.js` als reinen Baustein anlegen** und die Ebene-A-Tests (A1, A3, A4) ergänzen.
4. **Latenzsimulation (Ebene B)** einziehen und die Grenzwerte in B1 empirisch festzurren.
5. **Controller umstellen** (`sheetMusicMicExercise.js`, später `notePlayingExercise.js`) auf `fastNoteMatcher` + adaptive `fftSize`.
6. **Ebene-C-Tests** auf die vorhandenen Fixtures ausrollen, neue Aufnahmen schrittweise ergänzen.
7. **CLAUDE.md** aller betroffenen Module und `version.txt` aktualisieren.

---

## Offene Entscheidungen (mit Vorschlag)

Die folgenden Punkte können für die erste Umsetzung mit den genannten Defaults geschlossen werden. Später korrigierbar.

| Frage | Vorschlag Erstumsetzung |
|-------|-------------------------|
| Nur Tonhöhe oder auch Rhythmus? | **Nur Tonhöhe.** Rhythmus ist eine eigene Übung (siehe `plans/ideen.md` „Rhythmus-Genauigkeits-Trainer"). |
| Reicht Note+Oktave oder Lagebindung? | **Note + Oktave.** Lagebindung nur optional und nicht Teil der Erstumsetzung. |
| Toleranz bei leicht verstimmten Aufnahmen? | **±35 Cent** (Konstante `FAST_CENTS_TOLERANCE`). |
| Wie schnell darf weitergeschaltet werden? | **≥ 150 ms Pause** nach `accept`, damit der Nutzer den Wechsel wahrnimmt. In der Config steuerbar. |
| Getrennte Modi „locker" / „streng"? | **Ja** — `sheetMusicMic` hat bereits `easy`/`hard`. Die Unterscheidung greift auf der `updateMatchState`-Ebene: im `easy`-Modus wird `reject` ignoriert, im `hard`-Modus löst es Sequenzneustart aus. |
