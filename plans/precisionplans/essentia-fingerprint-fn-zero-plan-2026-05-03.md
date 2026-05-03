# Essentia Fingerprint FN-Zero Plan

Stand: 2026-05-03

## Ziel

Der neue `fingerprint` fuer den Essentia-/WASM-Pfad soll auf `FN = 0` gebracht werden.

Dabei gelten diese Leitplanken:

- `jsfingerprint` bleibt als bestehender JS-/HPCP-Vergleichspfad erhalten.
- Ground Truth wird nicht erneut verbogen.
- Bestehende rote Tests bleiben rot und werden nicht markiert, verschoben oder weichgespuelt.
- Eine voruebergehende Verschlechterung der `FP` im Essentia-`fingerprint` ist akzeptabel.
- `FN = 0` im Essentia-`fingerprint` hat Prioritaet vor kurzfristiger FP-Optimierung.

## Aktueller fachlicher Stand

### JS-Pfad

- `jsfingerprint` misst die bestehende JS-/HPCP-Datenbasis.
- Aktueller Stand:
  - `TP=60`
  - `FP=17`
  - `FN=19`
  - `TN=6572`
  - `Sensitivity 75.9%`
  - `F1 76.9%`

### Essentia-Pfad

- `fingerprint` misst den vorbereiteten Essentia-/WASM-Pfad.
- Aktueller Stand:
  - `TP=33`
  - `FP=51`
  - `FN=46`
  - `TN=6538`
  - `Sensitivity 41.8%`
  - `F1 40.5%`

### Konsequenz

Der Essentia-Pfad ist derzeit deutlich schwaecher als der JS-Pfad. Das primaere Reparaturziel ist deshalb:

1. `FN = 0` fuer den Essentia-`fingerprint`
2. danach Reduktion der `FP`

## Architekturentscheidung

### Strategy Pattern

`jsfingerprint` und `fingerprint` sollen nicht mehr zwangsweise dieselbe Entscheidungsstrategie teilen.

Stattdessen wird ein Strategy Pattern eingefuehrt, damit dieselbe Grundlogik unterschiedliche Bewertungsstrategien verwenden kann.

Zielbild:

- `jsFingerprintStrategy`
  - bildet den bisherigen JS-/HPCP-Pfad ab
  - bleibt als Vergleichs- und Kontrollpfad stabil

- `essentiaFingerprintStrategy`
  - bildet den Essentia-/WASM-Pfad ab
  - darf aggressiver auf FN-Reduktion optimiert werden

Optional spaeter:

- `essentiaUiStrategy`
  - fuer den echten Produktivpfad in `Akkord spielen`

### Warum Strategy Pattern?

Ohne Strategy Pattern wuerden globale Aenderungen an `matchHpcpToChord(...)` beide Fingerprints gleichermassen verschieben.

Mit Strategy Pattern kann:

- der Essentia-Pfad separat auf `FN = 0` optimiert werden
- der JS-Pfad als Referenz erhalten bleiben
- Ueberfitting auf nur eine Datenbasis sichtbarer bleiben

## Fachliche Anforderungen

- Jeder positive Akkord aus dem Katalog muss im Essentia-`fingerprint` fuer seinen Zielakkord als positiv erkannt werden.
- Kein positiver Ordner-Fall darf durch den aktuellen Matcher erneut als Negativfall katalogisiert werden.
- Der neue `fingerprint` muss weiterhin die vollstaendige Matrix auswerten:
  - TP
  - FP
  - FN
  - TN
  - Sensitivitaet
  - Spezifitaet
  - Precision
  - Negative Predictive Value
  - Accuracy
  - False Positive Rate
  - False Negative Rate
  - F1
- `jsfingerprint` bleibt parallel und unveraendert ausfuehrbar.
- Bestehende Tests werden nicht geloescht.
- Bestehende rote Tests werden nicht speziell markiert.

## Technische Ausgangspunkte

### Bereits vorhanden

