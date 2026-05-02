# Plan: Open-Strum-Reject im Chord-Matcher

**Stand:** 2026-05-02  
**Status:** geplant

---

## Ziel

Open-Strums sollen nicht mehr nur als explizite Negativfixtures im Fingerprint auftauchen, sondern als eigene fachliche Reject-Klasse im Matcher erkennbar werden.

Nach Abschluss soll gelten:

- Ein Open-Strum kann als eigener Kandidat im Scoring berücksichtigt werden.
- Wenn das Eingangssignal fachlich eher ein Open-Strum als ein konkreter Akkord ist, wird der Akkord-Claim verworfen.
- Die bestehende Trefferquote auf echten Akkord-Fixtures darf nicht unkontrolliert einbrechen.
- Alle Änderungen bleiben über Fingerprint und Fixture-Tests reproduzierbar messbar.

---

## Fachliche Anforderungen

- Open-Strums bleiben Negativfälle und dürfen nicht als korrekte Akkorderkennung akzeptiert werden.
- Der Matcher soll Open-Strums nicht mehr indirekt als irgendeinen Akkord erklären müssen, sondern eine explizite Reject-Alternative kennen.
- Die neue Reject-Logik soll vor allem die aktuellen FP-Cluster auf `open-strums/*` reduzieren.
- Die bestehende Semantik von `bestMatch` soll erklärbarer werden:
  bei Open-Strum-nahen Signalen soll nicht nur ein zufälliger Akkord als bester Kandidat erscheinen.
- Die Lösung soll mit dem bestehenden Scoring-Ansatz kompatibel bleiben und keine zweite, komplett separate Erkennungslogik neben dem Matcher etablieren.

**Nicht-Ziel im ersten Schritt**

- Sofortige perfekte Trennung zwischen `0-open`, `1-open`, `2-open`, `3-open`, `4-open`, `5-open` als sechs vollwertige Zielklassen.
- Vollständige Neuarchitektur der Akkorderkennung.
- Optimierung aller übrigen FP-Cluster außerhalb der Open-Strums.

---

## Annahmen

- `0-open` bis `5-open` sind fachlich Negativmuster und keine regulären Akkorde aus `CHORDS`.
- Für die erste Ausbaustufe reicht vermutlich ein generischer Matcher-Kandidat `open-strum`; die Untertypen `0-open` bis `5-open` bleiben zunächst Fingerprint-Labels.
- Ein reiner Check `bestMatch === open-strum` wird wahrscheinlich nicht ausreichen; zusätzlich wird eine Mindestmarge oder ein Dominanzkriterium gegenüber dem besten Akkordkandidaten nötig sein.
- Die bestehende Bass- und HPCP-Logik ist eine sinnvolle Basis; Open-Strum-Erkennung soll diese eher ergänzen als ersetzen.

---

## Fachliche Testfälle

- Ein typischer echter Akkord wie `E-Moll/emin.wav` bleibt als `E-Moll` akzeptiert und wird nicht fälschlich als Open-Strum verworfen.
- Ein Open-Strum wie `open-strums/0_strum.wav` wird bei Prüfungen gegen alle Akkordnamen weiterhin verworfen.
- Wenn ein Open-Strum im Kandidatenvergleich näher an `open-strum` als an einem echten Akkord liegt, wird der Akkord-Claim abgelehnt.
- Problematische aktuelle Fälle wie `open-strums/2_strum_alt2 -> Esus2` oder `open-strums/5_strum_alt.wav -> C-Dur (1-Finger)` sollen nach der Änderung nicht mehr akzeptiert werden.
- Ein echter, spektral einfacher Akkord mit wenigen Tönen darf nicht allein deshalb verworfen werden, weil er „offen“ klingt.
- Die globale Metrik muss zeigen, dass Open-Strum-FPs sinken, ohne neue oder viele zusätzliche FNs auf positiven Fixtures zu erzeugen.

---

## Technisches Vorgehen

- In `essentiaChordLogic.js` einen zusätzlichen Kandidatenpfad für `open-strum` definieren, der im selben Candidate-Scoring-Kontext auswertbar ist wie normale Akkorde.
- Dafür keinen Eintrag in `CHORDS` erzwingen, wenn das Modell fachlich kein Akkord ist; stattdessen einen expliziten Sonderkandidaten im Matcher vorsehen.
- Bewertungsbasis voraussichtlich aus bestehenden Signalen ableiten:
  `supportMean`, `leakageMean`, Root/Fifth-Stabilität, Best-Score-Marge, ggf. Breite oder Diffusität der HPCP-Verteilung.
- Acceptance-Regel ergänzen:
  Wenn `open-strum` den stärksten oder einen fast gleich starken Kandidaten darstellt, soll ein Akkord-Claim rejected werden.
