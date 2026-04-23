# Chord Recognition Repair

Datum: 2026-04-22

Status: fachliche Restfälle offen

## Aktiver Fokus

Die UI-/WASM-Stabilisierung und die initiale Frozen-HPCP-Testbasis sind erledigt und archiviert in:

- `plans/old/chord-recognition-repair-completed-2026-04-23.md`

Offen bleibt die fachliche Qualität der Akkorderkennung, insbesondere für echte Gitarren-Fixtures und den Live-/Browser-Pfad.

## Offene Restprobleme

Der UI-Ausfall ist behoben, aber die fachliche Erkennung ist noch nicht vollständig sauber.

Die Top-Level-Vitest-Fälle in `tests/unit/essentiaChordAudio.test.js` zeigen weiterhin:

- `E-Dur/emaj.wav` wird aktuell nicht als `E-Dur` akzeptiert, sondern landet knapp bei `Hmaj7`
- `G-Dur/g_chord.wav` wird aktuell nicht als `G-Dur` akzeptiert, sondern landet bei `G-Moll`
- zusätzliche Steel-Fixtures zeigen, dass Onset-/Frame-Selektion und Matching noch nicht robust genug zusammenspielen

Das ist kein Browser-/UI-Defekt mehr, sondern ein inhaltliches Matching-/Analyseproblem im aktuellen HPCP-Pfad.

## Offene Verbesserungsoptionen

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

## Noch offener Grenzfall

- der Browser-/Live-Fall für `C-Dur` war zuletzt im E2E noch nicht stabil und ist nicht durch die Frozen-HPCP-Tests abgedeckt