- `npm run jsfingerprint`
- `npm run fingerprint`
- `npm run fingerprint:fixtures`
- vorbereitete Essentia-Fixtures:
  - `tests/fixtures/chord-hpcp/frozen-essentia-fingerprint-fixtures.json`
- schneller Essentia-Metrikpfad:
  - `tests/helpers/essentiaFingerprintMetrics.js`
- schnelle Essentia-Regressionen:
  - `tests/unit/essentiaChordFingerprintMetrics.test.js`
  - `tests/unit/essentiaChordFingerprintRegression.test.js`

### Bereits korrigiert

- positive Folder-Fixtures werden wieder als positive Ground Truth katalogisiert
- der alte geschonte Sensitivity-Effekt ist beseitigt

## Fachliche Testfaelle

### Muss-Faelle

- Jeder positive Akkord im Katalog wird im Essentia-`fingerprint` fuer seinen Zielakkord als `true` erkannt.
- `fingerprint` zeigt `FN = 0`.
- `jsfingerprint` bleibt separat lauffaehig.
- Problemfaelle bleiben als Regressionen sichtbar und verschwinden nicht still.

### Priorisierte Problemfaelle

Diese Gruppen muessen im Essentia-Pfad sicher auf TP kippen:

- `add9`
  - z. B. `Aadd9/aadd9.wav`
  - `Eadd9/eadd9.wav`

- `dim`
  - `Adim/adim.wav`
  - `Adim/adim_2.wav`
  - `Cdim/cdim.wav`
  - `Edim/edim.wav`
  - `Gdim/gdim.wav`
  - `Gdim/gdim_2.wav`
  - `Hdim/hdim.wav`

- `m7`
  - `Am7/am7.wav`
  - `Cm7/cm7.wav`
  - `Fm7/fm7.wav`
  - `Gm7/gm7.wav`

- `maj7`
  - `Amaj7/amaj7.wav`
  - `Cmaj7/cmaj7.wav`
  - `Dmaj7/dmaj7.wav`
  - `Emaj7/emaj7.wav`

- `sus`
  - `Asus2/asus2.wav`
  - `Asus4/asus4.wav`
  - `Csus4/csus4.wav`
  - `Csus4/csus4_alt.wav`
  - `Esus2/esus2.wav`
  - `Esus2/esus2_alt.wav`
  - `Esus2/esus2_alt2.wav`

### Negativfaelle

- explizite Negativfixtures muessen negativ bleiben
- open-strums duerfen nicht positiv kippen
- `d_chord_wrong.wav` und die bewussten Gegenbeweise muessen erhalten bleiben

## Umsetzungsphasen

### Phase 1: Strategy Pattern einziehen

Ziel:

- Entscheidungslogik so strukturieren, dass unterschiedliche Strategien injizierbar sind.

Arbeit:

- Strategie-Schnittstelle fuer Chord-Matching definieren
- aktuellen Standardpfad in eine JS-Strategie ueberfuehren
- Essentia-Strategie als separate Strategie aufsetzen

Validierung:

- `jsfingerprint` laeuft ueber JS-Strategie
- `fingerprint` laeuft ueber Essentia-Strategie

### Phase 2: False-Negative-Bestand clustern

Ziel:

- die 46 FNs nicht einzeln, sondern in Familien bearbeiten

Arbeit:

- FNs nach Akkordtyp gruppieren:
  - Dur
  - Moll
  - `7`
  - `maj7`
  - `m7`
  - `dim`
  - `sus2/sus4`
  - `add9`
- fuer jede Gruppe dokumentieren:
  - `bestMatch`
  - `confidence`
  - ob `bestMatch === target`
  - ob Bass-Support den Zielakkord drueckt

Validierung:

- jede FN-Gruppe ist mindestens einer Ursache zugeordnet

### Phase 3: Einfache FN-Gewinne zuerst

Ziel:

- Faelle reparieren, bei denen der Zielakkord schon fast trifft

Arbeit:

- zuerst Faelle behandeln mit:
  - `bestMatch === target`
  - aber `isCorrect === false`
