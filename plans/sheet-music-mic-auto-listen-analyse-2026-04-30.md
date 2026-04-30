# Analyse: `Noten spielen` Auto-Listening und Endlosmodus brechen im echten Browser

## Ausgangslage

Nach der Umstellung von manuellem Start/Stop auf automatisches Zuhören direkt beim Seitenaufruf treten im echten Browser zwei beobachtbare Probleme auf:

1. `Noten spielen` akzeptiert gespielte Töne nicht mehr zuverlässig oder gar nicht.
2. Der neue `∞ Endlos`-Schalter funktioniert aus Nutzersicht nicht.

Die bestehende Testlage hat diese Fehler nicht sauber abgefangen, obwohl viele Unit- und E2E-Tests grün waren.

## Technische Hauptbeobachtung

Der produktive Browserpfad wurde nur teilweise geprüft.

Die Tests decken überwiegend drei vereinfachte Varianten ab:

1. Unit-/Controller-Tests mit gemockter Settings- und Audio-Logik
2. Browser-E2E mit vollständig ersetztem `AudioContext` und ersetztem `getUserMedia`
3. Browser-E2E mit Chromium-Fake-Mikrofon aus deterministischen WAV-Dateien

Der reale Pfad

- Seite laden
- automatischer Mikrofonstart ohne Benutzerklick
- echter Browser-`AudioContext`
- echte Mikrofonfreigabe
- echte WebAudio-Lebensdauer
- echte Benutzereingaben an Slider/Toggle
- später oder sofort gespielte echte Gitarrentöne

wurde nicht als zusammenhängender End-to-End-Pfad abgesichert.

## Produktiver Codepfad

### Auto-Listening startet sofort beim Mount

In `createSheetMusicMicFeature().mount()` wird nach dem initialen Rendern direkt `startListening()` aufgerufen.

Betroffene Stelle:
- `js/games/sheetMusicMic/sheetMusicMicExercise.js:602`
- `js/games/sheetMusicMic/sheetMusicMicExercise.js:633`

Damit ist der frühere explizite User-Gesture-Pfad entfallen.

### Audio-Session wird sofort geöffnet

`startListening()` ruft:

1. `requestMicrophoneStream()`
2. `openSheetMusicMicAudioSession(...)`
3. `applyTargetFftSize()`
4. `setInterval(analyzeFrame, 50)`

Betroffene Stellen:
- `js/games/sheetMusicMic/sheetMusicMicExercise.js:344`
- `js/games/sheetMusicMic/sheetMusicMicExercise.js:355`
- `js/games/sheetMusicMic/sheetMusicMicExercise.js:381`
- `js/games/sheetMusicMic/sheetMusicMicExercise.js:395`
- `js/games/sheetMusicMic/sheetMusicMicExercise.js:397`

### Reales Resume-Verhalten hängt an `audioSessionService`

Beim Öffnen der Session wird ein neuer `AudioContext` erzeugt und bei `state === 'suspended'` sofort `resume()` ausgeführt.

Betroffene Stelle:
- `js/shared/audio/audioSessionService.js:27`
- `js/shared/audio/audioSessionService.js:31`

Technisch kritisch:

- Im echten Browser ist dieser Pfad abhängig von Autoplay-/Gesture-/Permission-Verhalten.
- In den gefakten Tests ist `resume()` immer sofort erfolgreich.

### Erkennung hängt an Onset-Gate und Matcher

`analyzeFrame()` bewertet nur Frames, wenn

1. der aktuelle Zielton existiert,
2. der `AnalyserNode` brauchbare Samples liefert,
3. das Onset-Gate geöffnet ist,
4. `classifyFrame(...)` ein verwertbares Ergebnis liefert.

Betroffene Stellen:
- `js/games/sheetMusicMic/sheetMusicMicExercise.js:420`
- `js/games/sheetMusicMic/sheetMusicMicExercise.js:429`
- `js/games/sheetMusicMic/sheetMusicMicExercise.js:433`
- `js/games/sheetMusicMic/sheetMusicMicExercise.js:440`

