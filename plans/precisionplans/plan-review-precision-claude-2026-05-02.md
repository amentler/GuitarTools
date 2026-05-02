# Plan-Review: Bewertung des Claude-Precision-Plans

**Stand:** 2026-05-02  
**Status:** Review / Entscheidungsgrundlage

---

## Bezug

Diese Bewertung bezieht sich ausdrücklich auf:

- `plans/precisionplans/chord-precision-tdd-2026-05-02.md`
  Claude-Plan mit konkreter TDD-Implementierungsstrategie
- `plans/precisionplans/chord-recognition-precision-plan-2026-05-02.md`
  strategischer Überblicksplan
- `plans/precisionplans/old/chord-recognition-repair.md`
  älterer Reparatur- und Analyseplan als historischer Kontext

Die Bewertung wurde gegen den aktuellen Repo-Stand und den aktuelleren
Fingerprint abgeglichen.

---

## Ausgangslage

Der Claude-TDD-Plan arbeitet noch mit diesem Stand:

- `TP=57`
- `FP=45`
- `FN=0`
- `Precision=55.9%`

Der aktuelle Repo-Stand liegt bereits bei:

- `TP=57`
- `FP=39`
- `FN=0`
- `Precision=59.4%`
- `F1=74.5%`

Damit ist der Claude-Plan in seiner Priorisierung und Zielsetzung teilweise
veraltet und muss vor einer Umsetzung aktualisiert werden.

---

## Positiv am Claude-Plan

- Er fokussiert auf zwei konkrete Logikpfade statt auf unspezifisches
  Threshold-Tuning:
  - `passesBestMatchTolerance`
  - `passesDominantSeventhVariantAcceptance`
- Er behandelt `FN=0` korrekt als harte Leitplanke.
- Er verbindet Logikänderungen mit gezielten Regressionstests.
- Er versucht, die Umsetzung klein und messbar zu halten, statt mehrere
  Akkordfamilien gleichzeitig umzubauen.

Diese Punkte machen den Plan als technische Hypothese brauchbar.

---

## Kritische Punkte

### 1. Veraltete Metrikbasis

Der Plan baut auf einem älteren Fingerprint auf. Da sich die Kennzahlen bereits
verbessert haben, sind:

- die FP-Ausgangslage anders
- die Zielschwellen neu zu bewerten
- die Prioritäten zwischen Variantenproblem und Logikproblem verschoben

Folge:
Vor einer Umsetzung muss der Plan auf den aktuellen Fingerprint-Stand angepasst
werden.

### 2. Zu starke Fixierung auf synthetische HPCP-Unit-Tests

Der Plan schlägt mehrere Unit-Tests mit künstlich konstruierten `Float32Array`-
HPCPs vor, die auf einen bestimmten Gap-Bereich kalibriert werden sollen.

Problem:

- Diese Tests sichern leicht die aktuelle Score-Formel statt das gewünschte
  Verhalten ab.
- Sie sind anfällig für Overfitting.
- Kleine Änderungen an Gewichtung oder Normalisierung können sie brechen, ohne
  dass das reale Verhalten schlechter geworden ist.

Bewertung:
Solche Tests sind höchstens ergänzend sinnvoll. Die belastbarere Absicherung
sind echte Fixture-basierte Regressionen plus Fingerprint-Vergleich.

### 3. Cross-root-Testidee ist fachlich schwach

Der Claude-Plan enthält einen Testfall, in dem die Toleranz bei anderer Tonika
weiter gelten soll.

Problem:
Die aktuelle Logik akzeptiert Toleranz nicht allgemein für beliebige
Cross-root-Fälle. Der vorgeschlagene Test ist deshalb fachlich nicht sauber aus
dem bestehenden Verhalten abgeleitet und könnte ein falsches Sollbild festschreiben.

Bewertung:
Diesen Test würde ich nicht übernehmen.

### 4. Variantenproblem wird zu früh als „nicht fixierbar“ abgeräumt

Der Claude-Plan stuft Fälle wie `C-Dur` vs. `C-Dur (1-Finger)` als strukturell
nicht lösbar ein und will sie nur dokumentieren.

Problem:

- Für die reine Roh-Erkennung mag das schwierig sein.
- Für die Metrik und die fachliche Bewertung ist es sehr wohl adressierbar.
- Gerade dort wurde bereits Verbesserung erreicht, etwa durch das Entfernen von
  `E-Moll (2-Finger)` als künstlich separater Klasse.

Bewertung:
Die Aussage ist zu absolut. Das Varianten-/Äquivalenzthema sollte weiterhin
Teil der Präzisionsstrategie bleiben.

### 5. `version.txt`-Bump ist unnötig an die Aufgabe gekoppelt

Der Plan nennt einen Versions-Bump als festen Umsetzungsschritt.

Bewertung:
Das gehört nicht in die fachliche Präzisionsarbeit und sollte aus dem Plan
entfernt werden, solange kein separates Release-Ziel besteht.

---

## Einordnung des strategischen Plans

Der strategische Plan in
`plans/precisionplans/chord-recognition-precision-plan-2026-05-02.md`
ist aus meiner Sicht die bessere Leitlinie, weil er:

- Metrik- und Erkennungsproblem trennt
- Maßnahmen nach FN-Risiko staffelt
- Variantenbereinigung nicht ausklammert
- globale Thresholds bewusst ans Ende stellt

Der Claude-TDD-Plan ist dagegen eher als möglicher Teilplan für eine spätere
kleine Umsetzungsphase zu verstehen, nicht als alleinige Hauptstrategie.

---

## Empfehlung

Der Claude-Plan sollte nicht 1:1 umgesetzt werden.

Sinnvoll zu übernehmen:

- die technische Hypothese einer strengeren Same-root-Toleranz
- die technische Hypothese einer strengeren Dominant-7-Akzeptanz
- gezielte Fixture-Regressionen für `D-Moll -> Dm7` und `A-Moll -> A7`

Nicht oder nur abgeschwächt übernehmen:

- stark kalibrierte synthetische HPCP-Unit-Tests
- die absolute Aussage, Variantenfälle seien „nicht fixierbar“
- den Versions-Bump als Pflichtschritt

Empfohlene Reihenfolge:

1. Aktuellen Fingerprint als Ausgangsbasis festschreiben
2. Fixture-basierte Regressionen für die zwei Claude-Hypothesen ergänzen
3. Kleine Regeländerungen einzeln einführen und jedes Mal den Fingerprint
   messen
4. Varianten-/Äquivalenzthema weiterhin separat mitbehandeln

---

## Entscheidungsvorlage

Wenn dieser Plan als Grundlage für Umsetzung dient, sollte gelten:

- Der strategische Präzisionsplan bleibt der Hauptplan.
- Der Claude-TDD-Plan wird nur als eingeschränkter Technikbaustein verwendet.
- Vor Implementierung wird der Claude-Plan auf den aktuellen Fingerprint-Stand
  aktualisiert oder durch einen kleineren Maßnahmenplan ersetzt.
