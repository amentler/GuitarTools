# Chord Recognition Repair

Datum: 2026-04-22

Status: UI-Fix umgesetzt, Browser-E2E grün, fachliche Restfälle offen

## Ausgangslage

Es gibt jetzt zwei Playwright-E2E-Tests für das Einspielen einzelner Akkorde:

- `tests/e2e/chord-playing-emoll.spec.js`
- `tests/e2e/chord-playing-cdur.spec.js`

Die Tests öffnen `pages/chord-playing-essentia/index.html`, erzwingen deterministisch den Zielakkord per URL-Parameter, speisen per Chromium-Fake-Mikrofon eine passende WAV-Datei ein und erwarten `✅ Richtig!`.

Aktueller Browser-Status:

- `E-Moll (2-Finger)` mit `tests/fixtures/chords/E-Moll/emin.wav` ist grün
- `C-Dur` mit `tests/fixtures/chords/C-Dur/c_chord.wav` ist grün

Vor der Reparatur war das beobachtete UI-Verhalten:

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

Der eigentliche Fehler wurde in `detectChordEssentia()` maskiert.

In der Frame-Sammelschleife werden Fehler absichtlich geschluckt:

- `js/games/chordExerciseEssentia/essentiaChordDetection.js:226`
- `js/games/chordExerciseEssentia/essentiaChordDetection.js:228`

Dadurch wurden fehlerhafte Frames einfach verworfen. Wenn alle Frames scheitern, bleibt `hpcps.length === 0` und die Funktion endet mit:

```js
{ isCorrect: false, confidence: 0, bestMatch: null }
```

Für die UI wirkte das wie eine normale Nicht-Erkennung statt wie ein technischer Fehler.

## Zusätzliche Beobachtung

Wenn der Pure-JS-HPCP-Pfad direkt auf den im Browser gemessenen Peaks ausgeführt wird, entstehen verwertbare Daten. Das heißt:

- Mikrofonpfad lebt
- Onset wird erkannt
- Peaks werden gefunden
- das Problem sitzt spezifisch im WASM-HPCP-Zweig

## Schlussfolgerung

Die ursprüngliche Live-Akkorderkennung scheiterte primär daran, dass der Essentia-WASM-Pfad mit einer nicht passenden API aufgerufen wurde.

Der damalige rote Playwright-Test war damit sinnvoll und korrekt: er traf einen echten Produktionsfehler.

## Umgesetzte Reparatur

Umgesetzt wurde ein pragmatischer UI-Fix:

1. `computeHpcpEssentia()` prüft jetzt, ob die erwarteten Essentia-Helfer überhaupt vorhanden sind.
2. Wenn der WASM-HPCP-Zweig zur Laufzeit scheitert, wird dieser Pfad für den aktuellen Durchlauf deaktiviert.
3. Die Live-Erkennung fällt dann auf den bestehenden Pure-JS-HPCP-Pfad zurück.
4. Der Browser läuft dadurch nicht mehr in `0%`-Falscherkennung, wenn nur der WASM-HPCP-Zweig inkompatibel ist.

Betroffene Datei:

- `js/games/chordExerciseEssentia/essentiaChordDetection.js`

Zusätzlich wurde die Seite für reproduzierbare E2E-Tests deterministisch gemacht:

- `pages/chord-playing-essentia/index.html?chord=C-Dur&categories=standard`
- `pages/chord-playing-essentia/index.html?chord=E-Moll%20(2-Finger)&categories=simplified`

Betroffene Datei:

- `js/games/chordExerciseEssentia/chordExerciseEssentia.js`

## Verifikation

Diese Browser-Tests sind jetzt grün:

```bash
npm run test:e2e -- tests/e2e/chord-playing-emoll.spec.js
PLAYWRIGHT_FAKE_AUDIO_PATH='tests/fixtures/chords/C-Dur/c_chord.wav' npm run test:e2e -- tests/e2e/chord-playing-cdur.spec.js
```

## Offene Restprobleme

Der UI-Ausfall ist behoben, aber die fachliche Erkennung ist noch nicht vollständig sauber.

Die Top-Level-Vitest-Fälle in `tests/unit/essentiaChordAudio.test.js` zeigen weiterhin:

- `E-Dur/emaj.wav` wird aktuell nicht als `E-Dur` akzeptiert, sondern landet knapp bei `Hmaj7`
- `G-Dur/g_chord.wav` wird aktuell nicht als `G-Dur` akzeptiert, sondern landet bei `G-Moll`

Das ist kein Browser-/UI-Defekt mehr, sondern ein inhaltliches Matching-/Analyseproblem im aktuellen HPCP-Pfad.

## Verbesserungsoptionen zur Erkennungsgenauigkeit

### 1. Matching-Logik mit negativer Evidenz

Aktuell nutzt `matchHpcpToChord()` nur Cosine Similarity gegen binäre Templates. Das belohnt Überschneidungen, bestraft aber störende Fremdbins nur indirekt.

Beobachtete Auswirkung auf die Problemfälle:

- `E-Dur/emaj.wav`: starke Energie auf Bin `10` zieht den Score Richtung `Hmaj7`
- `G-Dur/g_chord.wav`: zusätzliche Energie auf Bin `10` kippt das Ergebnis Richtung `G-Moll`

Verbesserung:

- Scoring aus Positiv- und Negativanteil bilden
- Soll-Bins belohnen
- Nicht-Akkord-Bins aktiv bestrafen
- konkurrierende Terzen (`Dur` vs. `Moll`) stärker gewichten

Nutzen:

- höchster Hebel bei geringem Implementierungsaufwand
- direkt auf das aktuell beobachtete Fehlmuster ausgerichtet

Priorität: **hoch**

### 2. Kandidatenraum auf die aktive Übung begrenzen

Derzeit wird gegen alle Templates aus `akkordData.js` gematcht, also auch gegen Akkorde, die in der aktuellen Übung gar nicht vorkommen.

Verbesserung:

- Matching nur gegen die Akkorde der aktiven Kategorie oder des aktuellen Übungssets
- z. B. `standard`, `simplified`, `extended`

Nutzen:

- weniger fachfremde Fehlklassifikationen wie `Hmaj7` in einer einfachen CAGED-Übung
- schneller und nachvollziehbarer

Priorität: **hoch**

### 3. Dur/Moll-Entscheidung explizit absichern

`G-Dur` vs. `G-Moll` ist im aktuellen System nur eine Folge des Gesamtscores. Für Gitarrenakkorde ist die Terz aber das unterscheidende Merkmal und sollte gezielt bewertet werden.

Verbesserung:

- Root, Terz und Quinte getrennt auswerten
- Major- und Minor-Terz explizit gegeneinander prüfen
- bei starker Root/Quinte, aber unsicherer Terz optional `unsicher` statt falscher Best-Match

Nutzen:

- reduziert genau die aktuell beobachtete `Dur`/`Moll`-Verwechslung

Priorität: **hoch**

### 4. Robustere Frame-Aggregation

Aktuell werden nach festem `ATTACK_SETTLE_MS` genau sechs Frames gleich gewichtet gemittelt.

Verbesserung:

- onset-nahe Frames stärker gewichten
- Median oder getrimmtes Mittel statt einfachem Mittelwert testen
- Frames mit schwacher oder instabiler Chroma verwerfen

Nutzen:

- weniger Verzerrung durch Sustain, Ausschwingphase und kurzlebige Obertöne

Priorität: **mittel**

### 5. Peak-Erkennung vor der HPCP verbessern

`detectEssentiaPeaks()` arbeitet derzeit mit lokalen Maxima auf dem Web-Audio-Spektrum und festem Noise-Floor.

Verbesserung:

- Peak-Interpolation zwischen FFT-Bins
- relativer statt fixer Schwellwert
- harmonische Gewichtung oder Whitening gegen dominante Obertöne
- optional größere FFT oder frequenzabhängige Peak-Filter

Nutzen:

- sauberere Eingangsdaten für beide HPCP-Pfade

Priorität: **mittel**

### 6. Root-/Bass-Information zusätzlich einbeziehen

Einige Verwechslungen lassen sich über die tiefste stabile Pitch-Class leichter auflösen als über reine Chroma-Verteilung.

Verbesserung:

- separaten Bass-/Root-Kanal aus tiefem Frequenzband ableiten
- Score erhöhen, wenn Root des Zielakkords im Bass stabil vorhanden ist

Nutzen:

- hilft besonders bei offenen Gitarrenakkorden mit klarer Basssaite

Priorität: **mittel**

### 7. Höhere Chroma-Auflösung vor dem finalen Matching

12 Bins sind für leicht verstimmte Gitarrensignale grob.

Verbesserung:

- intern 24 oder 36 Bins berechnen
- erst danach auf 12 Pitch Classes zusammenfassen oder direkt feiner matchen

Nutzen:

- robuster gegen Detuning und Terzverschiebungen

Priorität: **niedrig bis mittel**

## Empfohlene Umsetzungsreihenfolge

1. Matching-Logik um Strafterm für Fremdbins und konkurrierende Terzen erweitern.
2. Kandidatenraum auf das aktive Übungsset begrenzen.
3. Audio-Regressionstests für `E-Dur` und `G-Dur` als Zielkriterien grün ziehen.
4. Danach Frame-Aggregation und Peak-Erkennung getrennt gegeneinander evaluieren.

## Konkretes Akzeptanzkriterium für die nächste Iteration

Die nächste fachliche Reparaturrunde ist erfolgreich, wenn mindestens diese Fälle grün sind:

- `npm test -- tests/unit/essentiaChordAudio.test.js`
- `E-Dur/emaj.wav` wird als `E-Dur` akzeptiert
- `G-Dur/g_chord.wav` wird als `G-Dur` akzeptiert
- bestehende Browser-E2E-Fälle für `C-Dur` und `E-Moll (2-Finger)` bleiben grün
