# Noten lesen: Audio-, Onset- und Pitch-Pipeline

## Ziel

Die Uebung `Noten lesen` akzeptiert eine gespielte Note nur dann, wenn zwei
unabhaengige Dinge zusammenpassen:

1. Es gab einen frischen Anschlag (`onset`).
2. Die danach erkannte Tonhoehe passt zur aktuell erwarteten Note (`pitch`).

Der Onset-Teil soll vor allem verhindern, dass eine ausklingende Note mehrfach
gezaehlt wird. Er muss deshalb eher echte Anschlaege finden als extrem streng
gegen Overcounting sein. Die Pitch-Strategie entscheidet danach, ob der
erkannte Klang fachlich zur Zielnote passt.

## Laufzeitpfad in der Uebung

Der zentrale Controller ist `js/games/sheetMusicReading/sheetMusicReading.js`.
Pro Analyse-Frame passiert dort:

1. Time-Domain-Daten werden aus dem `AnalyserNode` gelesen.
2. Frequency-Daten werden aus demselben `AnalyserNode` gelesen.
3. Die konfigurierte Onset-Strategie wird ueber
   `resolveGuitarOnsetStrategy(...)` geladen und mit `{ frequencyData, samples }`
   aktualisiert.
4. Bei `event === 'onset'` wird `awaitingOnset` aufgehoben. Bei einem Onset
   waehrend einer laufenden Note wird der Match-State neu gestartet.
5. Die konfigurierte Pitch-Strategie klassifiziert denselben Audio-Frame gegen
   die aktuelle Zielnote.
6. Solange `awaitingOnset === true` ist, werden Pitch-Treffer nur als `unsure`
   behandelt. Erst nach einem Onset darf ein korrekter Pitch die Note
   akzeptieren.

Damit sind Onset und Pitch absichtlich getrennt: Onset sagt "neuer Anschlag",
Pitch sagt "richtige Note".

## Onset-Strategien

Die Registry liegt in `js/shared/audio/guitarOnsetStrategies.js`.
Aktuell gibt es zwei Strategien:

- `guitar-onset-sweep-standard`: neue Standard-Strategie mit den besten
  Sweep-Werten als eingebrannte Basisoptionen.
- `guitar-onset`: Legacy-Strategie mit den Detector-Defaults ohne
  Sweep-Override.

Der Detector ist pitch-agnostisch. Er bewertet keine Note, sondern nur, ob ein
neuer Gitarrenanschlag plausibel ist. Dafuer nutzt er mehrere Evidenzen:

- RMS/Energie des Time-Domain-Frames.
- Breitband-Spektralfluss (`broadbandFlux`).
- Anteil wachsender Frequenzbaender (`bandRatio`).
- Anteil aktiver Frequenzbaender (`activeBandRatio`).
- relative Reattack gegen einen lokalen Sustain-Floor.
- relative Spektral-Neuheit gegen eine lokale Flux-Historie.
- kombinierte schwache RMS-Reattack plus zeitgleicher Flux-/Novelty-Anstieg.
- Cooldown und Cooldown-Override gegen sehr schnelle Doppeltrigger.

Die technischen Basisoptionen liegen als `DEFAULT_GUITAR_ONSET_OPTIONS` im
Detector. Die neue Standard-Strategie legt zusaetzlich die gefundenen
Sweep-Werte darueber. Der Sweep und externe Configs koennen diese Werte weiter
ueberschreiben, ohne die Detector-Logik zu aendern.

## Pitch-Strategien

Die Pitch-Registry liegt in `js/shared/audio/sheetMusicRecognition.js`.
Aktuell relevant:

- `fast-note-matcher`: JS-Strategie auf Basis der bestehenden
  `fastNoteMatcher`-Logik, erweitert um Sheet-Music-Toleranz und
  Zielton-Harmonik.
- `essentia-pitch-yin`: Strategie-Slot fuer Essentia.js PitchYin. Wenn die
  Essentia-Instanz noch nicht geladen ist, liefert sie `unsure`.

Der Einstiegspunkt ist `classifySheetMusicFrame(samples, sampleRate,
targetPitch, options)`. Die Funktion waehlt per `strategyKey` die passende
Strategie und gibt einen Frame-Status wie `correct`, `wrong` oder `unsure`
zurueck.

