# Plan: Anschlag-Gating für mehrfach gespielte gleiche Noten

## Ziel

In der Übung `Noten spielen` soll eine neue Zielnote nur dann als gespielt zählen, wenn zwischen zwei Treffern ein neuer Anschlag erkannt wurde.

Konkret:

- Ein lang ausklingender Ton darf nach dem Zielwechsel nicht automatisch noch einmal dieselbe Note erfüllen.
- Eine Folge wie `E4, E4, E4` soll nur dann drei Treffer erzeugen, wenn der Nutzer drei getrennte Anschläge spielt.
- Ohne neuen Anschlag zwischen zwei Zielnoten darf nur der erste Treffer zählen; die folgenden identischen Zielnoten bleiben offen.

## Ist-Zustand

### Aktuelles Verhalten

- `js/games/notePlayingExercise/notePlayingExercise.js` ruft alle `50 ms` `classifyFrame(...)` auf.
- `js/games/sheetMusicMic/fastNoteMatcher.js` bewertet jeden Frame nur als `correct`, `wrong` oder `unsure`.
- `updateMatchState(...)` akzeptiert eine Note bereits nach `FAST_ACCEPT_STREAK = 2` aufeinanderfolgenden `correct`-Frames.
- Nach einem `accept` wird im Controller einfach auf die nächste Zielnote gewechselt und `createMatchState()` neu gestartet.

### Warum dadurch Mehrfacherkennung entsteht

Bei einer Zielsequenz mit gleicher Note hintereinander reicht ein stehender Sustain:

1. Erste Zielnote `E4` wird korrekt akzeptiert.
2. Controller schaltet auf die nächste Zielnote, z. B. wieder `E4`.
3. Der alte Ton klingt noch immer stabil als `correct`.
4. Zwei weitere `correct`-Frames reichen erneut für `accept`, obwohl kein neuer Anschlag stattfand.

Die aktuelle Logik kennt kein Konzept von:

- `Anschlag erkannt`
- `Matcher ist erneut scharfgeschaltet`
- `dieser Treffer gehört noch zum alten Sustain`

## Technische Schlussfolgerung

Das Problem sollte nicht nur über Pitch-Streaks gelöst werden. Solange das System nur auf stabile Tonhöhe schaut, bleibt ein langes Sustain von einem echten Neuanschlag derselben Note ununterscheidbar.

Es braucht zusätzlich einen **Onset-/Anschlag-Zustand** vor dem Pitch-Matcher:

- Ein Treffer darf nur möglich sein, wenn die Erkennung zuvor auf einen neuen Anschlag `re-armed` wurde.
- Nach einem `accept` muss der Matcher gesperrt bleiben, bis ein neuer Anschlag erkannt wurde.
- Reines Fortklingen derselben Note darf den Matcher nicht erneut freischalten.

## Empfohlener Ansatz

### 1. Kleinen Anschlag-Detektor als eigene reine Logik einführen

Neue Datei, z. B.:

- `js/games/sheetMusicMic/noteOnsetGate.js`

Verantwortung:

- RMS/Peak-basierte Anschlagserkennung auf Basis der Time-Domain-Daten
- Zustandsmaschine für `armed` / `blocked`
- Schutz gegen Dauerfeuer durch Cooldown und Hysterese

Vorgeschlagene State-Form:

```js
{
  armed: true,
  onsetActive: false,
  cooldownFrames: 0,
  recentRms: [],
  baselineRms: 0,
}
```

Vorgeschlagene Events:

- `onset`
- `none`

Wichtige Regel:

- `onset` nur auf steigender Flanke erzeugen, nicht für mehrere Frames während desselben Lautstärkeanstiegs.

### 2. Akzeptanz an `armed && onset seit letztem Treffer` koppeln

Der Pitch-Matcher bleibt zuständig für:

- Ist die erkannte Tonhöhe korrekt?
- Sind genug stabile Frames vorhanden?

Der neue Gate-Layer entscheidet:

- Darf diese Zielnote aktuell überhaupt akzeptiert werden?

Empfohlenes Verhalten:

1. Start einer Zielnote: Gate ist zunächst `armed = true`.
2. Ein Anschlag erzeugt `onset`.
3. Nur wenn danach `correct`-Frames kommen, darf `accept` ausgelöst werden.
4. Nach `accept`: Gate auf `armed = false`.
5. Erst ein neuer Anschlag setzt `armed = true` für die nächste Note.

Damit gilt automatisch:

- Gleiche Folgetöne ohne Neuanschlag werden nicht mehrfach gezählt.
- Unterschiedliche Töne mit klarem Neuanschlag bleiben erkennbar.

### 3. Onset und Pitch zeitlich entkoppeln

Der Anschlag selbst ist oft transient und pitch-instabil. Deshalb sollte nicht der gleiche Frame gleichzeitig

- den Anschlag erkennen und
- sofort den Treffer liefern.

Sinnvoller Ablauf:

1. `onset` erkannt
2. kurzes Fenster von wenigen Frames offenhalten
3. in diesem Fenster auf stabile `correct`-Frames warten

Dafür zusätzlicher Zustand, z. B.:

```js
{
  armed: true,
  framesSinceOnset: 0,
  onsetWindowRemaining: 4,
}
```

Regel:

- Ein `accept` ist nur erlaubt, solange das Onset-Fenster aktiv ist.
- Läuft das Fenster ab, ohne dass stabile Pitch-Erkennung kommt, wird erneut auf den nächsten Anschlag gewartet.

Das ist robuster als `accept nur exakt im Onset-Frame`.

## Konkreter Umsetzungsplan

### Phase 1: Ist-Verhalten mit Tests festnageln

Neue oder angepasste Tests:

- `tests/unit/fastNoteMatcherSequences.test.js`
- ggf. neuer Test `tests/unit/noteOnsetGate.test.js`
- ggf. Erweiterung `tests/helpers/sequenceSimulator.js`

Neue Sollfälle:

- 4× dieselbe Note mit klaren Pausen/Anschlägen → exakt 4 Accepts
- lang gehaltener Einzelton gegen Sollfolge `E4, E4, E4` → exakt 1 Accept
- 3× dieselbe Note mit kurzen echten Re-Plucks, aber wenig Sustain-Abstand → exakt 3 Accepts
- Wechsel `E4 -> F4` mit neuem Anschlag → beide werden erkannt
- Wechsel des Zieltons ohne neuen Anschlag, alter Ton klingt weiter → kein neuer Accept

Wichtig:

- Die bestehende Erwartung aus `plans/notenzeilen-akustische-pruefung.md` für `B3b` ist dafür zu locker.
- Für `Noten spielen` sollte die neue Sollregel explizit strenger werden: gleicher Ton mehrfach nur mit neuem Anschlag.

### Phase 2: Reine Onset-Logik implementieren

Neue pure Funktionen:

- `computeFrameRms(samples)`
- `createOnsetGateState()`
- `updateOnsetGate(state, samples)` oder `updateOnsetGate(state, rms)`

Heuristik-Vorschlag:

- Baseline aus gleitendem RMS-Median oder langsamem EMA
- Onset bei `currentRms >= baseline * spikeFactor`
- zusätzlich `currentRms >= absoluteMinRms`
- Rising-edge-Bedingung: vorher unter Schwelle, jetzt über Schwelle
- Cooldown von wenigen Frames gegen Mehrfachtrigger im selben Anschlag

Startwerte für erste Iteration:

- `absoluteMinRms`: nahe `FAST_MIN_RMS`
- `spikeFactor`: ca. `1.8` bis `2.5`
- `cooldownFrames`: `3` bis `6`
- `onsetWindowFrames`: `4` bis `8`

Diese Werte müssen über echte Fixtures und Mikrofontests validiert werden.

### Phase 3: Gate mit `notePlayingExercise` verdrahten

In `js/games/notePlayingExercise/notePlayingExercise.js`:

- pro Analyse-Frame zuerst Onset-Gate updaten
- dann `classifyFrame(...)` ausführen
- `updateMatchState(...)` nur dann in Richtung `accept` laufen lassen, wenn das Gate für einen neuen Treffer offen ist

Wahrscheinlich sauberste Variante:

- bestehendes `fastNoteMatcher.js` bewusst pitch-fokussiert lassen
- Gate-Verknüpfung im Controller oder in einem kleinen neuen Kombinator kapseln

Beispiel:

- `updateArmedMatchState(matchState, gateState, frameResult)`

So bleibt `fastNoteMatcher.js` wiederverwendbar und die neue Anschlag-Pflicht betrifft nur die Übungen, die sie wirklich brauchen.

### Phase 4: Optional gemeinsame Kombi-Logik für beide Mic-Übungen

Prüfen, ob `sheetMusicMicExercise` dieselbe Regel ebenfalls braucht.

Wahrscheinliche Empfehlung:

- ja, für wiederholte gleiche Noten in Notenzeilen ist dasselbe Problem vorhanden
- aber erst nach stabiler Einführung in `notePlayingExercise`

Vorgehen:

1. zunächst nur `notePlayingExercise`
2. danach Entscheidung, ob `sheetMusicMicExercise` dieselbe Gate-Logik nutzen soll

## Architekturentscheidung

### Bevorzugt

Separater Onset-Gate-Layer zusätzlich zum bestehenden Pitch-Matcher.

### Nicht empfohlen

- Nur `FAST_ACCEPT_STREAK` erhöhen
- Nur mehr `unsure`-Frames nach `accept` erzwingen
- Nur eine feste Sperrzeit nach `accept`

Warum nicht:

- Höhere Streaks verlangsamen nur die Erkennung, unterscheiden aber keinen neuen Anschlag von Sustain.
- Eine feste Sperrzeit blockiert auch legitime schnelle Wiederholungen.
- Erzwungene `unsure`-Phasen sind indirekt und hängen zu stark von Mikrofonpegel und Raum ab.

## Risiken

- Zu aggressive Onset-Schwelle: leise Anschläge werden nicht erkannt.
- Zu empfindliche Onset-Schwelle: Vibrato, Nebengeräusche oder Sustain-Modulation triggern fälschlich als neuer Anschlag.
- Tiefe Saiten haben langsameren Einschwingvorgang als hohe; ein gemeinsames Fenster muss breit genug sein.
- Browser-/Mikrofon-AGC kann RMS-basierte Schwellen verfälschen.

## Validierung

### Automatisiert

- Unit-Tests für Onset-Gate-State-Machine
- Sequenztests mit synthetischen Re-Plucks derselben Note
- Regressionstest: gehaltene gleiche Note löst nur einen Treffer aus

### Manuell

Testfälle im Browser:

- dieselbe offene Saite 4× sauber neu anschlagen
- dieselbe Saite 1× anschlagen und lange ausklingen lassen, während die App auf dieselbe Note weiterschaltet
- sehr leise Wiederholungen
- schnelle Wiederholungen mit Palm-Muting
- Wechsel von gleicher Tonhöhe auf anderer Saite mit neuem Anschlag

## Betroffene Dateien

- `js/games/notePlayingExercise/notePlayingExercise.js`
- optional `js/games/sheetMusicMic/sheetMusicMicExercise.js`
- neu `js/games/sheetMusicMic/noteOnsetGate.js`
- `tests/helpers/sequenceSimulator.js`
- neue/erweiterte Tests unter `tests/unit/`
- Dokumentation in den jeweiligen `CLAUDE.md`-Dateien

## Reihenfolge der Umsetzung

1. Regressionstests für gehaltene gleiche Noten und echte Re-Plucks ergänzen
2. Pure Onset-Gate-Logik einführen und isoliert testen
3. Gate in `notePlayingExercise` integrieren
4. Mit vorhandenen Audio-/Sequenzfixtures gegenprüfen
5. Danach entscheiden, ob `sheetMusicMicExercise` dieselbe Pflicht zum Neuanschlag erhalten soll

## Ergebnisbild nach Umsetzung

Die App akzeptiert nicht mehr einfach "stabile richtige Frequenz", sondern "stabile richtige Frequenz nach neuem Anschlag". Genau das entspricht dem gewünschten Verhalten für mehrfach hintereinander gespielte gleiche Noten.
