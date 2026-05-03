# Architektur-Review GuitarTools - 2026-05-01

Status: ueberarbeitet und verfeinert am 2026-05-01  
Basis: vorhandenes Review von Claude, abgeglichen gegen den aktuellen Repo-Stand unter `js/`, `tests/` und `plans/`

## Zweck

Dieses Dokument ist kein generischer Clean-Code-Text, sondern ein
arbeitsfaehiges Architektur-Review fuer den aktuellen Stand des Projekts.
Es soll:

- die heute tatsaechlich sichtbaren Architekturstaerken und -schwaechen benennen
- veraltete Kritikpunkte aus frueheren Refactor-Staenden aussondern
- konkrete, priorisierte Folgearbeit ableiten
- als Referenz fuer kuenftige Refactor- oder Stabilitaetsplaene dienen

## Scope und Methode

Geprueft wurden vor allem die architekturrelevanten Einstiegsmodule und ihre
Shared-Abhaengigkeiten:

- `js/games/sheetMusicMic/sheetMusicMicExercise.js`
- `js/games/notePlayingExercise/notePlayingExercise.js`
- `js/games/akkordTrainer/akkordTrainer.js`
- `js/tools/guitarTuner/guitarTuner.js`
- `js/shared/audio/*`
- `js/shared/music/sheetMusicLogic.js`
- `js/utils/settings.js`
- bestehende Architektur- und Unit-Tests

Wichtig: Das Review bewertet den aktuellen Ist-Zustand. Aussagen aus aelteren
Plaenen wurden nur uebernommen, wenn sie im heutigen Code noch belegbar sind.

## Kurzfazit

Die uebergeordnete Architektur ist im Kern solide:

- Shared-Domain- und Audio-Bausteine sind klarer als noch in frueheren Phasen.
- Pure-Logic-Module existieren in den kritischen fachlichen Kernen und sind
  meist gut testbar.
- Die Controller-Landschaft ist nicht mehr pauschal "unsauber", sondern
  unterschiedlich reif: `guitarTuner` ist bereits gut modularisiert,
  `akkordTrainer` mittelgross und noch gemischt, `sheetMusicMic` bleibt der
  groesste Problemtraeger.

Die derzeit groessten Risiken liegen nicht mehr primaer im Schichtenmodell,
sondern in drei sehr konkreten Punkten:

1. `sheetMusicMicExercise.js` ist weiterhin ein ueberladener Controller mit
   innerer, schwer direkt testbarer Ablauf- und Fehlerlogik.
2. Es gibt reale Lifecycle-/Timeout-Risiken nach `unmount()` in
   `sheetMusicMic`.
3. Kleine, aber klare DRY-Luecken bei Audio-Session-Wrappers und
   Feedback-/Settings-Mustern sind noch offen.

## Delta zum frueheren Review

Einige fruehere Kritikpunkte sind heute nur noch eingeschraenkt oder gar nicht
mehr zutreffend:

- `guitarTuner` mischt nicht mehr ungeordnet alles in einer Datei. Die Datei
  bleibt mit rund 310 Zeilen relevant, delegiert aber sichtbar an
  `guitarTunerUI.js`, `guitarTunerState.js`, `guitarTunerAudioSession.js`,
  `guitarTunerGuidedMode.js` und `tunerLogic.js`.
- `akkordTrainer` ist weiterhin controllerlastig, hat aber bereits ein eigenes
  `akkordLogic.js` und eine saubere Trennung des eigentlichen Validierens.
- `js/utils/settings.js` ist heute kohaerent. Es enthaelt nur Slider-/String-
  Settings-Wiring und keinen Storage-Mix mehr. Fruehere Kritik an gemischter
  Verantwortlichkeit ist fuer den aktuellen Stand ueberholt.
- Die Shared-Audio-Schicht ist deutlich konsolidierter als in fruehen
  Refactor-Phasen; die Problemstellen liegen heute eher in Feature-Controllern
  als im gemeinsamen Unterbau.

Diese Korrekturen sind wichtig, damit das Dokument nicht alten Umbauzustand
fortschreibt.

## Kriterienkatalog

Die Bewertung kombiniert klassische Clean-Code-/SOLID-Kriterien mit
projektpassenden Architekturfragen fuer eine Browser-App mit Audio-Pipeline und
Vanilla-JS-Features.