Zusätzliche Gate-Logik:
- `js/shared/audio/noteOnsetGate.js:42`
- `js/shared/audio/noteOnsetGate.js:75`

Wenn der reale Browserpfad Samples verspätet, anders skaliert oder mit anderer Dynamik liefert, kann die gesamte Erkennung auf `unsure` hängenbleiben.

## Warum grüne Tests den Fehler nicht verhindert haben

## 1. Unit-Tests mocken die Settings-Wiring-Schicht weg

In den Controller-Tests werden `wireFretSlider()` und `wireStringToggles()` vollständig gemockt.

Betroffene Stelle:
- `tests/unit/sheetMusicMicController.test.js:8`

Folge:

- kein echter `input`-Event auf dem Bund-Slider
- keine echte Benutzerinteraktion am Endlos-Button außer CSS-Klasse
- kein echter Pfad `Settings ändern während Listening aktiv ist`

Der kritische Nutzerpfad

- Seite lädt
- Auto-Listening läuft
- Slider auf `Nur Leer`
- danach spielen

existiert in diesen Tests nicht.

## 2. Unit-Integrationstests mocken die Pitch-Erkennung weg

In den Integrationstests liefert `classifyFrame()` standardmäßig immer `correct`.

Betroffene Stelle:
- `tests/unit/sheetMusicMicIntegration.test.js:22`

Folge:

- keine echte YIN/HPS-Erkennung
- kein reales Buffer-/FFT-Verhalten
- kein realer Zusammenhang zwischen Mikrofon-Samples und Match
- kein echter Nachweis, dass ein Leersaiten-Ton im Browser tatsächlich akzeptiert wird

Diese Tests validieren primär State-Transitionen des Controllers, nicht die reale Audiofunktion.

## 3. Visual-Feedback-Playwright ersetzt den WebAudio-Pfad komplett

In `tests/e2e/sheet-music-mic-visual-feedback.spec.js` werden vor dem Laden der Seite

- `navigator.mediaDevices.getUserMedia`
- `window.AudioContext`
- `window.webkitAudioContext`

durch Testdoubles ersetzt.

Betroffene Stellen:
- `tests/e2e/sheet-music-mic-visual-feedback.spec.js:10`
- `tests/e2e/sheet-music-mic-visual-feedback.spec.js:176`
- `tests/e2e/sheet-music-mic-visual-feedback.spec.js:191`
- `tests/e2e/sheet-music-mic-visual-feedback.spec.js:196`
- `tests/e2e/sheet-music-mic-visual-feedback.spec.js:362`
- `tests/e2e/sheet-music-mic-visual-feedback.spec.js:377`

Technische Konsequenz:

- kein echter Browser-`AudioContext`
- kein echter MediaStream
- kein echter Audio-Graph
- `resume()` klappt deterministisch immer
- `createMediaStreamSource().connect()` ist praktisch ein No-Op

Wenn der produktive Browsergraph defekt wäre, könnten diese Tests trotzdem grün sein.

## 4. Die „echteren“ E2Es benutzen deterministische WAV-Fixtures

Die Browsertests mit Chromium-Fake-Mikrofon verwenden:

- `--use-fake-ui-for-media-stream`
- `--use-fake-device-for-media-stream`
- `--use-file-for-fake-audio-capture=...`

Betroffene Stellen:
- `tests/e2e/sheet-music-mic-fake-microphone.spec.js:8`
- `tests/e2e/sheet-music-mic-repeated-open-strings.spec.js:12`

Diese Pfade sind wertvoll, aber hart vereinfacht:

- Permission ist immer automatisch da
- das Signal ist perfekt reproduzierbar
- es gibt keine Nebengeräusche
- keine echte Eingangs-Latenz
- kein Benutzer-Timing
- kein „erst Settings ändern, dann später spielen“