- Die Fingerprint- und Report-Logik so beibehalten, dass `0-open` bis `5-open` als Negativlabels sichtbar bleiben, auch wenn der generische Matcher-Kandidat zunächst nur `open-strum` heißt.

Voraussichtlich betroffene Dateien:

- `js/games/chordExerciseEssentia/essentiaChordLogic.js`
- `tests/helpers/chordRecognitionMetrics.js`
- `tests/unit/essentiaChordAudio.test.js`
- `tests/unit/essentiaChordTargetedRegression.test.js`
- optional zusätzliche gezielte Tests für `open-strum`-Dominanz

---

## Weitere Ideen und Varianten

Diese Ideen sind bewusst im Plan gesammelt, auch wenn sie nicht alle in Phase 1 umgesetzt werden sollen.

### 1. Generischer `open-strum`-Kandidat als erster Schritt

- Ein einziger Negativkandidat `open-strum` konkurriert mit den normalen Akkorden.
- Vorteil:
  schneller Einstieg, verständlicher Report, geringeres Implementierungsrisiko.
- Nachteil:
  mögliche Unterschiede zwischen `0-open` bis `5-open` werden zunächst absichtlich zusammengefasst.

### 2. Spätere Unterteilung in `0-open` bis `5-open` als echte Matcher-Kandidaten

- Nicht nur Fingerprint-Labels, sondern separate Negativmuster im Candidate-Scoring.
- Vorteil:
  potenziell feinere Trennung zwischen verschiedenen Open-Strum-Spektren.
- Nachteil:
  höherer Modellierungsaufwand und Risiko, dass Negativklassen unnötig überfitten.

### 3. Reject nicht nur über `bestMatch`, sondern auch über Score-Marge

- Nicht nur `bestMatch === open-strum`, sondern auch Reject, wenn der `open-strum`-Score sehr nah am besten Akkord-Score liegt.
- Vorteil:
  robuster gegen Fälle, in denen ein echter Akkordkandidat knapp gewinnt, das Signal aber fachlich zu diffus ist.
- Nachteil:
  zusätzliche Schwellenwerte mit FN-Risiko.

### 4. Diffusitäts-Gate für die HPCP-Verteilung

- Open-Strums scheinen oft kein klares Akkordprofil, sondern eine breite oder mehrdeutige Energieverteilung zu erzeugen.
- Mögliche Signale:
  geringe Differenz `supportMean - leakageMean`, schwache Top-Score-Marge, zu viele aktive Bins, hohe spektrale Breite oder hohe HPCP-Entropie.
- Vorteil:
  nutzt Eigenschaften, die eher auf „kein sauberer Zielakkord“ als auf einen bestimmten Ersatzakkord hinweisen.
- Nachteil:
  kann echte offene oder verrauschte Akkorde mit bestrafen.

### 5. Strengere Bass-Anforderungen für Open-Strum-nahe Fälle

- Die bestehende Bass-Evidenz kann als zusätzlicher Reject-Hebel genutzt werden.
- Mögliche Verschärfungen:
  höhere Mindestmarge für den erwarteten Bass, stärkeres Verhältnis Fundamental zu Nachbarn, strengere Priorität gegenüber Konkurrenz-Bassprofilen.
- Vorteil:
  passt gut zu bestehenden Gates in `evaluateRootAndBassEvidence(...)`.
- Nachteil:
  nicht jeder Open-Strum-FP ist primär ein Bassproblem.

### 6. Härtere Positiv-Evidenz für `sus2`, `sus4`, `add9` und ähnliche sparse Familien

- Viele Open-Strum-FPs landen bei `sus`-, `add9`- oder vereinfachten Akkordtypen.
- Mögliche Maßnahmen:
  höhere Mindestenergie für `expectedSecond` oder `expectedFourth`, stärkere Trennung gegen Third-Energie, strengere Mindestmarge für sparse Templates.
- Vorteil:
  direkt an den sichtbar problematischen FP-Familien ansetzbar.
- Nachteil:
  senkt eher einzelne Cluster als die generelle Open-Strum-Erklärbarkeit.

### 7. Open-Strum als harter Reject-Pfad statt als normaler Matcher-Kandidat

- Alternative zum Kandidatenmodell:
  ein vorgeschalteter Klassifikator entscheidet „zu offen / zu diffus“, und der normale Akkordmatcher wird danach gar nicht mehr akzeptiert.
- Vorteil:
  konzeptionell klarer Reject-Pfad.
- Nachteil:
  größere Entfernung von der bestehenden Matcher-Architektur; schlechtere Vergleichbarkeit mit `bestMatch`.