| # | Kriterium | Gewicht | Warum hier relevant |
|---|-----------|---------|---------------------|
| 1 | Single Responsibility | Hoch | Controller tragen viel Ablauf- und Browser-Wiring |
| 2 | Separation of Concerns | Hoch | Logik, DOM, Audio und Lifecycle muessen getrennt bleiben |
| 3 | Testability | Hoch | Regressionssicherheit haengt stark von isolierbarer Ablauflogik ab |
| 4 | DRY | Mittel | Wiederholte Session-/Settings-/Feedback-Muster sind sichtbar |
| 5 | Cohesion & Coupling | Mittel | Modulzuschnitt entscheidet ueber Refactor-Kosten |
| 6 | Error Boundary Completeness | Hoch | Audio-/Mic-Features brauchen robuste Fehlerrouten |
| 7 | Naming & Conventions | Niedrig-Mittel | Nicht kritisch, aber fuer Wartbarkeit relevant |
| 8 | Observability | Mittel | Audio-Probleme sind ohne Debug-Sicht schwer reproduzierbar |
| 9 | Dependency Boundaries | Mittel | Shared-/Component-/Feature-Grenzen sollen stabil bleiben |
| 10 | Behavioral Completeness | Hoch | State-Machines und asynchrone Transitions muessen vollstaendig sein |

## Analyse nach Kriterium

### 1. Single Responsibility

Bewertung: `sheetMusicMic` schlecht, `notePlayingExercise` mittel,
`guitarTuner` gut, `akkordTrainer` mittel

#### Positiv

- `guitarTuner.js` orchestriert primär Lebenszyklus und Analyse-Loop, waehrend
  UI, State-Aufbau, Guided-Mode und Audio-Session ausgelagert sind.
- `notePlayingExercise.js` ist noch ein Controller, aber deutlich fokussierter
  als `sheetMusicMic`.
- `akkordLogic.js`, `tunerLogic.js`, `sheetMusicLogic.js`,
  `fastNoteMatcher.js` und `noteOnsetGate.js` zeigen, dass fachliche Kerne
  bereits sinnvoll separiert werden.

#### Negativ

- `js/games/sheetMusicMic/sheetMusicMicExercise.js` hat mit 647 Zeilen weiter
  zu viele Belange in einem Modul:
  - Debug-Subsystem
  - Notenpool-/Taktgenerierung
  - Sequenz-Navigation
  - DOM-Feedback und Rendering-Anstoss
  - Mikrofon-/Audio-Lifecycle
  - Pitch-Matching-Orchestrierung
  - Settings-Wiring
- `analyzeFrame()` ist weiterhin der deutlichste Hotspot: Onset-Gate,
  Klassifikation, Mode-Regeln, Debug-Snapshot und Event-Reaktion liegen in
  einem Pfad.
- `akkordTrainer.js` mischt weiterhin UI-Querying, Rundensteuerung,
  Positionsmutation und Feedback-Timeouts in einem Modul. Das ist kleiner als
  bei `sheetMusicMic`, aber architektonisch noch nicht sauber geschnitten.

### 2. Separation of Concerns

Bewertung: gut im Shared-Bereich, mittel in Feature-Controllern

#### Staerken

- `js/shared/audio/` ist sauber von DOM abgekoppelt.
- `js/shared/music/sheetMusicLogic.js` bleibt pure.
- Die projektweite Richtung aus den frueheren Refactor-Phasen ist sichtbar:
  Shared-/Domain-/UI-Bausteine existieren und werden genutzt.

#### Bruchstellen

- `sheetMusicMicExercise.js` haelt die Schichten logisch nur teilweise
  auseinander; testbare Ablaufregeln liegen noch im Controller.
- `akkordTrainer.js` liest aktive Kategorien direkt aus dem DOM
  (`getActiveCategories()`), obwohl dies konzeptuell ein Input-Parsing-Thema
  und keine Spiellogik sein sollte.
- In `notePlayingExercise.js` sind Ablaufregeln und UI-Reaktionen zwar kleiner,
  aber immer noch direkt ineinander verdrahtet.

### 3. Testability

Bewertung: gut im Kern, mittel-schlecht in den Feature-Controllern

