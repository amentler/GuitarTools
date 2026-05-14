# Plan: Adaptive Guitar-Onset-Parameter

**Erstellt:** 2026-05-10  
**Status:** Parametrisierbare Onset-Experimente und strategieuebergreifender
Sweep mit getaggtem Onset-Scoring implementiert; weiteres Strategie-Tuning offen

## Umsetzungsstand 2026-05-10

- Phase 1 erledigt: `DEFAULT_GUITAR_ONSET_OPTIONS` ist die zentrale
  Detector-Konfiguration und `updateGuitarOnsetDetector()` nimmt normalisierte
  Optionen an.
- Phase 2 erledigt: der Onset-State fuehrt lokalen Sustain-Floor und
  Flux-Historie.
- Phasen 3 bis 5 technisch nutzbar: relative RMS-Reattack, relative spektrale
  Neuheit und Cooldown-Override sind per Optionen aktivierbar. Die Defaults
  halten diese Pfade deaktiviert, damit bestehende Guardrails reproduzierbar
  bleiben.
- Phase 6 erledigt: `sheetfingerprint` und `sfp` akzeptieren
  `--onset-config path/to/config.json`; Analyse-Parameter und
  Detector-Optionen werden in den Report uebernommen.
- Phase 7 erledigt als erste autonome Version: `npm run onsetsweep -- --spec ...`
  fuehrt einen resumierbaren Beam-Search-Sweep aus, speichert JSONL/CSV/Markdown
  und schreibt die besten Configs als `best-*.config.json`.
- Update 2026-05-14: Der Sweep optimiert pro Runde alle registrierten
  Onset-Strategien separat, nutzt `manifest.onsetsMs` fuer Timing-Scoring
  und schreibt zusaetzlich strategie-spezifische Best-Artefakte. `runsweep.ps1`
  startet den Standard-Sweep mit 20 Workern.

## Ziel

Der `guitarOnsetDetector` soll ueber ein explizites Parameter-Objekt steuerbar
werden. Bestehende und neue Onset-Heuristiken sollen von aussen variiert werden
koennen, damit `sfp` und spaeter ein Sweep-Runner messbar zeigen, welche
Parameterkombination schnelle Reattacks verbessert, ohne Guardrails zu
verschlechtern.

## Verstaendnis

- Ein Gitarrenschlag darf als Onset erkannt werden, auch wenn Pitch- und
  Accept-Logik danach separat entscheiden, ob die Note passt.
- Ein rein fixes Gate reicht nicht aus. Ein Onset soll relativ zur aktuell
  ausklingenden Lautstaerke und zum aktuell klingenden Spektrum bewertet werden.
- Parameter sollen experimentierbar sein: Werte aendern, viele Varianten laufen
  lassen, Ergebnis vergleichen.
- Steuerbar sein sollen Schwellenwerte, Fensterdauer, Hop/Cadence, Cooldown und
  neue adaptive Reattack-Parameter.
- Jede neue Variable muss Verhalten beeinflussen und per `sfp` sichtbar werden.

## Fachliche Anforderungen

- `updateGuitarOnsetDetector()` bleibt die Quelle der Wahrheit fuer echte
  Produkt-Onsets.
- Alle Onset-Parameter werden ueber ein zentrales Objekt steuerbar.
- Bestehende Defaults bleiben zunaechst kompatibel, damit aktuelle Guardrails
  reproduzierbar bleiben.
- Neue adaptive Parameter erkennen Reattacks waehrend Sustain ueber:
  - Lautstaerkeanstieg relativ zu einem lokalen Sustain-Floor.
  - Spektrale Neuheit relativ zur lokalen Spektral-Historie.
  - Optionales Cooldown-Override bei starkem Reattack.
- `sfp` kann die Onset-Konfiguration an den Detector weiterreichen.
- Ein Experiment-Runner kann spaeter Parameterkombinationen vergleichen.

## Parameter

### Bestehende Detector-Parameter

- `minRms`
- `minFlux`
- `minBandRatio`
- `binDelta`
- `cooldownFrames`
- `firstFrameRms`
- `rmsSpikeFactor`
- `rmsMinDelta`
- `spectralActivityDb`
- `minActiveBandRatio`
- `dbFloor`
- `startBin`
- `endBin`

### Analyse- und SFP-Parameter

- `onsetFrameSize`
- `onsetHopSize`
- `analyzeIntervalMs`

### Neue adaptive Parameter

