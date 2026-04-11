# Plan: Akustische Prüfung von Notenzeilen beim Gitarrenspiel

**Status:** In Umsetzung – Stufe 1 (Basis-Implementierung) läuft ⏳  
**Typ:** Übung / Audio-Erkennung  
**Stand:** 2026-04-11 (zweistufige Implementierung aktiv)  
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

#### B6. Sequenz-Simulation mit laufendem Zielzeiger

Dies ist die synthetische Entsprechung der echten Übung: der Matcher hat eine **laufende** Zielnote, die nach jedem `accept`-Event auf die nächste Note der Sollfolge weiterschaltet. Das ist mehr als die Summe von B1–B4, weil

- die `referenceHz`-Verengung nach jedem Wechsel neu greift,
- Ringing der Vorgängernote gegen die **neue** Zielnote geprüft wird,
- und Notenwechsel, Streak-Reset und ggf. `fftSize`-Wechsel im selben Schritt getestet werden.

Neuer Helper (`tests/helpers/sequenceSimulator.js`):

```js
// Läuft frame-für-frame durch `samples`.
// Nach jedem accept wird targetIndex++ gesetzt, die Pipeline neu parametrisiert
// (referenceHz, fftSize) und der Matcher-State extern zurückgesetzt.
export function runSequenceSimulation(samples, sampleRate, targetSequence, options = {}) {
  // options: { fftSizeFor(pitch), hopSize, postAcceptGapFrames }
  // returns: {
  //   acceptedSequence: string[],   // tatsächlich akzeptierte Folge (entduplifiziert)
  //   acceptTimesMs:    number[],   // ms seit Beginn des Puffers bei jedem Accept
  //   finalTargetIndex: number,     // wie weit die Sollfolge abgearbeitet wurde
  //   rejects:          Array<{ atMs, expected, detected }>
  // }
}
```

Testfälle (alle rein synthetisch, deterministisch):

- **B6a** Synth-Sequenz E2 A2 D3 G3 B3 E4 (je 300 ms + 100 ms Stille), Sollfolge gleich → `acceptedSequence` exakt gleich der Sollfolge, `finalTargetIndex = 6`.
- **B6b** Dieselbe Synth-Sequenz, Sollfolge E2 A2 D3 G3 B3 E4 B3 G3 D3 A2 E2 (also teilweise abwärts) → `acceptedSequence` endet bei `E4` (6 Events), `finalTargetIndex = 6`; die restlichen 5 Zielnoten bleiben übrig, weil das Signal aufhört.
- **B6c** Die vollständige Nutzer-Sollfolge E2 A2 D3 G3 B3 E4 B3 G3 D3 A2 E2 A2 D3 G3 B3 E4 (16 Noten) mit passendem Synth-Signal, 400 ms pro Note, 100 ms Stille → `acceptedSequence` exakt gleich, `finalTargetIndex = 16`.
- **B6d** Dieselbe 16-Noten-Sollfolge, aber dasselbe Signal mit 150 ms pro Note + 30 ms Stille (schnelles Tempo) → `acceptedSequence` exakt gleich.
- **B6e** Sollfolge E2 E3 E4, Signal E2 E2 E4 (Position 2 ist ein Oktavfehler) → `finalTargetIndex = 1`, das E4 wird nicht akzeptiert, weil der Zielzeiger noch auf E3 steht. Stellt sicher, dass der Matcher keine Zielnoten „überspringt".
- **B6f** Sollfolge 4×E4, Signal vier diskrete E4-Impulse mit 80 ms Stille zwischen ihnen → `acceptedSequence.length === 4`.
- **B6g** Sollfolge E4 F4, Signal ohne Pause mit expo-Decay des E4 in den F4 hinein (Ringing-Simulation) → `acceptedSequence === ["E4","F4"]`, keine `rejects` zwischendurch.