### 8. Hybridansatz

- `open-strum` als Kandidat einführen und zusätzlich ein leichtes Diffusitäts- oder Margen-Gate verwenden.
- Vorteil:
  verbindet bessere Report-Erklärbarkeit mit robusterer Ablehnung.
- Nachteil:
  mehr Stellschrauben gleichzeitig; schwieriger sauber zu kalibrieren.

**Empfohlener Default für die erste Umsetzung**

- Start mit Variante 1 plus Variante 3 in vorsichtiger Form.
- Danach messen, ob zusätzlich Variante 4 oder 5 nötig ist.
- Variante 2 erst dann angehen, wenn der generische `open-strum`-Pfad nachweisbar nicht ausreicht.

---

## Phasen

### Phase 1: Analyse- und Modellierungsphase

Ziel:
- Festlegen, wie `open-strum` fachlich in den Matcher integriert wird.

Arbeit:
- Vergleich der bestehenden Open-Strum-FPs nach Score-Mustern.
- Prüfen, ob ein generischer `open-strum`-Kandidat ausreicht oder ob mehrere Untertypen sofort nötig wären.
- Entscheidung, welche Signale die Reject-Entscheidung tragen sollen.

Validierung:
- Klare Definition, wann `open-strum` als dominanter Kandidat gilt.

### Phase 2: Matcher-Kandidat `open-strum`

Ziel:
- `open-strum` als expliziten Sonderkandidaten im Candidate-Scoring ergänzen.

Arbeit:
- Sonderkandidat in der Match-Logik aufnehmen.
- Score-Regel und Vergleich mit normalen Akkordkandidaten implementierbar vorbereiten.

Validierung:
- Unit-Tests zeigen, dass `bestMatch` in Open-Strum-Fällen auch `open-strum` werden kann.

### Phase 3: Reject-Gate integrieren

Ziel:
- Akkord-Claims blockieren, wenn `open-strum` dominant oder zu nah am besten Akkordkandidaten ist.

Arbeit:
- Reject-Regel in den Acceptance-Pfad einbauen.
- Sicherheitsmarge gegen False Negatives auf echten Akkorden definieren.

Validierung:
- Gezielte Regressionen auf heutige Open-Strum-FPs.

### Phase 4: Fingerprint-Messung und Nachschärfung

Ziel:
- Wirkung auf Precision und Recall reproduzierbar messen.

Arbeit:
- Fingerprint ausführen.
- FP-Rückgang bei Open-Strums gegen mögliche neue FNs abwägen.
- Falls nötig Schwellenwerte feinjustieren.

Validierung:
- Fingerprint-Vergleich vor/nachher.
- Relevante Fixture-Tests grün.

---

## Risiken / Offene Fragen

- Ein zu aggressiver `open-strum`-Reject kann echte offene Akkorde mit sparsamer Energieverteilung wegfiltern.
- Ein zu schwacher `open-strum`-Kandidat bringt zwar bessere Erklärbarkeit im Report, reduziert aber die FP-Zahl kaum.
- Wenn `open-strum` nur als ein einziger generischer Kandidat modelliert wird, kann das für einige Untertypen zu grob sein.
- Wenn `open-strum` als vollwertiger Template-Kandidat gebaut wird, muss klar sein, worauf dieses Template fachlich basiert.
- Die größte Produktentscheidung ist, ob `bestMatch=open-strum` rein diagnostisch sein soll oder direkt harte Ablehnungswirkung bekommt.

---

## Rückfragen zur Implementierung

- `Wichtig`: Soll die erste Version mit einem generischen Kandidaten `open-strum` starten?
  Default: Ja, damit der Reject-Pfad zuerst fachlich validiert werden kann, bevor `0-open` bis `5-open` als Unterklassen in die Matcher-Logik kommen.

- `Wichtig`: Soll `bestMatch=open-strum` allein schon für Reject reichen?
  Default: Nein. Besser ist ein Dominanz- oder Margenkriterium gegenüber dem besten echten Akkordkandidaten, um neue FNs zu begrenzen.

- `Optional`: Sollen `0-open` bis `5-open` später nur für Reporting/Fingerprint bestehen bleiben oder auch als separate Matcher-Kandidaten ausgebaut werden?
  Default: Zunächst nur Reporting/Fingerprint; Ausbau erst nach Messung des generischen Reject-Pfads.

---

## Erfolgskriterium

Die Änderung ist erfolgreich, wenn der Fingerprint weniger Open-Strum-False-Positives zeigt, `FN=0` möglichst erhalten bleibt und der Matcher in problematischen Fällen nachvollziehbar `open-strum` statt eines zufälligen Akkordlabels als dominanten Negativkandidaten erkennt.