- `sustainFloorDecay`
- `sustainFloorAttack`
- `relativeReattackFactor`
- `relativeReattackMinDelta`
- `relativeFluxFactor`
- `fluxHistoryDecay`
- `spectralNoveltyRatio`
- `spectralNoveltyMinBins`
- `cooldownOverrideFactor`
- `cooldownOverrideMinFlux`
- `cooldownOverrideMinBandRatio`

## Vorgehen

### Phase 1: Parameter-Objekt einfuehren

- Zentrales Default-Objekt ergaenzen, z. B.
  `DEFAULT_GUITAR_ONSET_OPTIONS`.
- Bestehende Konstanten erhalten oder daraus ableiten.
- `updateGuitarOnsetDetector(state, frame, options)` normalisiert Optionen
  intern.
- Validierung: bestehende Unit-Tests und `npm run sfp` liefern mit Defaults
  dieselben Werte wie vorher.

### Phase 2: Adaptiven State vorbereiten

- `createGuitarOnsetState()` um adaptive Felder erweitern:
  - lokaler RMS-/Sustain-Floor
  - lokale Flux-Historie
  - optional letzte aktive/growing Band-Muster
- Noch keine starke Verhaltensaenderung erzwingen.
- Validierung: keine Regression bei aktuellen Counts.

### Phase 3: Relative RMS-Reattack-Erkennung

- Neuen Pfad `relativeRmsAttack` implementieren.
- Ausloesen, wenn:
  - `rms >= sustainFloor * relativeReattackFactor`
  - `rms - sustainFloor >= relativeReattackMinDelta`
- Sustain-Floor folgt fallenden Pegeln langsam und steigenden Pegeln
  kontrolliert.
- Validierung:
  - `fast.wav` steigt.
  - `medium.wav` und `eeeeaaaaddddgggg.wav` overcounten nicht.

### Phase 4: Relative spektrale Neuheit

- Neuen Pfad `relativeSpectralAttack` implementieren.
- Spektral-Flux gegen lokale Flux-Historie bewerten, nicht nur gegen
  `minFlux`.
- Zusaetzlich pruefen, ob genug Frequenzbins neu oder deutlich staerker werden.
- Validierung:
  - `aeaedgdgbebeabab*.wav` steigen.
  - Narrow-band-Test erkennt weiterhin keinen Gitarrenschlag.

### Phase 5: Cooldown-Override

- Cooldown bleibt Standard gegen Doppeltrigger.
- Starke relative RMS- und Spektral-Neuheit darf Cooldown ueberstimmen.
- Validierung:
  - `fast.wav` profitiert.
  - Match-Fixtures bekommen keine starken Overcounts.

### Phase 6: SFP-Konfiguration

- `sheetMusicSequenceFingerprint` nimmt vollstaendige Onset-Konfiguration an.
- Konfiguration zunaechst bevorzugt per JSON-Datei:
  - `--onset-config path/to/config.json`
  - optional spaeter einzelne CLI-Flags fuer `onsetFrameSize` und
    `analyzeIntervalMs`.
- Validierung: Default-Run bleibt identisch, konfigurierte Runs weichen
  nachvollziehbar ab.

### Phase 7: Sweep-Runner

- Separates Skript, z. B. `scripts/sheet-onset-sweep.mjs`.
- Nimmt Parameterbereiche als JSON.
- Fuehrt Kreuzprodukt oder Kandidatenliste aus.
- Schreibt Ergebnis als Markdown/CSV/JSON.
- Bewertet Score gegen Plan-Ziele:
  - 16-Noten-Aufnahmen im Zielbereich `13..18`
  - leichte Overcounts werden milder bewertet als leichte Undercounts
  - extreme Under- und Overcounts bleiben starke Negativsignale

Status: erledigt als Beam-Search statt vollem Kreuzprodukt. Die Start-Spec liegt
in `plans/sheet_music_onset_repair/onset-sweep-spec.json`. Der Runner nimmt
standardmaessig alle Eintraege aus `getGuitarOnsetStrategies()` mit und kann
ueber `strategies` in der Spec auf einzelne Strategien begrenzt werden. Bei
getaggten Fixtures bewertet er Timing-Treffer bis 30 ms als gut, bis 50 ms als
akzeptabel und bestraft Misses, Duplicates und weit entfernte Zusatz-Onsets.

## Fachliche Testfaelle

- 16-Noten-Sequenzen bleiben im Bereich `13..18`.
- Leichte Overcounts oberhalb `18` werden milder bestraft als leichte
  Undercounts unterhalb `13`.