Die synthetischen Sequenzen in B6a, B6c, B6d sollten **dasselbe Muster** abbilden wie die echten Aufnahmen in C5 — so wird der Simulator einmalig synthetisch grün und gilt dann als stabiles Gerüst für die realen Aufnahmen.

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

#### C5. Sequenzen (Notenzeilen) – Ganzsequenz-Abgleich

Reale Aufnahmen einer ganzen Notenzeile. Der Test läuft jede Aufnahme einmal durch den `runSequenceSimulation`-Helper aus B6 und prüft, dass **die gesamte erkannte Folge** der Soll-Folge entspricht – nicht nur einzelne Töne.

**Abgleichsregel:**
1. Direkt aufeinanderfolgende gleiche `accept`-Events werden entduplifiziert (Ringing/Sustain kann gelegentlich doppelt auslösen).
2. Die entduplifizierte Folge muss dann **exakt** der `notes`-Liste aus der JSON-Datei entsprechen – gleiche Länge, gleiche Reihenfolge, gleiche Oktaven.
3. `finalTargetIndex` muss am Ende gleich `notes.length` sein, sonst gilt der Test als „Sequenz nicht komplett erkannt".

**Datei- und Format-Schema**

Jede Aufnahme wird als Paar `.wav` + `.json` im selben Ordner abgelegt:

```
tests/fixtures/sequences/<kategorie>/<name>.wav
tests/fixtures/sequences/<kategorie>/<name>.json
```

Inhalt des JSON:

```json
{
  "notes": ["E2","A2","D3","G3","B3","E4","B3","G3","D3","A2","E2","A2","D3","G3","B3","E4"],
  "tempoBpm": 60,
  "notesPerBeat": 1,
  "description": "Offene Saiten auf/ab/auf, 1 Note pro Sekunde"
}
```

Felder:
- `notes` (Pflicht): Soll-Folge als Pitch-Strings mit Oktave.
- `tempoBpm` (optional): Dokumentation für die Aufnahme, nicht Teil des Tests.
- `notesPerBeat` (optional): 1 für Viertel, 2 für Achtel usw.
- `description` (optional): Klartext.

**Allgemeine Aufnahme-Regeln (gelten für alle Unterabschnitte)**

- WAV, 44,1 kHz oder 48 kHz, mono oder stereo, 16-bit PCM oder 32-bit Float.
- Mindestens **500 ms Stille** vor der ersten Note und nach der letzten Note.
- Jede Note **einmal** klar anschlagen. Kein Legato, wenn nicht explizit gefordert. Keine Barré-Akkorde, nur Einzeltöne.
- Standardstimmung **E2 A2 D3 G3 B3 E4** unmittelbar vor der Aufnahme einmal prüfen. Eine Abweichung von > 30 Cent kippt alle Sequenztests.
- Nach dem Einspielen einmal selbst abhören und Nebengeräusche (Fußboden, Sprechen, Kleidung an der Gitarre) ausschließen.
- Dateinamen **exakt** wie angegeben, damit das Testskript sie findet (Dateinamen sind case-sensitiv).
- Wo ein Tempo angegeben ist: Metronom einstellen, ein paar Takte leer mitlaufen lassen, dann spielen. Tempo muss nicht perfekt eingehalten werden, aber die Reihenfolge der Töne ist entscheidend.

##### C5.1 Hauptsequenz „Offene Saiten" – 16 Noten

Das deckt mit einer einzigen Aufnahme pro Tempo die größten Schwachstellen des heutigen Code ab: alle sechs offenen Saiten in beiden Richtungen, ohne dass gegriffen werden muss.

**Soll-Folge (identisch für alle drei Tempi):**

```
E2  A2  D3  G3  B3  E4  B3  G3  D3  A2  E2  A2  D3  G3  B3  E4
```

(Das ist die vom Nutzer vorgegebene Folge: alle Leersaiten aufwärts → wieder abwärts zurück zu E2 → noch einmal aufwärts.)

In drei Tempi:

| Variante | Metronom | Notendauer | Gesamtdauer | Zweck |
|----------|---------:|-----------:|------------:|-------|
| `slow.wav`   | 60 BPM, Viertel                | ~1 s pro Note   | ~17 s | Baseline: jede Note wird sauber getroffen, Latenz unkritisch |
| `medium.wav` | 90 BPM, Viertel                | ~0,67 s pro Note| ~12 s | Realistisches Übetempo |
| `fast.wav`   | 120 BPM, Achtel (2 Noten/Schlag) | ~0,25 s pro Note| ~5 s  | Stresstest für Übergangslatenz und Ringing |

Dateistruktur:

```
tests/fixtures/sequences/open-strings/slow.wav    + slow.json
tests/fixtures/sequences/open-strings/medium.wav  + medium.json
tests/fixtures/sequences/open-strings/fast.wav    + fast.json
```

Alle drei JSONs tragen dieselbe `notes`-Liste, unterscheiden sich nur in `tempoBpm` und `notesPerBeat`.

##### C5.2 Offene Saiten – nur aufwärts / nur abwärts

Damit Fehler isoliert an einer Richtung gefunden werden können.

```
tests/fixtures/sequences/open-strings/ascending.wav   + ascending.json
tests/fixtures/sequences/open-strings/descending.wav  + descending.json
```

- `ascending.json.notes`  = `["E2","A2","D3","G3","B3","E4"]`
- `descending.json.notes` = `["E4","B3","G3","D3","A2","E2"]`

Beide mit 80 BPM Viertel (= ~750 ms pro Note), keine Barré, jede Saite einmal einzeln anzupfen.

##### C5.3 Gleiche Note mehrfach hintereinander

Prüft, dass der Matcher nach jedem neuen Anschlag wieder akzeptiert (und nicht eine einzige gehaltene Note nur einmal zählt).

```
tests/fixtures/sequences/repeat/e2-x4.wav  + e2-x4.json    notes = ["E2","E2","E2","E2"]
tests/fixtures/sequences/repeat/a2-x4.wav  + a2-x4.json    notes = ["A2","A2","A2","A2"]
tests/fixtures/sequences/repeat/e4-x4.wav  + e4-x4.json    notes = ["E4","E4","E4","E4"]
```

60 BPM Viertel (= ~1 s pro Anschlag). Wichtig: jede der 4 Noten **deutlich getrennt** anschlagen, zwischen den Anschlägen kurz die Saite leicht mit der Anschlaghand abdämpfen, damit der vorherige Ton abreißt.

##### C5.4 Chromatisch auf einer Saite

Prüft Halbton-Unterscheidung im laufenden Betrieb.

```
tests/fixtures/sequences/chromatic/low-e-up.wav   + low-e-up.json
  notes = ["E2","F2","F#2","G2","G#2","A2"]
tests/fixtures/sequences/chromatic/high-e-up.wav  + high-e-up.json
  notes = ["E4","F4","F#4","G4","G#4","A4"]
```

Beide auf der jeweiligen E-Saite (Bund 0 → 1 → 2 → 3 → 4 → 5). 80 BPM Viertel. Saubere Einzelanschläge, zwischen den Bundwechseln keine Schleifer oder Legato.

##### C5.5 C-Dur-Tonleiter über mehrere Saiten

Erster Sequenztest, bei dem Saitenwechsel mitten in der Folge vorkommen (prüft, dass die adaptive `fftSize` bei Saitenwechsel keine Frames verliert).

```
tests/fixtures/sequences/cmajor/one-octave.wav   + one-octave.json
  notes = ["C3","D3","E3","F3","G3","A3","B3","C4"]
tests/fixtures/sequences/cmajor/two-octaves.wav  + two-octaves.json
  notes = ["C3","D3","E3","F3","G3","A3","B3","C4","D4","E4","F4","G4","A4","B4","C5"]
```

Jeweils 80 BPM Viertel. Typische Fingersatz-Position für eine C-Dur-Tonleiter reicht – hauptsache, am Ende ist die Note+Oktave korrekt.

