# Chord Recognition Repair

Datum: 2026-04-22

## Ausgangslage

Es gibt jetzt einen Playwright-E2E-Test für das Einspielen eines einzelnen Akkords:

- `tests/e2e/chord-playing-emoll.spec.js`

Der Test öffnet `pages/chord-playing-essentia/index.html`, erzwingt deterministisch `E-Moll (2-Finger)` als Zielakkord, speist per Chromium-Fake-Mikrofon die Datei `tests/fixtures/chords/E-Moll/emin.wav` ein und erwartet `✅ Richtig!`.

Aktuelles Ergebnis: rot.

Beobachtetes UI-Verhalten:

- Statt `✅ Richtig!` erscheint `❌ Nicht erkannt – Übereinstimmung: 0%`

## Diagnose

Die Ursache liegt nicht am Playwright-Setup:

- Das Fake-Mikrofon liefert im Browser klaren Pegel.
- `getUserMedia()` funktioniert.
- Die WAV-Datei ist plausibel und hat ausreichende Lautstärke.

Die Ursache liegt auch nicht an den Akkord-Templates:

- `E-Moll`
- `E-Moll (2-Finger)`

beide Templates existieren und enthalten die erwarteten aktiven Bins.

Die Fixture selbst wird in der reinen Erkennungslogik korrekt erkannt:

- `detectEssentiaChordFromSamples(..., 'E-Moll')` ist korrekt
- `detectEssentiaChordFromSamples(..., 'E-Moll (2-Finger)')` ist ebenfalls korrekt

Damit bleibt als Fehlerquelle der Live-Erkennungspfad in der Browser-App.

## Primäre Ursache

In `js/games/chordExerciseEssentia/essentiaChordDetection.js` verwendet `computeHpcpEssentia()` die Methoden:

- `essentia.arrayToVector(...)`
- `essentia.vectorToArray(...)`

Konkrete Fundstellen:

- `js/games/chordExerciseEssentia/essentiaChordDetection.js:119`
- `js/games/chordExerciseEssentia/essentiaChordDetection.js:141`

`getEssentia()` liefert aber in `js/games/chordExerciseEssentia/essentiaLoader.js` eine `EssentiaJS`-Instanz zurück:

- `js/games/chordExerciseEssentia/essentiaLoader.js:72`

Im Browser ist reproduzierbar:

```text
TypeError: essentia.arrayToVector is not a function
```

Damit ist der WASM-HPCP-Pfad aktuell defekt.

## Sekundäres Problem

Der eigentliche Fehler wird in `detectChordEssentia()` maskiert.

In der Frame-Sammelschleife werden Fehler absichtlich geschluckt:

- `js/games/chordExerciseEssentia/essentiaChordDetection.js:226`
- `js/games/chordExerciseEssentia/essentiaChordDetection.js:228`

Dadurch werden fehlerhafte Frames einfach verworfen. Wenn alle Frames scheitern, bleibt `hpcps.length === 0` und die Funktion endet mit:

```js
{ isCorrect: false, confidence: 0, bestMatch: null }
```

Für die UI wirkt das dann wie eine normale Nicht-Erkennung statt wie ein technischer Fehler.

## Zusätzliche Beobachtung

Wenn der Pure-JS-HPCP-Pfad direkt auf den im Browser gemessenen Peaks ausgeführt wird, entstehen verwertbare Daten. Das heißt:

- Mikrofonpfad lebt
- Onset wird erkannt
- Peaks werden gefunden
- das Problem sitzt spezifisch im WASM-HPCP-Zweig

## Schlussfolgerung

Die aktuelle Live-Akkorderkennung scheitert primär daran, dass der Essentia-WASM-Pfad mit einer nicht passenden API aufgerufen wird.

Der aktuelle rote Playwright-Test ist damit sinnvoll und korrekt: er trifft einen echten Produktionsfehler.

## Reparaturansatz

1. Den Essentia-WASM-Aufruf in `computeHpcpEssentia()` auf die tatsächliche verfügbare API anpassen.
2. Falls der WASM-Pfad pro Frame scheitert, nicht stillschweigend in eine normale Falscherkennung laufen.
3. Entweder:
   - sauber auf den Pure-JS-HPCP-Pfad zurückfallen, oder
   - einen technischen Fehlerzustand sichtbar machen.
4. Danach den bestehenden Playwright-Test erneut ausführen.

## Erwartetes Reparaturziel

Nach der Korrektur sollte dieser Test grün werden:

```bash
npm run test:e2e -- tests/e2e/chord-playing-emoll.spec.js
```