#### Positiv

- Shared- und Logic-Module sind breit unit-getestet.
- Es gibt bereits architekturnahe Tests, z. B.
  `tests/unit/architectureBoundaryGuards.test.js`.
- `sheetMusicLogic.edgeCases.test.js` deckt relevante Randfaelle des
  Notenpools ab.

#### Problematisch

- Die kritische Controller-Logik in `sheetMusicMicExercise.js` bleibt hinter
  Factory-Scope verborgen und ist nur indirekt testbar.
- `handleCorrectNote()`, `handleWrongNote()`, `advanceToNextNote()` und
  `generateNewBars()` in `sheetMusicMic` bilden zusammen eine kleine
  Zustandsmaschine, die nicht als eigenstaendige testbare Einheit vorliegt.
- `akkordTrainer.js` besitzt keine separate testbare Ablauf- oder
  Rundenlogik-Schicht.
- `notePlayingExercise.js` ist besser beherrschbar als `sheetMusicMic`, aber
  Success-/Retry-/Advance-Verhalten steckt ebenfalls controllerintern.

#### Architektonische Konsequenz

Das Projekt ist heute nicht "untestbar", aber dort, wo das Verhalten am
fragilsten ist, sind die Tests am wenigsten direkt. Genau diese Asymmetrie
erhoeht kuenftige Refactor-Kosten.

### 4. DRY

Bewertung: mittel

#### Eindeutige Duplikate

- `js/games/sheetMusicMic/sheetMusicMicAudioSession.js`
- `js/games/notePlayingExercise/notePlayingAudioSession.js`

Beide Wrapper sind fast identisch:

- `create*AudioSession()` delegiert an `createAudioSessionState`
- `open*AudioSession()` setzt `currentFftSize = 0` und ruft denselben
  Shared-Open-Pfad
- `close*AudioSession()` setzt `currentFftSize` im Reset wieder auf `0`

Das ist eine echte, kleine Duplikation ohne fachlichen Mehrwert.

#### Teilweise Duplikate

- `updateFeedback()` in `sheetMusicMicExercise.js` und
  `notePlayingExercise.js` ist aehnlich, aber nicht identisch genug, um eine
  sofortige Extraktion zu erzwingen.
- Das Settings-Wiring nutzt bereits gemeinsame Utilities in
  `js/utils/settings.js`; hier liegt heute eher "leichte Wiederholung" als ein
  echtes Architekturproblem vor.

#### Fazit

DRY ist kein flaechiges Problem mehr. Die verbliebenen Duplikate sind klein,
lokal und gut fuer gezielte Bereinigung geeignet.

### 5. Cohesion & Coupling

Bewertung: gut bis mittel

#### Gute Kohäsion

- `js/shared/audio/audioSessionService.js` kapselt den Session-Lifecycle klar.
- `js/shared/audio/fastNoteMatcher.js` und
  `js/shared/audio/noteOnsetGate.js` sind fachlich eng und sauber geschnitten.
- `js/utils/settings.js` ist intern konsistent.

#### Schwache Kohäsion / zu viel Orchestrierung

- `sheetMusicMicExercise.js` bleibt das Hauptbeispiel fuer schwache Kohäsion.
- `akkordTrainer.js` ist funktional noch zusammenhaengend, aber die Datei
  haelt mehr Verantwortung als fuer den aktuellen Umfang sinnvoll ist.

#### Unnoetige Kopplung

- Die Feature-spezifischen FFT-Audio-Session-Wrapper koppeln Features an eine
  triviale Thin-Layer-Datei, statt eine gemeinsame kleine Factory zu nutzen.

### 6. Error Boundary Completeness

Bewertung: mittel-schlecht

#### Bereits gut behandelt

- Mikrofonzugriff wird in `sheetMusicMic`, `notePlayingExercise` und
  `guitarTuner` abgefangen und sichtbar rueckgemeldet.
- `audioSessionService.js` raeumt bei Fehlern konsequent Stream und
  `AudioContext` auf.

#### Offene Risiken