##### C5.6 Oktavsprünge

Testet, dass der Matcher bei großen Sprüngen nicht auf dem vorherigen Ton hängen bleibt und die Oktave korrekt erkennt.

```
tests/fixtures/sequences/leaps/octaves-e.wav   + octaves-e.json
  notes = ["E2","E3","E4","E3","E2"]
tests/fixtures/sequences/leaps/wide.wav         + wide.json
  notes = ["E2","E4","E2","E4","E2","E4"]
```

80 BPM Viertel, Einzelanschläge. E2 = Leersaite 6, E3 = Bund 2 auf D-Saite, E4 = Leersaite 1.

#### C6. Umgebungsbedingungen

Gleiche Sequenz (z. B. `sequences/slow/c-major-asc.wav`) zusätzlich einmal aufnehmen in:

- `sequences/env/quiet.wav` – Ruheraum
- `sequences/env/living.wav` – normale Wohnumgebung, Grundrauschen
- `sequences/env/typing.wav` – Tastaturgeräusche im Hintergrund
- `sequences/env/strum-bleed.wav` – Nachbarsaiten klingen mit

---

### Schnell-Checkliste für den Nutzer

Wenn du nur wenig Aufnahmezeit hast, bringen diese Aufnahmen den höchsten Testwert. In dieser Reihenfolge einspielen:

**Stufe 1 – Minimum (3 Dateien, deckt den Kernbug ab):**

1. `sequences/open-strings/slow.wav` – die 16-Noten-Hauptsequenz C5.1 in 60 BPM. Deckt alle offenen Saiten in beiden Richtungen ab und ist die solideste Regressionsbasis (kein Fretting nötig).
2. `sequences/open-strings/fast.wav` – dieselbe Sequenz in 120 BPM Achtel. Deckt Latenz + Übergangsverhalten ab.
3. `sequences/repeat/e2-x4.wav` und `sequences/repeat/e4-x4.wav` – 4× dieselbe Note an den beiden Extrempunkten des Gitarrenbereichs.

**Stufe 2 – ergänzend (Halbtöne und Sprünge):**

4. `sequences/chromatic/low-e-up.wav` – Halbtonunterscheidung tief.
5. `sequences/leaps/octaves-e.wav` – Oktav-Sprünge E2↔E3↔E4.
6. `sequences/open-strings/medium.wav` – mittleres Tempo der Hauptsequenz.

**Stufe 3 – Breite (wenn Zeit ist):**

7. `sequences/cmajor/one-octave.wav` – erste saitenwechselnde Sequenz.
8. `sequences/chromatic/high-e-up.wav` – Halbtonunterscheidung hoch.
9. `sequences/open-strings/ascending.wav` + `descending.wav` – Richtung isoliert.
10. `sequences/repeat/a2-x4.wav` – Mitte der tiefen Saiten.

**Stufe 4 – Grenzfälle und Einzeltöne** (Einzelton-Ordner aus C1/C3/C4).

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

## Zweistufige Implementierung

Die Umsetzung erfolgt bewusst in zwei Stufen. Grund: Stufe 1 kann ausschließlich mit bereits im Repository vorhandenen Mitteln (Synthetik + gesammelte Einzelton-Fixtures) vollständig durchgeführt werden. Stufe 2 benötigt neue, vom Nutzer eingespielte Sequenzaufnahmen, die hinterher separat ergänzt werden.

### Stufe 1 – Basis-Implementierung (ohne neue Aufnahmen)

