# Plan: Onset-Detection-Verbesserung vor ML

**Erstellt:** 2026-05-15  
**Status:** Phase 1 und Phase 2 sind teilweise umgesetzt. Tagged-Onset-Scoring ist zwischen Sweep und SFP vereinheitlicht; der Fingerprint-Report zeigt Hit/Miss- und Timing-Metriken fuer getaggte Fixtures. Der Feature-Layer im Detector enthaelt jetzt HFC, centroid/rolloff, flatness, crest factor und subband flux als Diagnosewerte. `sfp` nutzt ausserdem Fortschrittslogs und einen Worker-Pool mit `verfuegbare Kerne - 2` (mindestens 1), damit lange Laeufe beobachtbar und besser parallelisiert sind. Offene Teile betreffen weitergehende Fehlerklassifikation, optionale Trace-Ausgaben und spaetere Strategienutzung der neuen Features.

## Ziel

Die aktuelle Onset-Erkennung soll vor einem Wechsel zu XGBoost oder neuronalen
Netzen noch deutlich robuster werden. Der Plan fokussiert daher auf:

- bessere Diagnose der aktuellen Fehlermuster
- mehrere zusaetzliche, interpretierbare Feature-Familien
- 2 bis 4 neue heuristische Strategien mit klarer Szenario-Staerke
- reproduzierbare Bewertung ueber Fingerprint, getaggte Onsets und Guardrails

## Aktueller Stand

Aktuell existieren vier Strategien in `js/shared/audio/guitarOnsetStrategies.js`:

- `guitar-onset-sweep-standard`
- `guitar-onset`
- `guitar-onset-broadband-or`
- `guitar-onset-legacy-bandpass`

Der gemeinsame Kern in `js/shared/audio/guitarOnsetDetector.js` nutzt heute vor
allem:

- RMS
- broadband spectral flux
- growing-bin / band ratio
- active-band ratio
- spectral novelty bins
- relative RMS gegen Sustain-Floor
- relative Flux gegen Flux-Historie
- bestaetigte Weak-Attacks
- Cooldown-Override

## Beobachtungen aus dem Bestand

- `sweep-standard` ist der konservativste, produktnahe Default. Er schuetzt
  besser vor Overcounts, unterzaehlt aber schnelle Reattacks und legato-nahe
  Anschlaege.
- `guitar-onset` ist etwas aggressiver und holt mehr gute/akzeptable Treffer,
  bleibt aber ebenfalls relativ stark im Undercount-Bereich.
- `broadband-or` erhoeht die Empfindlichkeit deutlich, produziert aber schnell
  zu viele Overcounts und ist damit als allgemeiner Default zu instabil.
- `legacy-bandpass` verbessert Problemfaelle wie `fast.wav` und
  `aeaedgdgbebeabab*_*.wav` sichtbar, kippt aber auf mehreren
  `sheet-music-reading`-Fixtures in zu viele Zusatz-Onsets bzw. schlechtere
  Timing-Treffer.

Arbeitshypothese:

- Das Hauptproblem ist nicht nur "Schwellenwert zu hoch", sondern eine zu
  grobe Beschreibung von Attack-Charakter.
- Relevante Fehlfaelle entstehen vermutlich aus drei Klassen:
  1. echter Reattack waehrend Sustain
  2. Saitenwechsel mit spektraler Verschiebung, aber nur moderatem RMS-Anstieg
  3. Resonanz-/Nebengeraeusch-Frames, die broadbandig genug aussehen, aber
     keine frische Transiente sind

## Fachliche Anforderungen

- Produktpfad bleibt bei `guitarOnsetDetector` plus Strategieregistry.
- Neue Strategien muessen interpretierbar und einzeln benchmarkbar bleiben.
- Fingerprint und Sweep muessen weiterhin je Strategie getrennt auswertbar sein.
- Neue Features sollen zuerst diagnostisch messbar gemacht werden, bevor sie in
  Produktentscheidungen einfliessen.
