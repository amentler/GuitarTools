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
Aktuelle Strategien:

- `xgboost-android-firefox` (**Default**): Offline-ONNX-Onset-Erkennung mit dem Android-Firefox-Modell, Peak-Picking und konservativer Schwelle. Das Modell liegt unter `models/onset_detector_android_firefox.onnx`.
- `guitar-onset-sweep-standard`: Heuristische Sweep-Basis-Strategie; wird intern als Feature-Basis fuer das XGBoost-Modell verwendet, ist aber auch als eigenstaendiger Fallback-Detektor verfuegbar.

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
Detector. Der Sweep und externe Configs koennen diese Werte weiter
ueberschreiben, ohne die Detector-Logik zu aendern.

## Pitch-Strategien

Die Pitch-Registry liegt in `js/shared/audio/sheetMusicRecognition.js`.
Aktuelle Strategien:

- `fast-note-matcher`: JS-Strategie auf Basis der bestehenden
  `fastNoteMatcher`-Logik, erweitert um Sheet-Music-Toleranz und
  Zielton-Harmonik.
- `essentia-pitch-yin`: Pitch-Erkennung via Essentia.js (WASM). Wenn die
  Essentia-Instanz noch nicht geladen ist, liefert sie `unsure`.

Besonderheiten der Pitch-Pipeline:
- **Soften-Logik:** `softenSheetMusicFrameResult` korrigiert physikalische Artefakte. Z. B. wird ein als D2 erkanntes Signal als korrektes D3 akzeptiert, da die D-Saite oft starke Subharmonische erzeugt.
- **Harmonische Bewertung:** `getSheetMusicTargetHarmonicScore` prueft gezielt die Obertoene der Zielnote im Spektrum, um die Erkennung bei Hintergrundgeraeuschen zu stabilisieren.

## Transposition (Gitarren-Notation)

Die Gitarre ist ein transponierendes Instrument. Dies wird in der Übung wie folgt gehandhabt:
- Die **Notation** (VexFlow-Darstellung) zeigt die Noten eine Oktave höher an, als sie tatsächlich klingen (z. B. wird die tiefe E-Saite als E3 notiert).
- Die **Pitch-Erkennung** arbeitet auf der physikalisch klingenden Frequenz (die tiefe E-Saite klingt als E2).
- Das Mapping erfolgt in `js/shared/music/sheetMusicLogic.js` über die Zuordnung von `vfKey` (notierte Lage) zu `name/octave` (klingende Lage).

## Audio-Analyse-Tool

Das Tool `js/tools/audioAnalyse/audioAnalyseEngine.js` nutzt dieselben
Strategie-Registries wie die Uebung:

- Onset ueber `resolveGuitarOnsetStrategy(...)`.
- Pitch ueber `resolveSheetMusicRecognitionStrategy(...)` bzw.
  `classifySheetMusicFrame(...)`.

Der Zweck ist Diagnose statt Training. Pro Frame werden Daten wie RMS,
Spektralfluss, Band-Ratio, Onset-Markierung, erkannte Frequenz, Note und Cents
gesammelt und visualisiert. Die finale Bewertung sollte jedoch immer gegen
`sfp` bzw. die echten Sequenz-Fixtures erfolgen.

## Fingerprint und Sweep Runner

- `npm run sfp`: (Sheet- and Note-Fingerprint) Der umfassendste Test. Er prüft sowohl Sequenzen als auch Einzelnoten auf Fixtures und vergleicht alle Pitch-Strategien (JS vs. Essentia).
- `npm run sheetfingerprint`: Fokus auf die zeitliche Abfolge und Onset-Akzeptanz in Sequenz-Fixtures.
- `npm run onsetsweep`: Startet `scripts/sheet-onset-sweep.mjs` zur Parameteroptimierung.

**Technische Details zum Sweep:**
- **Multi-Threading:** Nutzt Worker-Threads (`sheet-onset-sweep-worker.mjs`), um Tausende Parameter-Kombinationen parallel zu evaluieren.
- **Parametrisierung:** Die `sweep-spec.json` definiert Suchbereiche und Schrittweiten (linear/logarithmisch) für den Detector.

## Zusammenhang der Werkzeuge (Feedback-Loop)

1. **Problemaufnahme:** In `Audio Analyse` RMS, Flux, Pitch und Onsets visuell vergleichen.
2. **Optimierung:** Falls Schwellenwerte betroffen sind, `onsetsweep` nutzen. Die Ergebnisse (`best-*.config.json`) werden manuell in `js/shared/audio/guitarOnsetStrategies.js` in die Konstante `SWEEP_STANDARD_GUITAR_ONSET_OPTIONS` übernommen.
3. **Validierung:** Mit `npm run sfp` sicherstellen, dass die neuen Werte auf dem gesamten Test-Set (nicht nur dem Sweep-Subset) besser performen, ohne Regressionen zu verursachen.
4. **Logik-Änderung:** Falls Parameter allein nicht ausreichen, muss die Code-Logik im Detector oder der Pitch-Strategie angepasst werden.

## Praktische Einordnung

Fuer Onsets ist Undercounting meist schlimmer als moderates Overcounting:
fehlende Onsets blockieren echte Noten komplett, waehrend zusaetzliche Onsets
nur neue Pitch-Pruefungen ermoeglichen. Falsche akzeptierte Noten entstehen
erst, wenn auch die Pitch-Strategie eine Zielnote bestaetigt.

Fuer Pitch ist es umgekehrt: eine zu permissive Pitch-Strategie kann falsche
Noten akzeptieren. Deshalb sollten Onset- und Pitch-Probleme in Reports
getrennt betrachtet werden.