## 5. Die E2Es umgehen oft die echte Notengenerierung

Viele `sheetMusicMic`-E2Es setzen `window.__GT_SHEET_MUSIC_MIC_BARS__` und umgehen damit die echte Generierung aus dem gefilterten Pool.

Produktiver Hook:
- `js/games/sheetMusicMic/sheetMusicMicExercise.js:41`
- `js/games/sheetMusicMic/sheetMusicMicExercise.js:149`

Teststellen:
- `tests/e2e/sheet-music-mic-visual-feedback.spec.js:413`
- `tests/e2e/sheet-music-mic-visual-feedback.spec.js:434`
- `tests/e2e/sheet-music-mic-visual-feedback.spec.js:458`
- `tests/e2e/sheet-music-mic-visual-feedback.spec.js:481`
- `tests/e2e/sheet-music-mic-fake-microphone.spec.js:18`
- `tests/e2e/sheet-music-mic-repeated-open-strings.spec.js:22`

Folge:

- `getFilteredNotes(maxFret, activeStrings)` wird in den Erfolgsfällen kaum echt validiert
- `generateBars(...)` mit echtem gefiltertem Pool wird im Audio-Erfolgspfad weitgehend umgangen

## Nicht geprüfte Pfade

### A. Slider `Bünde: Nur Leer` im echten Browser

Der produktive Filter sitzt in:
- `js/shared/music/sheetMusicLogic.js:34`

Die Slider-Verkabelung sitzt in:
- `js/utils/settings.js:69`
- `js/games/sheetMusicMic/sheetMusicMicExercise.js:545`

Es gibt aber keinen Playwright-Test, der

1. die Seite lädt,
2. auf `sheet-mic-fret-slider` auf `0` stellt,
3. danach echte oder fixture-basierte Leersaiten einspielt,
4. und die Akzeptanz validiert.

Das ist genau der von dir gemeldete Pfad.

### B. Settings-Wechsel bei bereits aktivem Auto-Listening

Nicht geprüft:

- `wireFretSlider(... onChange ...)` bei laufendem `setInterval`
- `wireStringToggles(... onChange ...)` bei laufendem `setInterval`
- `newBarsBtn` bei laufendem `setInterval`

Betroffene Stellen:
- `js/games/sheetMusicMic/sheetMusicMicExercise.js:545`
- `js/games/sheetMusicMic/sheetMusicMicExercise.js:555`
- `js/games/sheetMusicMic/sheetMusicMicExercise.js:591`

Technisch ist das relevant, weil dabei live Folgendes passiert:

- `state.bars` wird ersetzt
- `matchState` wird zurückgesetzt
- `onsetGateState` wird zurückgesetzt
- `currentBarIndex/currentBeatIndex` springen
- `applyTargetFftSize()` wird neu angewendet

Das alles passiert, während Audio weiterläuft.

### C. Echter Permission-/Resume-Pfad ohne Testdouble

Nicht geprüft:

- ob `AudioContext.resume()` ohne Knopf im echten Browser stabil funktioniert
- ob der erste verwertbare Audio-Frame rechtzeitig eintrifft
- ob Browser-/Geräteverhalten bei direktem Autostart die Erkennung beeinflusst

Die Tests nehmen implizit an, dass dieser Pfad technisch unproblematisch ist.

### D. Langer Idle-Pfad oder direktes Sofort-Spielen im echten Browser

Auch wenn der Nutzer sofort spielt, bleibt der Pfad real anders als in den Tests:

- echte Browser-Latenz
- echte Permission-/Stream-Aktivierung
- echte AudioContext-Resume-Timing-Frage
- echtes Timing zwischen `mount()`, `startListening()`, `openAudioSession()`, `applyTargetFftSize()` und erster Attacke

Die WAV-/Fake-Pfade in den Tests liefern deterministische Signale, die nach Testdesign gut zur Übung passen.

### E. Endlosmodus als Funktionspfad statt nur CSS-/State-Pfad

