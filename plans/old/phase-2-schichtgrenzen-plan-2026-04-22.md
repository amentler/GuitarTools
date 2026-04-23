# Phase 2 im Detail: Schichtgrenzen sauber ziehen

Datum: 2026-04-22  
Basis: `plans/architektur-review-plan-2026-04-21.md`  
Status: geplant

## Ziel

Phase 2 soll die fachlichen und technischen Abhängigkeiten im Projekt so ordnen, dass Features nicht länger gegenseitig als inoffizielle Shared Library missbraucht werden. Das Ziel ist nicht ein großer Strukturumbau in einem Schritt, sondern eine kontrollierte Migration hin zu klaren Schichten mit stabiler Abhängigkeitsrichtung.

Ergebnis dieser Phase:

- gemeinsam genutzte Fachlogik liegt nicht mehr in einzelnen `games`- oder `tools`-Ordnern
- `components` importiert keine Feature-Logik mehr
- Shared Rendering-, Audio- und Fretboard-/Chord-Bausteine liegen in neutralen Modulen
- ESLint schützt die neuen Schichtregeln gegen Rückfälle

## Aktueller Befund

Die Review und ein kurzer Code-Scan zeigen bereits konkrete Schichtverletzungen:

- `js/components/fretboard/gt-fretboard.js` importiert `../../games/fretboardToneRecognition/fretboardLogic.js`
- `js/utils/chordDetectionUtils.js` importiert `../tools/guitarTuner/pitchLogic.js`
- `js/tools/akkordUebersicht/akkordUebersicht.js` importiert `../../games/akkordTrainer/akkordSVG.js`
- `js/games/chordExerciseEssentia/chordExerciseEssentia.js` importiert Logik und Rendering aus `../akkordTrainer/*`
- `js/games/notePlayingExercise/notePlayingLogic.js` und `js/games/tonFinder/tonFinderLogic.js` hängen an `../fretboardToneRecognition/fretboardLogic.js`
- `js/games/sheetMusicMic/*` hängt fachlich an `../sheetMusicReading/sheetMusicLogic.js`
- `js/games/akkordfolgenTrainer/*` hängt an `../../tools/metronome/metronomeLogic.js` und `../../tools/guitarTuner/pitchLogic.js`

Diese Lage erzeugt drei konkrete Probleme:

1. Feature-Ordner sind instabil, weil interne Umbauten andere Features brechen können.
2. Wiederverwendung ist vorhanden, aber an falscher Stelle verankert.
3. Controller-Zerlegung aus Phase 3 wird unnötig schwer, solange die Schichtgrenzen unscharf bleiben.

## Zielstruktur für Phase 2

Die bestehende Projektstruktur wird nicht komplett neu erfunden. Phase 2 führt nur die neutralen Ebenen ein, die für die jetzigen Importbeziehungen tatsächlich gebraucht werden.

Geplante Zielstruktur:

- `js/domain/fretboard/`
  - Tonpositionen, Griffbrett-Mapping, chromatische Noten, Positionsberechnung
- `js/domain/chords/`
  - Akkord-Voicings, erwartete Töne, Matcher, Kategorien, gemeinsame Akkordlogik
- `js/domain/pitch/`
  - Notennamen, Frequenz-zu-Note, einfache Pitch-Helfer
- `js/shared/rendering/chords/`
  - generisches Chord-Diagramm-Rendering
- `js/shared/audio/`
  - einfache Audio-/Mikrofon-/Analyse-Helfer, sofern bereits mehrfach genutzt
- `js/shared/music/`
  - notenbezogene Shared-Bausteine, falls `sheetMusicReading` und `sheetMusicMic` dieselbe Kernlogik teilen
- `js/components/`
  - nur generische UI-Bausteine, ohne Importe aus `games` oder `tools`

Nicht Ziel dieser Phase:

- komplette Controller-Zerlegung
- flächendeckende Umbenennung aller deutsch/englisch gemischten APIs
- vollständige Audio-Service-Architektur aus Phase 4

## Leitregeln

Ab Phase 2 gelten diese Regeln als Architekturvertrag:

- `components` darf nur `components`, `shared`, `domain`, `data` importieren
- `games` darf `domain`, `shared`, `components`, `data`, eigene lokale Dateien importieren
- `tools` darf `domain`, `shared`, `components`, `data`, eigene lokale Dateien importieren
- `utils` wird nicht weiter als unscharfer Sammelordner ausgebaut; neue wiederverwendbare Logik geht nach `domain` oder `shared`
- ein Feature darf kein anderes Feature als Bibliothek benutzen