- Guardrails fuer wiederholte offene Saiten und `sheet-music-reading`-Fixtures
  duerfen nicht durch reine Empfindlichkeit verschlechtert werden.

## Zusaetzliche Analysen

### A1: Fehler-Taxonomie statt nur Count-Vergleich

- Pro Fixture Fehlfaelle in `missed reattack`, `late onset`, `double trigger`,
  `resonance false positive`, `string-change miss`, `noise false positive`
  klassifizieren.
- Ziel: die naechsten Strategien nicht allgemein "aggressiver", sondern
  gezielt gegen konkrete Fehltypen bauen.

### A2: Feature-Separierbarkeit pro Frame

- Fuer getaggte Onsets und Nicht-Onsets pro Feature Verteilungen ausgeben:
  Median, p90, p95, Overlap.
- Sinnvoll fuer bestehende und neue Features, z. B. RMS, Flux, HFC,
  Centroid-Delta, Crest-Factor, Phase-Deviation.
- Ziel: sehen, welche Features echte Onsets besser von Sustain und Resonanzen
  trennen als die bisherigen Gates.

### A3: Analyse relativ zum letzten echten Onset

- Features nicht nur frame-zu-frame, sondern relativ zum letzten erkannten oder
  getaggten Onset betrachten:
  - Pegelabfall seit letztem Onset
  - spektrale Drift seit letztem Onset
  - Transientenstaerke relativ zum lokalen Sustainmodell
- Ziel: Reattacks unter Sustain besser modellieren.

### A4: Multiband-Analyse

- Statt nur globalem Broadband-Flux getrennte Kurven fuer:
  - Low: ca. 80-220 Hz
  - Low-Mid: ca. 220-600 Hz
  - Presence/Attack: ca. 2-6 kHz
- Ziel: unterscheiden, ob ein Event eher neue Attack-Obertoene oder nur
  fortlaufende Korpus-/Saitenenergie bringt.

### A5: Zeitaufloesungs-Analyse

- Fingerprint mit mehreren Hops und ggf. zwei Framegroessen vergleichen:
  z. B. 20-25 ms und 40-50 ms.
- Ziel: pruefen, ob ein Teil der Undercounts aus zu grober zeitlicher
  Abtastung stammt und nicht aus falscher Heuristik.

### A6: Per-Feature-Ablation

- Jede Bedingung im Detector einzeln deaktivieren bzw. nur einzeln aktivieren.
- Ziel: verstehen, welche Pfade tatsaechlich tragen und welche nur Rauschen in
  die Entscheidungslogik bringen.

### A7: Timing-Qualitaet staerker gewichten

- Nicht nur `under/over/exact`, sondern fuer getaggte Fixtures ein explizites
  One-to-one-Matching `Tag <-> erkannter Onset` innerhalb eines klaren Fensters.
- Primaere Bewertungslogik fuer getaggte Fixtures:
  - `good hit` innerhalb ca. `+-30 ms`
  - `hit` bzw. `acceptable hit` innerhalb ca. `+-70 ms`
  - `miss`, wenn kein Match im Fenster liegt
  - `duplicate`, wenn mehrere Detektionen um denselben Tag clustern
  - `false positive`, wenn ein erkannter Onset zu keinem Tag passt
- Sekundaere Timing-Metriken auf Basis der gematchten Treffer:
  - Median- oder Mean-Abweichung zum Tag
  - p95-Fehler
  - Maximum der absoluten Abweichung
  - Frueh-vs-spaet-Bias
- `Standardabweichung` ist optional nur als Diagnosewert sinnvoll, aber nicht
  als Fuehrungsmetrik fuer die Fingerprint-Qualitaet.
- Ziel: Strategien vermeiden, die Counts verbessern, aber zeitlich unsauber
  werden.

### A8: Bewertungslogik zwischen Sweep und Fingerprint vereinheitlichen

- `onsetsweep` und `sfp` duerfen fuer getaggte Onsets nicht mit zwei
  unterschiedlichen Regeln arbeiten.
