# Chord Recognition Repair

Datum: 2026-04-23

Status: fachliche Restfälle offen, Root-/Dur-Moll-Basis verbessert

## Aktueller Stand

Die UI-/WASM-Stabilisierung und die initiale Frozen-HPCP-Testbasis sind erledigt und archiviert in:

- `plans/old/chord-recognition-repair-completed-2026-04-23.md`

Seitdem wurden zwei fachliche Leitplanken ergänzt:

- Bass-Erkennung als echtes End-Gate
- explizite Dur/Moll-Trennung für echte Triaden über die Terz-Evidenz

Der aktuelle Fingerprint auf den Frozen-HPCP-Fixtures ist:

- `TP=46`, `FP=129`, `FN=0`, `TN=2958`
- Sensitivität: `100.0%`
- Spezifität: `95.8%`
- Precision: `26.3%`
- Accuracy: `95.9%`
- F1: `41.6%`

Damit ist die Root-Stabilität aktuell deutlich besser als zuvor:

- keine False Negatives mehr auf den positiven Frozen-Fixtures
- `A-Moll` vs. `E-Moll`, `A-Moll (2-Finger)` vs. `E-Moll` und `E7` vs. `H7` sind gezielt abgesichert
- `G-Moll` kippt nicht mehr als `G-Dur` durch

## Was noch offen ist

Das Hauptproblem ist aktuell nicht mehr die Grundnote, sondern die Über-Akzeptanz nah verwandter Akkorde derselben Familie.

Die verbleibenden False Positives sind überwiegend:

- Varianten mit gleicher Root und zusätzlicher Farbe (`7`, `maj7`, `m7`, `add9`)
- sus-Varianten
- vereinfachte Voicing-Varianten (`(1-Finger)`, `(2-Finger)`)

Das ist kein Browser-/UI-Defekt mehr, sondern ein inhaltliches Matching-/Akzeptanzproblem im aktuellen HPCP-Pfad.

## Überblick False Positives

Verteilung der aktuellen `129` False Positives nach Muster:

- `41` 7th-Varianten
- `37` sus-Varianten
- `18` vereinfachte Varianten
- `7` add9-Varianten
- `5` explizite same-root-Varianten
- `21` sonstige Restfälle

Häufigste konkrete Fehlmuster:

- `5` mal `G7 -> G-Dur (1-Finger)`
- `5` mal `G7 -> G-Dur`
- `5` mal `G7 -> G-Dur (Rock)`
- `4` mal `G7 -> Gmaj7`
- `3` mal `C-Dur -> C-Dur (1-Finger)`
- `3` mal `C-Dur -> Cmaj7`
- `3` mal `C-Dur -> Csus2`
- `3` mal `C-Dur -> Csus4`
- `3` mal `E-Dur -> E7`
- `3` mal `E-Dur -> Esus2`
- `3` mal `E-Moll -> E-Moll (2-Finger)`

Interpretation:

- der Matcher akzeptiert den Zielakkord inzwischen robust
- die Akzeptanzregeln lassen aber zu viele harmonisch nahe Nachbarn zusätzlich als korrekt durch
- der größte Hebel liegt deshalb nicht mehr in der Root-Bestimmung, sondern im Einschränken des Kandidatenraums und in strengeren Regeln für Varianten derselben Root-Familie

## Was man jetzt als Nächstes verbessern kann

### 1. Kandidatenraum auf die aktive Übung begrenzen

Derzeit wird weiterhin gegen alle Templates aus `akkordData.js` gematcht.

Verbesserung:

- Matching nur gegen die Akkorde des aktiven Übungssets oder der aktiven Kategorie
- z. B. `standard`, `simplified`, `extended`

Nutzen:

- weniger fachfremde Varianten im Wettbewerb
- direkte Reduktion bei `7`, `sus`, `add9` und vereinfachten Aliasen

Priorität: **hoch**

### 2. Varianten derselben Root restriktiver akzeptieren

Aktuell werden near-miss-Kandidaten mit gleicher Root oft noch mit akzeptiert.

Verbesserung:

- Toleranzregeln für same-root-Kandidaten enger machen
- `sus`, `7`, `maj7`, `m7`, `add9` nicht automatisch als gleichwertig behandeln
- einfache Triaden nur dann gegen Varianten akzeptieren, wenn die Zusatzintervalle wirklich nachweisbar sind

Nutzen:

- direkt gegen den größten aktuellen FP-Block

Priorität: **hoch**

### 3. Matching-Logik mit stärkerer negativer Evidenz

Aktuell ist weiterhin viel Positiv-Evidenz im Score, aber Zusatzintervalle werden nicht hart genug bestraft.

Verbesserung:

- Nicht-Akkord-Bins aktiver bestrafen
- Zusatzintervalle wie kleine Septime, große Septime oder sus-Second gezielter gegen den Zieltyp auswerten
- Score nicht nur über Support, sondern stärker über Ausschlusskriterien führen

Nutzen:

- reduziert False Positives innerhalb derselben Root-Familie

Priorität: **hoch**

### 4. Robustere Frame-Aggregation

Aktuell werden nach festem `ATTACK_SETTLE_MS` sechs Frames gleich gewichtet gemittelt.

Verbesserung:

- onset-nahe Frames selektiver gewichten
- Median oder getrimmtes Mittel testen
- Frames mit instabiler Chroma verwerfen

Nutzen:

- weniger Obertöne und sus-artige Verfärbungen im Mittelwert

Priorität: **mittel**

### 5. Peak-Erkennung vor der HPCP verbessern

`detectEssentiaPeaks()` arbeitet mit lokalen Maxima und festem Noise-Floor.

Verbesserung:

- Peak-Interpolation
- relativer Schwellwert
- harmonische Gewichtung oder Whitening

Nutzen:

- sauberere Eingangsdaten für die Terz-/Septim-Entscheidung

Priorität: **mittel**

### 6. Bass-/Root-Kanal weiter ausbauen

Der Bass ist bereits als End-Gate eingebaut, aber noch nicht feiner nach Root-Familien und Voicings ausgewertet.

Verbesserung:

- Root-Kanal separat reporten
- same-root vs. cross-root Metriken explizit ausgeben
- Bass und Chroma-Auswertung im Fingerprint getrennt sichtbar machen

Nutzen:

- bessere Diagnostik
- klare Trennung zwischen Root- und Qualitätsfehlern

Priorität: **mittel**

## Empfohlene Umsetzungsreihenfolge

1. Fingerprint um `same-root` vs. `cross-root`-Fehler erweitern.
2. Kandidatenraum auf das aktive Übungsset begrenzen.
3. Same-root-Akzeptanzregeln für `sus`, `7`, `maj7`, `m7`, `add9` verschärfen.
4. Danach Frame-Aggregation und Peak-Erkennung getrennt evaluieren.

## Konkretes Akzeptanzkriterium für die nächste Iteration

Die nächste fachliche Reparaturrunde ist erfolgreich, wenn mindestens diese Punkte erreicht sind:

- `node scripts/chord-recognition-fingerprint.mjs` zeigt weniger False Positives bei gleicher Root
- `G7 -> G-Dur*` ist nicht mehr einer der größten FP-Blöcke
- `C-Dur -> Cmaj7/Csus2/Csus4` wird weiter reduziert
- bestehende Browser-E2E-Fälle für `C-Dur` und `E-Moll (2-Finger)` bleiben grün

## Noch offener Grenzfall

- der Browser-/Live-Fall für `C-Dur` ist weiterhin nicht durch die Frozen-HPCP-Tests vollständig abgedeckt