Faustregel:

- `domain` = fachliche Logik ohne DOM
- `shared` = technische oder darstellungsbezogene Wiederverwendung
- `components` = UI-Elemente
- `games` und `tools` = konkrete Anwendungsfälle

## Arbeitspakete

### Paket A: Importlandkarte festziehen

Ziel:
Vor der eigentlichen Migration die verbotenen Importkanten vollständig erfassen und gruppieren.

Aufgaben:

1. Bestehende Cross-Feature-Imports dokumentieren.
2. In drei Typen einordnen:
   - Fachlogik
   - Rendering
   - Audio-/Analyse-Helfer
3. Für jede Kante festlegen:
   - verschieben
   - extrahieren
   - temporär über Re-Export stabilisieren

Ergebnis:
Eine belastbare Liste aller Phase-2-Baustellen, statt nur der heute bereits sichtbaren Hotspots.

### Paket B: Fretboard-Domain extrahieren

Ziel:
Alles, was Griffbrett-Positionen und Tonzuordnung beschreibt, wird aus `fretboardToneRecognition` herausgelöst.

Voraussichtliche Quellen:

- `js/games/fretboardToneRecognition/fretboardLogic.js`

Voraussichtliche Ziele:

- `js/domain/fretboard/fretboardLogic.js`

Abnehmer:

- `js/components/fretboard/gt-fretboard.js`
- `js/games/notePlayingExercise/notePlayingLogic.js`
- `js/games/tonFinder/tonFinderLogic.js`
- `js/games/fretboardToneRecognition/fretboardExercise.js`

Aufgaben:

1. Pure Griffbrettlogik identifizieren und verschieben.
2. Feature-spezifische Spielregeln im Feature belassen.
3. Importpfade der vier Abnehmer auf `js/domain/fretboard/*` umstellen.
4. Falls nötig, für einen Zwischenschritt Re-Exports im alten Pfad belassen, um den Umbau klein zu halten.

Definition of Done:

- `gt-fretboard` importiert keine Feature-Datei mehr.
- `notePlaying` und `tonFinder` hängen nicht mehr an `fretboardToneRecognition`.

### Paket C: Pitch-Grundlagen aus dem Tuner lösen

Ziel:
Einfache Pitch-Grundlagen dürfen nicht unter `tools/guitarTuner` liegen, wenn sie featureübergreifend genutzt werden.

Voraussichtliche Quellen:

- `js/tools/guitarTuner/pitchLogic.js`

Voraussichtliche Ziele:

- `js/domain/pitch/pitchCore.js`
- optional `js/shared/audio/inputLevel.js` für nicht-fachliche Analysehilfen

Betroffene Nutzer:

- `js/utils/chordDetectionUtils.js`
- `js/games/akkordfolgenTrainer/akkordfolgenChordMatcher.js`
- `js/games/akkordfolgenTrainer/akkordfolgenTrainer.js`
- `js/tools/guitarTuner/guitarTuner.js`

Aufgaben:

1. `pitchLogic.js` in zwei Gruppen schneiden:
   - stabile Grundbausteine wie `NOTE_NAMES`, `frequencyToNote`
   - tuner-spezifische Heuristiken und Analysepipeline
2. Nur die stabilen Grundbausteine nach `js/domain/pitch/` verschieben.
3. Alle Shared-Verbraucher auf die neue Domain-Datei umstellen.
4. Prüfen, ob `analyzeInputLevel` fachlich eher in `shared/audio` gehört als in `domain/pitch`.

Definition of Done:

- Shared-Verbraucher importieren keine Grundlogik mehr aus `tools/guitarTuner`.
- `guitarTuner` bleibt funktional, nutzt aber die extrahierten Basismodule.

### Paket D: Akkord-Domain und Chord-Rendering zentralisieren

Ziel:
Akkorddaten, erwartete Töne und Chord-Diagramm-Rendering werden von einzelnen Features entkoppelt.

Voraussichtliche Quellen:

- `js/games/akkordTrainer/akkordLogic.js`
- `js/games/akkordTrainer/akkordSVG.js`
- `js/utils/chordDetectionUtils.js`

Voraussichtliche Ziele:

- `js/domain/chords/chordLogic.js`
- `js/domain/chords/chordDetectionLogic.js`
- `js/shared/rendering/chords/chordDiagramRenderer.js`

Betroffene Nutzer:

- `js/tools/akkordUebersicht/akkordUebersicht.js`
- `js/games/chordExerciseEssentia/chordExerciseEssentia.js`
- `js/games/chordExerciseEssentia/essentiaChordLogic.js`
- `js/games/akkordfolgenTrainer/*`
- `js/games/akkordTrainer/akkordTrainer.js`

Aufgaben:

1. Trennen zwischen:
   - Akkorddatenzugriff und Auswahl
   - erwarteten klingenden Tönen
   - Diagramm-Rendering
2. Shared-Chord-Diagramm-Renderer unter `js/shared/rendering/chords/` bereitstellen.
3. `akkordUebersicht` und `chordExerciseEssentia` von `akkordTrainer` entkoppeln.
4. `chordDetectionUtils.js` entweder auflösen oder in ein klar benanntes Domain-Modul überführen.

Definition of Done:

- Kein Tool oder Game importiert Rendering aus `games/akkordTrainer`.
- Chord-spezifische Shared-Logik liegt nicht mehr unter `utils`.

### Paket E: Gemeinsame Noten-/Sheet-Music-Logik sauber extrahieren

Ziel:
`sheetMusicMic` darf gemeinsame Notenlogik nutzen, aber nicht als Seiteneffekt an `sheetMusicReading` gebunden sein.

Voraussichtliche Quellen:

- `js/games/sheetMusicReading/sheetMusicLogic.js`
- `js/games/sheetMusicReading/playbackController.js`

Voraussichtliche Ziele:

- `js/shared/music/sheetMusicLogic.js`
- optional `js/shared/music/layout/` für berechnete Layout-Bausteine

Betroffene Nutzer:

- `js/games/sheetMusicMic/sheetMusicMicExercise.js`
- `js/games/sheetMusicMic/sheetMusicMicLayout.js`
- `js/games/sheetMusicReading/*`

Aufgaben:

1. `sheetMusicLogic.js` in reine, gemeinsam nutzbare Logik und reading-spezifische Steuerung trennen.
2. Nur die reinen Generator-/Filter-/Layoutfunktionen in `shared` verschieben.
3. `playbackController` explizit reading-spezifisch lassen, solange kein zweiter Nutzer existiert.

Definition of Done:

- `sheetMusicMic` importiert keine fachliche Kernlogik mehr direkt aus `sheetMusicReading`.

### Paket F: Metronom-Logik als Shared Service bewerten

Ziel:
Verhindern, dass `tools/metronome` zur heimlichen Bibliothek für Features wird.

Aktuelle Kante:

- `js/games/akkordfolgenTrainer/akkordfolgenTrainer.js` importiert `../../tools/metronome/metronomeLogic.js`
- `js/games/sheetMusicReading/playbackController.js` importiert `../../tools/metronome/metronomeLogic.js`

Entscheidungspfad:

1. Wenn `MetronomeLogic` reine Takt-/Timing-Logik ohne Tool-UI ist:
   - nach `js/shared/audio/metronomeLogic.js` verschieben
2. Wenn sie stark tool-spezifisch ist:
   - minimalen Core extrahieren
   - Tool-spezifische Steuerung im Tool belassen

Definition of Done:

- `games` importieren keine Kernlogik mehr aus dem Metronom-Toolpfad.

### Paket G: ESLint-Regeln als Schutzschicht

Ziel:
Die neue Struktur muss maschinell erzwungen werden, sonst fällt die Codebasis schnell in alte Muster zurück.

Aufgaben:

1. Bestehende ESLint-Konfiguration prüfen und erweitern.
2. Importregeln für verbotene Pfade ergänzen.
3. Mindestens diese Verbote absichern:
   - `components -> games`
   - `components -> tools`
   - `games -> andere games` außerhalb expliziter Ausnahmen
   - `tools -> games`
4. Falls nötig, Phase-2-kompatible Übergangs-Ausnahmen mit Kommentar und Ablaufdatum dokumentieren.

Definition of Done:

- Ein versehentlicher neuer Cross-Feature-Import schlägt im Lint fehl.

## Empfohlene Umsetzungsreihenfolge

Reihenfolge nach Risiko und Hebel:

1. Paket A: Importlandkarte vollständig machen
2. Paket B: Fretboard-Domain extrahieren
3. Paket C: Pitch-Core extrahieren
4. Paket D: Akkord-Domain und Rendering zentralisieren
5. Paket E: Sheet-Music-Shared-Logik extrahieren
6. Paket F: Metronom-Core aus Toolpfad lösen
7. Paket G: ESLint-Regeln scharf stellen