- Die bestehende Tagged-Onset-Logik aus dem Sweep soll in einen gemeinsamen
  Helper extrahiert und von beiden Pfaden genutzt werden.
- Fuer ungetaggte Fixtures bleibt das bisherige Count-Fallback bestehen.
- Ziel: dieselben Strategien bekommen in Sweep und Fingerprint dieselbe
  fachliche Bewertung, nur mit unterschiedlicher Darstellung.

## Sinnvolle neue Feature-Familien vor ML

### F1: High-Frequency Content (HFC)

- Gewichtet hohe Frequenzen staerker als tiefe.
- Besonders plausibel fuer Plektrum-/Fingerattack, weil frische Transienten oft
  mehr Energie im oberen Bereich bringen als reines Sustain.
- Erwarteter Nutzen:
  - besser gegen Resonanz-Sustain
  - hilfreich fuer Reattack trotz moderatem RMS

### F2: Spectral Centroid / Rolloff / Brightness-Delta

- Nicht nur "mehr Energie", sondern "wird das Signal ploetzlich heller".
- Sinnvoll bei Saitenwechseln und frischen Attacken mit kurzer Helligkeitsspitze.
- Erwarteter Nutzen:
  - Reattacks erkennen, die spektral heller werden, obwohl broadband flux nur
    mittel ausfaellt

### F3: Spectral Flatness / Tonality-Delta

- Attacke ist oft kurzzeitig noisiger und flacher als das folgende Sustain.
- Erwarteter Nutzen:
  - Resonanzen von echten Transienten trennen
  - Hilfreich als Anti-False-Positive-Feature

### F4: Subband Flux / Weighted Flux

- Flux getrennt pro Band oder mit Gewichtung fuer attack-relevante Bereiche.
- Erwarteter Nutzen:
  - besser als globaler Flux, wenn nur bestimmte Frequenzbereiche neu anspringen

### F5: Crest Factor / Peak-to-RMS / Envelope Slope

- Zeitbereichsmerkmale fuer Impulscharakter.
- Erwarteter Nutzen:
  - kurze Anschlaege gegen gleichmaessiges Sustain oder Brumm-/Raumanteile

### F6: Zero-Crossing-Rate-Differenz

- Als schwaches Zusatzsignal, nicht als Hauptkriterium.
- Erwarteter Nutzen:
  - kann bei transient/noisigen Anteilen helfen, ist aber fuer Gitarrensignal
    allein zu instabil

### F7: Complex-Domain oder Phase-Deviation-Onset

- Nutzt Phasenentwicklung zwischen FFT-Frames, nicht nur Magnituden.
- Erwarteter Nutzen:
  - erkennt frische Transienten auch dann, wenn Magnitudenveraenderung klein ist
- Risiko:
  - deutlich aufwendiger und fehleranfaelliger als RMS/Flux
- Dennoch sinnvoll als letzter heuristischer Schritt vor ML

### F8: Harmonic-vs-Transient-/Percussive-Anteil

- Leichtgewichtige Naeherung statt voller HPSS:
  - Transientenstaerke aus schneller Helligkeits- und Flux-Komponente
  - Harmonie-/Sustain-Indikator aus stabileren Bins
- Erwarteter Nutzen:
  - falsche Trigger auf langem Sustain reduzieren

## Empfohlene neue Strategien

### S1: Brightness Reattack

- Trigger nur wenn lokaler RMS- oder Flux-Anstieg vorliegt und gleichzeitig
  `centroidDelta` oder `hfcDelta` stark ansteigt.
- Ziel: Reattacks unter Sustain besser erkennen, ohne Resonanz-FPs massiv zu
  erhoehen.

### S2: Multiband Attack Consensus

- Drei bis vier Subband-Detektoren berechnen und ein Event nur feuern, wenn
  mindestens zwei relevante Baender Attack-Neuheit zeigen.
- Ziel: robuster gegen einzelne schmale Stoerbaender und tieffrequentes Rumpeln.

### S3: Transient-vs-Sustain Gate