Ziel: Der aktuelle Kernbug („YIN liefert nie etwas, weil `fftSize = 2048` zu klein für E2 ist") wird durch einen Testsatz dokumentiert, der erst rot ist und nach dem Fix grün wird. Es werden **nur** bereits vorhandene Fixtures und synthetische Signale genutzt.

Umfang Stufe 1:

- `js/games/sheetMusicMic/fastNoteMatcher.js` neu anlegen mit `classifyFrame`, `updateMatchState`, `getMinSamplesFor`, `getRecommendedFftSize`, Konstanten `FAST_ACCEPT_STREAK = 2`, `FAST_REJECT_STREAK = 3`, `FAST_CENTS_TOLERANCE = 35`.
- `tests/unit/fastNoteMatcher.test.js` neu anlegen, mit den Testgruppen A1 (classifyFrame Grundverhalten), A2 (Buffergrößen-Regression), A3 (updateMatchState Streak-Logik) und A4 (guitarähnliche Synthetik). Keine Sequenztests in dieser Stufe.
- `tests/unit/fastNoteMatcherAudio.test.js` neu anlegen. Scannt `tests/fixtures/audio/{E2,A2,D3,G3,B3,E4}/`, `tests/fixtures/audio-imprecise/{B3,E4}/` und `tests/fixtures/synth/{33 Noten}/` und prüft für jede Datei `classifyFrame` mit einer passend großen Fenstergröße – erwartet Status `correct` und korrekte Note+Oktave.
- `sheetMusicMicExercise.js` und `notePlayingExercise.js` umstellen auf `fastNoteMatcher` + `getRecommendedFftSize`. Die `fftSize` wird bei jedem Zielnotenwechsel nachgezogen (nur wenn sich der empfohlene Wert tatsächlich ändert, sonst klickt der AnalyserNode).
- `version.txt`, `CLAUDE.md` (Root und `sheetMusicMic`, `notePlayingExercise`), `sw.js`-Assetliste aktualisieren.

**Was in Stufe 1 ausdrücklich nicht enthalten ist:**

- Ebene-B-Sequenztests (B6 inklusive der Nutzer-Sollfolge) werden noch nicht implementiert.
- Keine neuen Aufnahmen in `tests/fixtures/sequences/**`.
- Kein `sequenceSimulator.js`-Helper.

Am Ende von Stufe 1 meldet die Implementierung „rote Tests zuerst, dann Fix, jetzt grün" zurück, inklusive einer Zusammenfassung der tatsächlichen Latenz- und Erkennungsergebnisse auf den vorhandenen Fixtures.

### Stufe 2 – Sequenzaufnahmen und Latenzfeinschliff

Diese Stufe beginnt, **sobald der Nutzer die in Abschnitt C5 beschriebenen Aufnahmen eingespielt hat.** Umfang Stufe 2:

- `tests/helpers/sequenceSimulator.js` mit `runSequenceSimulation(samples, sampleRate, targetSequence, options)`.
- `tests/unit/fastNoteMatcherLatency.test.js` mit den Gruppen B1 (Bestätigungslatenz je Zielnote), B2 (Notenwechsel-Latenz), B3 (gleicher Ton mehrfach), B4 (Oktavsprung), B5 (Rauschen) und B6 (Sequenz-Simulation inklusive der 16-Noten-Nutzer-Sollfolge synthetisch).
- `tests/unit/fastNoteMatcherSequences.test.js`: läuft `runSequenceSimulation` über jede `.wav`/`.json`-Paarung unter `tests/fixtures/sequences/**` und vergleicht die entduplifizierte `acceptedSequence` Byte-für-Byte mit `notes`.
- Falls dabei reale Fehler auftauchen: gezielte Nachbesserungen am Matcher (z. B. `FAST_CENTS_TOLERANCE`-Feinjustierung, Onset-Sperre, Ringing-Toleranz) – mit jeweils begleitendem synthetischen Regressionstest.
- Die neuen Sequenz-Dateien werden nicht in `sw.js` aufgenommen (Testfixtures sind nicht Teil der installierten App).

Erst nach Stufe 2 ist der ursprünglich skizzierte volle Testplan (Ebenen A, B, C) tatsächlich im Repo vertreten. Stufe 1 beweist „der Matcher als Baustein tut das Richtige", Stufe 2 beweist „er tut es auch auf echten ganzen Notenzeilen".

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