Begründung:

- Fretboard und Pitch lösen die klarsten und technisch einfachsten Verstöße.
- Akkord- und Sheet-Music-Extraktionen sind breiter, profitieren aber von den zuvor etablierten Zielmustern.
- Linting sollte nicht ganz am Anfang scharf geschaltet werden, solange legitime Altlasten noch absichtlich bestehen.

## Umsetzungstaktik

Die Phase sollte in kleinen, reviewbaren Teil-PRs oder Commits umgesetzt werden.

Empfohlene Commit-Scheiben:

1. `phase-2: extract fretboard domain core`
2. `phase-2: extract shared pitch core`
3. `phase-2: centralize chord domain and rendering`
4. `phase-2: extract shared sheet music logic`
5. `phase-2: move metronome core out of tool layer`
6. `phase-2: enforce layer boundaries in eslint`

Regel für jede Scheibe:

- erst Zielmodul anlegen
- dann Verbraucher umstellen
- dann temporäre Altpfade nur entfernen, wenn keine Nutzer mehr verbleiben

## Risiken

### Risiko 1: Zu große Verschiebungen brechen laufende Features

Gegenmaßnahme:

- kleine Migrationsschritte
- vorübergehende Re-Exports nur dort, wo sie Umbauvolumen reduzieren

### Risiko 2: Shared-Module werden wieder zu einem diffusen Sammelordner

Gegenmaßnahme:

- `domain` und `shared` streng nach Zweck trennen
- keine neuen allgemeinen Helfer in `utils` abladen

### Risiko 3: Tuner-Logik wird versehentlich funktional verschlechtert

Gegenmaßnahme:

- nur stabile Basiskonzepte extrahieren
- präzise Tuner-Heuristik im Tool lassen

### Risiko 4: Rendering-Extraktion verändert Markup oder CSS-Verhalten

Gegenmaßnahme:

- Renderer-API zunächst kompatibel zum aktuellen Aufruf halten
- visuelle Smoke-Checks der chord-basierten Seiten einplanen

## Test- und Verifikationsplan

Nach jedem Arbeitspaket:

1. `npm run lint`
2. relevante Unit-Tests ausführen
3. betroffene Seiten im Browser smoke-testen

Mindestens zu prüfen:

- Fretboard-Komponente rendert weiterhin korrekt
- `notePlaying`, `tonFinder` und `fretboardToneRecognition` liefern unveränderte Tonpositionen
- chord-basierte Features zeigen weiterhin Diagramme und korrekte erwartete Töne
- `sheetMusicReading` und `sheetMusicMic` generieren weiterhin kompatible Notenfolgen
- Metronom-basierte Abläufe bleiben taktstabil

Wenn Testlücken sichtbar werden, sind kleine Sicherungstests Teil von Phase 2, aber nicht das Hauptziel.

## Akzeptanzkriterien

Phase 2 gilt als abgeschlossen, wenn alle Punkte erfüllt sind:

- `components` importiert keine Dateien aus `games` oder `tools`
- kein Feature importiert Shared-Kernlogik mehr aus einem anderen Feature-Ordner
- `utils/chordDetectionUtils.js` ist entfernt oder fachlich eindeutig neu verortet
- Fretboard-, Pitch-, Chord- und Sheet-Music-Shared-Bausteine liegen in neutralen Modulen
- ESLint verhindert die wichtigsten verbotenen Importkanten
- die betroffenen Übungen und Tools funktionieren nach Smoke-Test weiterhin

## Abgrenzung zu Phase 3

Phase 2 endet bewusst vor der tiefen Controller-Zerlegung.

Nach erfolgreichem Abschluss ist der erwartete Vorteil für Phase 3:

- kleinere Extraktionsziele
- weniger verdeckte Abhängigkeiten
- klarere Verantwortung pro Datei
- bessere Testbarkeit der neu entstehenden Controller-Bausteine

## Nächster konkreter Startpunkt

Wenn Phase 2 umgesetzt wird, sollte der erste operative Schritt sein:

1. `fretboardLogic` in ein neutrales Domain-Modul extrahieren
2. alle vier aktuellen Verbraucher umstellen
3. danach `pitchLogic` in Core und Tuner-spezifische Teile schneiden

Damit werden die sichtbarsten Schichtverletzungen früh entfernt und ein Muster für die restlichen Pakete etabliert.