- Event nur wenn ein Transientenindikator steigt und gleichzeitig
  `flatnessDelta`, `crestFactor` oder `envelopeSlope` eher "attack-artig" sind.
- Ziel: `legacy-bandpass`-Staerke in Problemfaellen mit weniger Overcounts
  auf Sheet-Music-Fixtures kombinieren.

### S4: Phase-Assisted Reattack

- Bestehende Standardstrategie um ein optionales Phase-/Complex-Domain-Kriterium
  erweitern.
- Nur einsetzen, wenn RMS/Flux uneindeutig sind, aber das Phasenmass eine
  frische Transiente signalisiert.
- Ziel: heuristischer Endpunkt vor ML.

## Technisches Vorgehen

### Phase 1: Diagnose ausbauen

- Betroffene Module:
  - `tests/helpers/sheetMusicSequenceFingerprint.js`
  - `scripts/sheetOnsetSweepCore.mjs`
  - optional neues Skript unter `scripts/`
  - optional `js/tools/audioAnalyse/audioAnalyseEngine.js`
  - optional `js/tools/audioAnalyse/audioAnalyseSVG.js`
- Ausgabe erweitern um Feature-Traces, Timing-Fehler, Fehlerklassen,
  strategieuebergreifende Vergleichstabellen und explizite Hit/Miss-Metriken
  fuer getaggte Fixtures.
- Dabei keine zweite Fingerprint-spezifische Timing-Logik neu erfinden,
  sondern dieselbe Tagged-Onset-Bewertung wie im Sweep wiederverwenden.
- Validierung:
  - pro Problemfixture nachvollziehbar, warum ein Onset verpasst oder doppelt
    ausgeloest wurde
- Stand:
  - erledigt: gemeinsamer Tagged-Onset-Scorer fuer Sweep und SFP
  - erledigt: Fingerprint-Metriken fuer `good hit`, `acceptable hit`,
    `miss`, `duplicate`, `false positive`, Bias und p95
  - offen: feinere Fehler-Taxonomie und optionale Feature-/Trace-Ausgaben

### Phase 2: Feature-Layer erweitern

- In `js/shared/audio/guitarOnsetDetector.js` reine Hilfsfunktionen fuer neue
  Features einfuehren, z. B.:
  - HFC
  - centroid/rolloff delta
  - flatness
  - crest factor
  - subband flux
  - optional phase deviation
- Noch keine harte Produktentscheidung aendern.
- Validierung:
  - Unit-Tests fuer jedes Feature
  - Fingerprint-Reports enthalten die neuen Werte
  - Sweep und Fingerprint zeigen fuer getaggte Fixtures dieselben Match-Zahlen
    (`good hits`, `hits`, `misses`, `duplicates`, `false positives`)
- Stand:
  - erledigt: neue Diagnose-Features im Detector als reine Hilfs-/Messwerte
    (`HFC`, `centroid`, `rolloff`, `flatness`, `crest factor`, `subband flux`)
  - erledigt: Fingerprint-Report zeigt die neuen Feature-Werte pro Fixture
  - erledigt: Feature-Helper durch Unit-Tests abgesichert
  - erledigt: optionale Visualisierung im Audio-Analyse-Tool mit
    HFC/HFC-Delta, Centroid-/Rolloff-Delta, Flatness, Crest Factor und
    Subband-Flux-Kurven
  - erledigt: Audio-Analyse-Zoom per Start-/Ende-Slider, optionale vertikale
    Normalisierung sowie getrennt schaltbare erkannte/getaggte Onset-Marker
  - offen: optionale Datei-/CLI-Trace-Ausgabe ausserhalb des Audio-Analyse-Tools
  - naechster Schritt: Phase 3 mit `Brightness Reattack` und
    `Multiband Attack Consensus`

### Phase 3: Zwei risikoarme Strategien bauen

- Zuerst `Brightness Reattack` und `Multiband Attack Consensus`.
- Beide als neue Registry-Eintraege in
  `js/shared/audio/guitarOnsetStrategies.js`.