Es gibt Unit-Absicherung, dass bei gesetztem `localStorage` bzw. beim State-Rollover theoretisch eine neue Sequenz kommt.

Betroffene Stelle:
- `tests/unit/sheetMusicMicController.test.js:119`
- `tests/unit/sheetMusicMicIntegration.test.js:199`

Nicht geprüft ist aber im Browser:

- Klick auf `∞ Endlos`
- tatsächliche Persistenz
- tatsächliches automatisches Weiterlaufen mit aktivem Audio
- Wechsel zwischen Abschlusszustand und Endlos-Rollover im echten DOM bei aktivem Browser-Audio

## Implizite, fest verdrahtete Testannahmen

### Audio-Annahmen

- `sampleRate` ist effektiv `44100`
- `resume()` ist sofort erfolgreich
- der `AnalyserNode` liefert sofort nutzbare Samples
- das Eingangssignal ist sauber und monophon
- die Lautstärke passt zu den Gate-Schwellen
- keine Browser-DSP-Effekte stören

### Steuerungs-Annahmen

- Auto-Listening direkt bei `mount()` ist unkritisch
- Settings-Änderungen während aktivem Audio sind unkritisch
- die erste Attacke kommt nicht in ein ungünstiges Timingfenster

### Noten-/Pool-Annahmen

- die Testziele sind fast immer explizit injizierte Open-String-Noten
- die echte Zufallsgenerierung aus dem gefilterten Pool ist nicht das Problem
- der Filterpfad `maxFret = 0` muss nicht im Audio-Erfolgsfall separat validiert werden

## Relevante neue Warnsignale aus der Vollsuite

Die vollständige Playwright-Suite ist inzwischen nicht mehr vollständig grün.

Fehlgeschlagen sind:

1. `Noten spielen setzt die FFT auch bei initial suspended AudioContext korrekt`
2. `Noten spielen markiert vier nacheinander gespielte WAV-Noten jeweils gruen`

Beide bleiben bei `3 / 4` hängen statt `4 / 4`.

Das ist technisch wichtig, weil es zeigt:

- Der Auto-Listening-Umbau hat bereits Timing-/Initialisierungseffekte im realeren Browserpfad verändert.
- Die bisher grünen Pfade waren zu schmal, um diese Regression sofort sichtbar zu machen.

## Wahrscheinlichste technische Problemzonen

Ohne Umsetzung, nur als technische Priorisierung:

1. **Auto-Start ohne Benutzeraktion**
   - `AudioContext.resume()` / Stream-Start / erster valider Frame kommen nicht stabil genug rechtzeitig.

2. **Onset-Gate unter realem Timing**
   - Der erste echte Anschlag landet in einem ungünstigen Zustand des Gates oder wird nach State-Reset nicht wie erwartet geöffnet.

3. **Settings-Wechsel bei aktivem Listening**
   - `generateNewBars()` + `applyTargetFftSize()` + laufendes `analyzeFrame()` ergeben einen ungetesteten Race-/State-Pfad.

4. **Endlosmodus nur logisch, nicht browserseitig abgesichert**
   - Die Logik existiert, aber der volle Browserpfad nach Klick auf `∞ Endlos` ist nicht mit echtem Audiofluss geprüft.

## Fazit

Die Tests waren nicht falsch, aber technisch zu selektiv.

Sie haben primär abgesichert:

- DOM-Grundzustand
- Controller-State-Transitionen
- deterministische Audio-Fixtures
- einzelne künstliche Audio-Pfade

Sie haben nicht ausreichend abgesichert:

- echten Browser-Autostart des Mikrofons
- Slider-/Toggle-Änderungen während aktivem Listening
- den Pfad `Nur Leer` mit anschließendem echten Erkennen
- den Endlosmodus im echten Browser mit aktivem Audio

Deshalb ist es technisch plausibel, dass viele Tests grün waren, obwohl die reale Übung im Browser nicht mehr zuverlässig funktioniert.