1. Timeout-Callbacks nach `unmount()` in `sheetMusicMic`

   In `handleCorrectNote()` und `handleWrongNote()` laufen `setTimeout`-
   Callbacks weiter, ohne zentrale Verwaltung oder harte Lifecycle-Grenze.
   Nach `unmount()` wird `ui = null` gesetzt; die Folgelogik ruft zwar teilweise
   Hilfsfunktionen mit `if (!ui) return`, verlaesst sich aber auf verstreute
   Guards statt auf saubere Timeout-Kontrolle.

2. Leerer Note-Pool wird fachlich nicht explizit behandelt

   `getFilteredNotes(maxFret, activeStrings)` kann leer sein; das ist durch
   Tests belegt. `generateBars()` faellt dann still auf `NOTES` zurueck. Das
   verhindert zwar einen Crash, verletzt aber die Nutzererwartung: Die UI kann
   einen extrem eingeschraenkten oder sogar leeren Filterzustand anzeigen,
   waehrend intern wieder der Default-Pool verwendet wird.

   Das ist weniger ein Crash- als ein Integritaetsproblem:
   "ungueltige Einstellung" wird nicht offen behandelt, sondern implizit
   uebersteuert.

3. AudioContext-Resume bleibt fragil

   `audioSessionService.js` ruft `resume()` bei `suspended` zwar auf, prueft den
   Zustand danach aber nicht erneut. Der offene Plan
   `plans/audiocontext-resume-ohne-button-2026-05-01.md` adressiert genau diese
   Restluecke.

### 7. Naming & Conventions

Bewertung: insgesamt ordentlich, mit kleineren Inkonsistenzen

#### Positiv

- `create*Feature()` ist als Export-Muster weitgehend konsistent.
- Shared-Pfade und Dateinamen sind inzwischen deutlich lesbarer als in den
  fruehen Umbauphasen.

#### Inkonsistenzen

- Controller-Dateien sind teilweise explizit benannt (`sheetMusicMicUI.js`,
  `guitarTunerUI.js`), waehrend der eigentliche Controller mal den nackten
  Feature-Namen traegt, mal mit `Exercise` endet.
- Zeitkonstanten und Feedback-Dauern sind nicht projektweit vereinheitlicht.
  Das ist kein harter Architekturfehler, aber ein Zeichen leicht divergierender
  Feature-Konventionen.

### 8. Observability

Bewertung: ausreichend, aber ungleich verteilt

#### Staerken

- `sheetMusicMic` besitzt ein brauchbares Debug-System mit Ring-Buffer,
  Snapshot und `?debug-audio=1`.
- Die E2E-Tests nutzen dieses Debug-Signal bereits als Beobachtungsoberflaeche.

#### Luecken

- `notePlayingExercise` und `guitarTuner` haben kein vergleichbares
  instrumentiertes Debug-Modell fuer Analyseentscheidungen.
- Audio-Probleme sind damit featureabhaengig unterschiedlich gut
  reproduzierbar.

#### Bewertung

Kein P0-Thema, aber ein klarer Kandidat fuer wiederverwendbare Shared-
Observability im Audio-Bereich.

### 9. Dependency Boundaries

Bewertung: gut

#### Staerken

- Die grobe Schichtung `shared/domain/components <- features/pages` ist im
  aktuellen Bestand plausibel.
- Architekturgrenzen sind nicht nur Konvention, sondern bereits teilweise
  automatisiert getestet.

#### Restthema

- Einzelne Controller importieren konkrete Abhaengigkeiten direkt, wo
  optionale Dependency Injection fuer Tests oder Spezialfaelle helfen koennte.
  Das ist vor allem ein Testbarkeits- und weniger ein Schichtproblem.

### 10. Behavioral Completeness

Bewertung: mittel

#### Gut abgesichert

- `fastNoteMatcher` und `noteOnsetGate` haben klarere, testbare
  Zustandslogiken als die Controller, die sie verwenden.

#### Fragile Stellen

- `sheetMusicMic` hat mehrere asynchrone Uebergaenge
  (`accept -> delay -> advance`, `reject -> delay -> restart`,
  `endless -> regenerate`) in einem Modul ohne explizite
  Lebenszyklusverwaltung fuer Pending-Timeouts.
- `notePlayingExercise` verwaltet seinen Advance-Timeout deutlich sauberer
  ueber `state.advanceTimeout`; genau diese Technik fehlt `sheetMusicMic`.