- Validierung:
  - keine schlechtere Performance auf Guardrails
  - messbarer Gewinn bei `fast.wav` und `aeaedgdgbebeabab*.wav`

### Phase 4: Falsche Positive gezielt abfangen

- `Transient-vs-Sustain Gate` als Gegengewicht zu aggressiveren Strategien
  implementieren.
- Validierung:
  - insbesondere `sheet-music-reading/*` und offene Saiten mit viel Sustain
    beobachten

### Phase 5: Letzte heuristische Ausbaustufe

- Falls Phase 3 und 4 nicht reichen: `Phase-Assisted Reattack`.
- Nur starten, wenn Diagnose zeigt, dass Magnituden-Features systematisch an
  Grenzen stossen.

### Phase 6: Entscheidungsgrundlage fuer ML vorbereiten

- Wenn danach weiterhin klare Fehlklassen bleiben:
  - Feature-Vektor und Label-Pipeline stabilisieren
  - dieselben Features spaeter fuer XGBoost oder kleines NN wiederverwenden
- Dadurch ist der Heuristik-Teil kein Wegwerfaufwand.

## Fachliche Testfaelle

- Schnelle Reattacks in `fast.wav` werden besser erkannt.
- Legato-Wechsel in `aeaedgdgbebeabab.wav` und `_slow.wav` steigen deutlich.
- Wiederholte offene Saiten wie `eeeeaaaaddddgggg.wav` bleiben ohne starken
  Doppeltrigger.
- `sheet-music-reading`-Fixtures verbessern Count und Timing, nicht nur Count.
- Getaggte Fixtures verbessern nicht nur Count, sondern auch `hit rate`,
  `precision/recall/f1` auf Basis der Tag-Matches sowie `p95` und
  `max abs error`.
- Aggressivere Strategien duerfen separat existieren, muessen aber im Report
  klar als szenariostark und nicht als universell markiert werden.

## Risiken und offene Fragen

- Mehr Features bedeuten mehr Korrelation und mehr Tuning-Aufwand; ohne gute
  Diagnostik wird der Detector schnell unlesbar.
- Complex-/Phase-Domain-Features koennen fuer Vanilla-JS teuer sein; zuerst
  Nutzen im Fingerprint beweisen.
- Zu viele Strategien ohne saubere Szenario-Definition erzeugen nur mehr
  Auswahl, aber keinen besseren Default.
- `analyzeIntervalMs` und `onsetFrameSize` sind selbst starke Stellhebel; neue
  Strategien sollten nicht auf einer zufaellig "guten" Zeitauflosung beruhen.

## Rueckfragen zur Implementierung

- `Wichtig`: Soll der naechste Schritt zuerst auf einen besseren universellen
  Default zielen oder bewusst auf mehrere spezialisierte Strategien fuer
  unterschiedliche Fixture-Klassen?
  Default-Vorschlag: erst 2 bis 3 spezialisierte Strategien sauber benchmarken,
  dann entscheiden, ob eine davon universell genug ist.

- `Wichtig`: Sollen neue Features direkt im Audio-Analyse-Tool visualisiert
  werden?
  Default-Vorschlag: ja, mindestens fuer HFC, Centroid-Delta, Subband-Flux und
  Crest-Factor, weil das Debugging sonst zu blind bleibt.

- `Optional`: Soll `legacy-bandpass` als Referenz bestehen bleiben, auch wenn er
  nicht Default wird?
  Default-Vorschlag: ja, als aggressive Vergleichsbasis und fuer spaetere
  Feature-Ablationen.

## Empfohlene Reihenfolge

1. Diagnose- und Trace-Ausbau.
2. HFC, Centroid-Delta, Flatness, Crest-Factor, Subband-Flux messen.
3. `Brightness Reattack` und `Multiband Attack Consensus` implementieren.
4. Sweep/Fingerprint je Strategie neu auswerten.
5. Nur bei Bedarf Complex-/Phase-Domain-Heuristik nachziehen.

Ich starte mit der Umsetzung erst, wenn du den Plan freigibst.