`updateSheetMusicMatchState(...)` akzeptiert bei `correct` sofort, weil
`SHEET_MUSIC_ACCEPT_STREAK` aktuell `1` ist. Der Onset-Gate davor entscheidet
also, ob ein korrekter Pitch in diesem Moment ueberhaupt zaehlen darf.

## Audio-Analyse-Tool

Das Tool `js/tools/audioAnalyse/audioAnalyseEngine.js` nutzt dieselben
Strategie-Registries wie die Uebung:

- Onset ueber `resolveGuitarOnsetStrategy(...)`.
- Pitch ueber `resolveSheetMusicRecognitionStrategy(...)` bzw.
  `classifySheetMusicFrame(...)`.

Der Zweck ist Diagnose statt Training. Pro Frame werden Daten wie RMS,
Spektralfluss, Band-Ratio, Onset-Markierung, erkannte Frequenz, Note und Cents
gesammelt und visualisiert.

Wichtig: Die Analyse versucht den Live-Pfad nachzubilden, kann aber mit anderen
Frame-/Hop-Groessen arbeiten. Sie ist deshalb ideal, um Korrelationen und
Fehlentscheidungen sichtbar zu machen, aber die finale Bewertung sollte immer
gegen `sheetfingerprint` bzw. die echten Sequence-Fixtures erfolgen.

## Fingerprint und Sweep Runner

`npm run sheetfingerprint` startet
`scripts/sheet-music-sequence-fingerprint.mjs`. Das Skript nutzt
`tests/helpers/sheetMusicSequenceFingerprint.js` und misst auf realen
Sequenz-Fixtures:

- akzeptierte Noten gegen erwartete Noten,
- erkannte Onsets gegen erwartete Noten,
- Under-/Overcounting,
- Onset-to-Accept-Ausrichtung,
- Strategie-Vergleich fuer Pitch- und Onset-Strategien.

`npm run onsetsweep` startet `scripts/sheet-onset-sweep.mjs`. Der Runner:

1. liest eine Sweep-Spec, z. B.
   `plans/sheet_music_onset_repair/onset-sweep-spec.json`,
2. erzeugt Kandidaten aus Parameterbereichen,
3. wandelt Kandidaten ueber `candidateToOptions(...)` in
   `onsetDetectorOptions` um,
4. zaehlt Onsets auf den Sequence-Fixtures,
5. bewertet Under-/Overcounting per Score,
6. schreibt die besten Configs als `best-*.config.json`.

Der Sweep kann nur Parameter optimieren. Er kann keine neue fachliche Logik
erfinden, z. B. "schwacher RMS-Peak zaehlt nur dann, wenn gleichzeitig
Spektralflux anzieht". Solche Kombinationslogik muss im Detector vorhanden
sein; danach kann der Sweep die Schwellen und Gewichtungen dafuer suchen.

## Zusammenhang der Werkzeuge

- `Noten lesen` ist der produktive Live-Pfad.
- `Audio Analyse` ist die visuelle Diagnose auf denselben Kernstrategien.
- `sheetfingerprint` ist die reproduzierbare Messung auf Fixture-Daten.
- `onsetsweep` ist die Parameteroptimierung fuer den Onset-Detector.
- Pitch-Strategien entscheiden, was gespielt wurde.
- Onset-Strategien entscheiden, wann ein neuer Versuch beginnt.

Eine typische Verbesserungsschleife ist:

1. Problemaufnahme in `Audio Analyse`: RMS, Flux, Pitch und Onsets visuell
   vergleichen.
2. Detector- oder Pitch-Hypothese formulieren.
3. Falls neue Entscheidungslogik noetig ist: Code im Detector bzw. in der
   Pitch-Strategie aendern.
4. Falls nur Schwellen betroffen sind: `onsetsweep` bzw. Config testen.
5. Mit `npm run sheetfingerprint` pruefen, ob reale Sequenz-Fixtures besser
   werden.
6. Erst danach Default-Parameter uebernehmen.

## Praktische Einordnung

Fuer Onsets ist Undercounting meist schlimmer als moderates Overcounting:
fehlende Onsets blockieren echte Noten komplett, waehrend zusaetzliche Onsets
nur neue Pitch-Pruefungen ermoeglichen. Falsche akzeptierte Noten entstehen
erst, wenn auch die Pitch-Strategie eine Zielnote bestaetigt.

Fuer Pitch ist es umgekehrt: eine zu permissive Pitch-Strategie kann falsche
Noten akzeptieren. Deshalb sollten Onset- und Pitch-Probleme in Reports
getrennt betrachtet werden.