- `akkordTrainer` nutzt ein unverwaltetes `setTimeout()` fuer den
  Rundenwechsel und prueft nur indirekt ueber `rootElement?.classList`.
  Das ist funktional ausreichend, aber nicht ideal als Lifecycle-Modell.

## Priorisierte Massnahmen

### P0 - Stabilitaet und Verhaltenssicherheit

| ID | Massnahme | Begruendung | Aufwand |
|----|-----------|-------------|---------|
| P0-1 | `sheetMusicMic` auf verwaltete Timeout-Handles umstellen | entfernt Lifecycle-Risiken nach `unmount()` und macht Verhalten testbarer | S |
| P0-2 | Leeren/ungueltigen Note-Pool fachlich explizit behandeln | verhindert stilles Zurueckfallen auf Default-Noten trotz gegenteiliger UI-Einstellung | S |
| P0-3 | AudioContext-Resume-Plan umsetzen | offener Betriebsfall mit direkter Nutzerwirkung | M |

### P1 - Wartbarkeit und Testbarkeit

| ID | Massnahme | Begruendung | Aufwand |
|----|-----------|-------------|---------|
| P1-1 | `sheetMusicMic` Analyse-/Sequenzlogik in testbare Hilfsbausteine extrahieren | groesster Hebel fuer kuenftige Refactors | M |
| P1-2 | generische FFT-Audio-Session-Factory einfuehren | beseitigt triviale Wrapper-Duplikate | S |
| P1-3 | `akkordTrainer` Runden-/Input-Logik aus dem DOM loesen | bessere Unit-Tests, klarere Schichten | M |
| P1-4 | `notePlayingExercise` Success-/Retry-Flow expliziter modellieren | senkt Controller-Komplexitaet weiter | M |

### P2 - Konsistenz und Plattformverbesserung

| ID | Massnahme | Begruendung | Aufwand |
|----|-----------|-------------|---------|
| P2-1 | gemeinsames Audio-Debug-/Tracing-Modell fuer mehrere Features | reproduzierbarere Audio-Fehleranalyse | M |
| P2-2 | leichte Konventionsangleichung bei Controller-/Exercise-Naming | verbessert Lesbarkeit, kein Sofortnutzen | S |
| P2-3 | weitere Architektur-Guard-Tests fuer kritische Importgrenzen | haelt den aktuellen Zuschnitt langfristig stabil | S-M |

## Empfohlene Umsetzungsreihenfolge

1. `sheetMusicMic` Timeout- und Pool-Validierung stabilisieren.
2. AudioContext-Resume-Thema separat abschliessen.
3. Danach erst Controller-Refactor fuer `sheetMusicMic` angehen, damit nicht
   auf instabiler Verhaltensbasis umgebaut wird.
4. `akkordTrainer` und kleine DRY-Bereinigungen anschliessend in einer
   Wartbarkeitsiteration nachziehen.

## Gesamtbewertung

| Bereich | Bewertung |
|---------|-----------|
| Shared-Audio- und Logic-Schicht | gut |
| Architekturgrenzen / Layering | gut |
| Testbarkeit von Pure Logic | gut |
| Controller-Zuschnitt insgesamt | mittel |
| `sheetMusicMic` Controller | schlecht |
| Fehler- und Lifecycle-Robustheit | mittel-schlecht |
| DRY-Situation | mittel |
| Observability projektweit | mittel |

## Schlussbewertung

GuitarTools hat die grobe Architekturkrise frueherer Phasen bereits hinter sich.
Die Basis ist heute tragfaehig: Shared-Services, Logic-Module und erste
Architektur-Guards sind vorhanden. Das Hauptproblem ist inzwischen enger
lokalisiert und dadurch besser adressierbar.

Der naechste Architekturgewinn liegt nicht in einem erneuten grossen
Repo-Umbau, sondern in gezielter Verfeinerung weniger Hotspots:

- `sheetMusicMic` als Stabilitaets- und Testbarkeitsbaustelle
- `akkordTrainer` als kleinerer SoC-Kandidat
- vereinheitlichte Audio-Session- und Debug-Helfer als low-risk Cleanup

Damit ist das Projekt architektonisch nicht "fertig", aber in einem Zustand,
in dem inkrementelle, gut begrenzte Verbesserungen den hoechsten Nutzen pro
Aufwand liefern.