- diese sind meist:
  - Threshold-Probleme
  - Profil-Schwellen-Probleme
  - zu hartes Bass-Gating

Validierung:

- sichtbarer Rueckgang der FN ohne strukturelle Umbauten

### Phase 4: Essentia-Strategie auf FN-Minimierung trimmen

Ziel:

- Essentia-Strategie gezielt lockern, ohne den JS-Pfad mitzureissen

Moegliche Hebel:

- family-spezifische Thresholds absenken
- `maj7`-/`m7`-/`dim`-Profile neu gewichten
- `sus`- und `add9`-Abgrenzungen lockern
- Bass-Support weniger strafend machen
- Konkurrenzregeln fuer gleichartige Familien justieren

Validierung:

- `fingerprint`-FN sinkt nach jeder Aenderung

### Phase 5: Problemfaelle mit hohem Hebel priorisieren

Prioritaet:

1. `maj7`, `m7`, `dim`
2. `sus`, `add9`
3. Randfaelle bei Dur/Moll
4. Spezialfaelle wie `open-strum`-Verwechslungen

Begruendung:

- diese Familien machen einen grossen Teil der Essentia-FNs aus

Validierung:

- FN-Zahl sinkt blockweise

### Phase 6: Zielzustand `FN = 0`

Ziel:

- alle positiven Katalogfaelle im Essentia-Pfad werden erkannt

Arbeit:

- letzte Ausreisser gezielt nachziehen
- Regressionen fuer reparierte Familien erweitern

Validierung:

- `fingerprint` meldet `FN = 0`

### Phase 7: FP-Aufraeumrunde

Ziel:

- nach Erreichen von `FN = 0` die zulaessig angestiegenen FP systematisch reduzieren

Arbeit:

- FP nach Familien gruppieren
- nur Essentia-Strategie weiter schaerfen
- keine Rueckkehr zu geschonter Ground Truth

Validierung:

- FP sinkt, waehrend `FN = 0` erhalten bleibt

## Mess- und Validierungsregeln

Nach jeder relevanten Aenderung pruefen:

- `npm run fingerprint`
- `npm run jsfingerprint`
- `npx vitest run tests/unit/essentiaChordFingerprintMetrics.test.js tests/unit/essentiaChordFingerprintRegression.test.js`

Zusaetzlich bei Eingriffen in gemeinsame Logik:

- bestehende rote Tests nicht entfernen
- rote Tests weiter ehrlich sichtbar lassen

## Akzeptierte Trade-offs

- Ein temporaerer Anstieg der `FP` im Essentia-`fingerprint` ist akzeptiert.
- Eine kurzzeitige Verschlechterung der Precision ist akzeptiert.
- Nicht akzeptiert:
  - erneutes Ground-Truth-Umlabeling
  - versteckte Testabschaltungen
  - Verschieben oder Markieren der roten Tests, nur um den Status schoener wirken zu lassen

## Offene technische Fragen

Der Nutzer hat fuer die Umsetzung Defaults freigegeben:

- `fingerprint` liest vorbereitete Essentia-/WASM-Fixtures
- Fixture-Inhalt:
  - `wasmHpcpFrames`
  - `wasmAverageHpcp`
  - `bassSupportByChord`
- bestehender `scripts/chord-recognition-fingerprint.mjs` ist jetzt der neue Essentia-`fingerprint`
- der alte Lauf bleibt separat als `jsfingerprint`

Damit gibt es aktuell keine blockierende Produktentscheidung mehr fuer den Start der Umsetzung.

## Erste konkrete Arbeitsliste

1. Strategy Pattern fuer Match-Entscheidung einfuehren
2. `jsFingerprintStrategy` aus dem heutigen Verhalten extrahieren
3. `essentiaFingerprintStrategy` einfuehren
4. 46 Essentia-FNs nach Familien auswerten
5. zuerst `bestMatch === target`, aber `isCorrect === false` reparieren
6. dann `maj7`, `m7`, `dim`, `sus`, `add9` gruppenweise bearbeiten
7. `FN = 0` herstellen
8. danach FP senken