- Extreme Undercounts und extreme Guardrail-Overcounts werden hart bestraft.
- Steady Sustain triggert nicht dauerhaft neue Onsets.
- Narrow-band Noise wird weiterhin nicht als Gitarrenschlag erkannt.
- Starker Schlag waehrend Cooldown kann als Reattack erkannt werden, wenn
  Override-Bedingungen erfuellt sind.
- Default-Konfiguration bleibt reproduzierbar.

## Risiken

- Mehr Parameter vergroessern die Suchflaeche. Ohne Sweep-Runner wird Tuning
  schnell unuebersichtlich.
- Relative Gates koennen Nebengeraeusche und Resonanzen staerker triggern.
- `onsetFrameSize` und `analyzeIntervalMs` beeinflussen Timing und Cooldown
  gleichzeitig.
- Getaggte Gold-Onset-Zeitpunkte verbessern die Bewertung, muessen aber
  konsistent gepflegt werden. Ungenau getaggte Fixtures koennen konservative
  Strategien sonst falsch benachteiligen.
- Zu viele gleichzeitige Aenderungen verschleiern, welcher Parameter geholfen
  hat. Deshalb Phasen einzeln umsetzen und nach jeder Phase `sfp` vergleichen.

## Performance-Analyse 2026-05-14

- Der aktuelle strategieuebergreifende Sweep multipliziert die Kandidaten pro
  Runde mit allen registrierten Strategien. Ohne `strategies`-Einschraenkung
  werden bei `candidatesPerRound: 80` vier Strategien parallel optimiert, also
  bis zu 320 Kandidaten pro Runde.
- `analyzeIntervalMs` ist aktuell als Bereich `[25, 50]` Teil der Suche. Jeder
  eindeutige Hop erzeugt im Worker fuer alle Fixtures neue FFT-/dB-Spektren.
  Eine kleine Messung mit 4 Kandidaten und 1 Worker lag bei ca. 13,7 s und
  ca. 1 GB RSS; mit fixem `analyzeIntervalMs: [41]` lag derselbe Smoke-Umfang
  bei ca. 5,7 s und ca. 450 MB RSS.
- Der Worker berechnete `computeLinearSpectrum()` und `computeDbSpectrum()` fuer
  dasselbe Frame getrennt und fuehrte damit zwei FFTs pro Frame aus. Das wurde
  auf eine gemeinsame Spektrum-Berechnung zusammengezogen.
- Der Worker haelt vorberechnete Frame-Spektren jetzt begrenzt ueber Batches
  hinweg im Speicher (`ONSET_SWEEP_WORKER_FRAME_CACHE_CONFIG_LIMIT`, Default 2).
  Das hilft bei fixen oder wenigen Hop-Konfigurationen. Bei breit
  randomisiertem `analyzeIntervalMs` bleibt ein grosser Cache kontraproduktiv,
  weil viele unterschiedliche Hop-Konfigurationen kaum wiederverwendet werden.
- Die Runden-Artefakte sortieren und filtern die komplette Ergebnis-Historie
  mehrfach pro Runde und schreiben CSV/Markdown/Best-Dateien neu. Das ist
  gegenueber der Audioanalyse zweitrangig, waechst aber mit langen Runs.

Naechste Optimierungsrichtung:

- Fuer schnelle Tuning-Laeufe `strategies` explizit auf die Zielstrategie
  begrenzen oder `candidatesPerRound` pro Strategie reduzieren.
- `analyzeIntervalMs` nur als kleine diskrete Liste oder fixen Wert sweeppen,
  nicht als breiten Bereich.
- Worker-Hotpath weiter strategie-spezifisch optimieren: Standard-Strategien
  ohne Bandpass sollten ohne dB-Spektrum und ohne Samples auskommen koennen.
- Fuer maximale CPU-Auslastung langfristig die Arbeit nach Fixtures statt nur
  nach Kandidaten sharden oder vorberechnete Spektren pro Analyse-Konfiguration
  in SharedArrayBuffers ablegen, damit mehrere Worker nicht dieselben WAV-Frames
  erneut vorberechnen.
- Ergebnis-Artefakte nicht nach jeder Runde voll neu schreiben, sondern
  `results.jsonl` streamen und CSV/Report nur periodisch oder am Ende erzeugen.

## Offene Entscheidungen

- Adaptive Parameter initial deaktivieren oder direkt mit konservativen Defaults
  aktivieren.
- JSON-Konfiguration zuerst oder zusaetzlich direkte CLI-Flags.
- Sweep zuerst als kleines Kandidatenset oder direkt als vollstaendiges
  Kreuzprodukt.
