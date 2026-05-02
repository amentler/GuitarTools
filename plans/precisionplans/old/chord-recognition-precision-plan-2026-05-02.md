# Plan: Chord-Recognition-Precision ohne neue False Negatives

**Stand:** 2026-05-02  
**Status:** Entwurf

---

## Ziel

Die Präzision der Chord-Erkennung soll verbessert werden, ohne die aktuelle
`FN=0`-Lage zu verschlechtern. Der Fokus liegt auf gezielter Reduktion von
False Positives bei nahen Akkordvarianten und gleichen Tonika-Familien, nicht
auf einer pauschalen Verschärfung aller Schwellen.

---

## Ausgangslage

Der Fingerprint zeigt aktuell:

- `TP=57`
- `FP=39`
- `FN=0`
- `TN=3697`
- `Precision=59.4%`
- `Sensitivity=100.0%`

Die verbleibenden False Positives entstehen überwiegend bei nahen Akkorden:

- gleiche oder fast gleiche Varianten wie `C-Dur` und `C-Dur (1-Finger)`
- Same-root-Verwechslungen wie `Dur <-> 7`
- Verwechslungen zwischen `sus2`, `sus4`, `add9`, `maj7`
- einzelne Familienkonflikte wie `Moll -> dim`

---

## Fachliche Anforderungen

- Akkorde, die heute korrekt erkannt werden, sollen weiterhin korrekt bleiben.
- Neue False Negatives sind zu vermeiden; `FN=0` ist eine harte Leitplanke.
- Identische oder fachlich gleichwertige Varianten sollen Precision nicht
  künstlich verschlechtern.
- Same-root-Verwechslungen sollen vor Cross-root-Verwechslungen priorisiert
  behandelt werden.
- Maßnahmen sollen mit dem bestehenden Fingerprint reproduzierbar messbar sein.
- Änderungen sollen sich an der bestehenden Logik in
  `essentiaChordLogic.js` und der vorhandenen Fingerprint-Auswertung
  orientieren, nicht an einer zweiten Auswertungslogik.

---

## Strategie

Die Verbesserung erfolgt in Stufen mit aufsteigendem Risiko:

1. Zuerst Varianten- und Metrikprobleme bereinigen, die keine echte
   Erkennungsverschärfung erfordern.
2. Danach gezielte Same-root-Disambiguierung für Akkordfamilien mit
   charakteristischen Erweiterungen.
3. Anschließend Toleranz- und Subset-Regeln einschränken, wenn sie
   systematisch Mitakzeptanz erzeugen.
4. Erst am Ende globale Thresholds prüfen, falls danach noch Bedarf besteht.

---

## Maßnahmen

### Phase 1: Variantenbereinigung und metrische Normalisierung

Ziel:
False Positives reduzieren, die nur aus Aliasen oder identischen
Pitch-Class-Varianten entstehen.

Maßnahmen:

- Identische Akkorde nicht mehr als getrennte fachliche Klassen behandeln.
- Vereinfachte Griffbild-Varianten nur dann getrennt bewerten, wenn sie
  musikalisch wirklich eine andere Pitch-Class-Struktur haben.
- Optional eine normalisierte Precision zusätzlich zur Roh-Precision
  ausweisen, um Katalogeffekte von echter Erkennungsqualität zu trennen.

Erwartete Wirkung:

- Sofortiger Rückgang künstlicher FP-Fälle.
- Kein FN-Risiko, wenn nur Metrik oder Äquivalenzgruppen angepasst werden.

Validierung:

- Fingerprint vor/nachher vergleichen.
- Prüfen, ob die Reduktion tatsächlich auf Variantenfälle entfällt.

### Phase 2: Same-root-Disambiguierung für Erweiterungsakkorde

Ziel:
Nahe Akkorde derselben Tonika strenger unterscheiden, ohne generische
Schwellen anzuheben.

Maßnahmen:

- `sus2`: Sekunde muss klar genug gegenüber Terz-Kandidaten sein.
- `sus4`: Quarte muss klar genug gegenüber Terz-Kandidaten sein.
- `add9`: Add9-Energie muss gegenüber reiner Triad-Deutung ausreichend sein.
- `maj7`: große Septime muss stark genug gegen einfache Dur-Deutung sprechen.
- `7`: kleine Septime muss stark genug gegen Dur- oder Maj7-Deutung sprechen.
- Relative Verhältnisse stärker berücksichtigen, nicht nur absolute
  Mindestwerte.

Erwartete Wirkung:

- Rückgang der False Positives in gleichen Tonika-Familien.
- Niedriges bis mittleres FN-Risiko, wenn nur die betroffenen Typen
  nachgeschärft werden.

Validierung:

- Targeted Regression Tests für `Dur <-> 7`, `Dur <-> sus`, `sus <-> add9`,
  `maj7 <-> Dur`.
- Fingerprint muss `FN=0` behalten.

### Phase 3: Best-Match-Tolerance und Subset-Acceptance einschränken

Ziel:
Mitakzeptanz durch zu großzügige Kompatibilitätsregeln verringern.

Maßnahmen:

- `bestMatchTolerance` chord-typ-spezifisch enger setzen, vor allem für
  `sus2`, `sus4`, `add9`, `maj7`.
- Subset-Acceptance nur noch für explizit erlaubte Variantengruppen oder
  definierte Sonderfälle zulassen.
- Margin gegen konkurrierende Kandidaten derselben Root prüfen, statt global
  gegen alle Akkorde zu vergleichen.

Erwartete Wirkung:

- Weniger „auch korrekt“-Entscheidungen bei nahen Akkordfamilien.
- Mittleres Risiko, weil diese Regeln aktuell auch echte Treffer absichern.

Validierung:

- Regressionstests für bekannte bisherige Sonderfälle müssen grün bleiben.
- Fingerprint muss zeigen, dass FPs sinken, ohne neue FNs zu erzeugen.

### Phase 4: Feintuning pro Akkordfamilie

Ziel:
Nur die Profile schärfen, die nach den ersten Phasen noch systematisch
auffällig sind.

Maßnahmen:

- Profile und Mindestenergien pro Akkordtyp gezielt anpassen.
- Falls sinnvoll, zusätzliche same-root-Margen zwischen erstem und zweitem
  Kandidaten derselben Tonika einführen.
- Bass-Support nur als zusätzlicher Disambiguator bei knappen Fällen nutzen,
  nicht als harte globale Bedingung.

Erwartete Wirkung:

- Gezielt bessere Precision in den Restclustern.
- Mittleres Risiko, weil Audio-Realitäten zwischen Fixtures schwanken können.

Validierung:

- Fingerprint plus gezielte Regressionen pro Akkordfamilie.
- Einzelfallprüfung der verbleibenden FP-Liste.

### Phase 5: Globale Thresholds nur als letzter Schritt

Ziel:
Letzte Rest-FPs reduzieren, falls die gezielten Maßnahmen nicht ausreichen.

Maßnahmen:

- Kleine globale Threshold-Anhebungen nur experimentell testen.
- Änderungen nur übernehmen, wenn sie messbar Precision verbessern und keine
  neuen False Negatives erzeugen.

Erwartete Wirkung:

- Kann Precision weiter steigern.
- Höchstes FN-Risiko aller Phasen.

Validierung:

- Fingerprint-Vergleich ist hier Pflicht.
- Neue False Negatives sind ein Abbruchkriterium.

---

## Fachliche Testfälle

- Ein heute korrekt erkannter Zielakkord bleibt korrekt erkannt.
- Ein identisches Griffbild mit identischer Pitch-Class-Struktur zählt nicht
  mehr als separater FP-Fall.
- `C-Dur` wird nicht zusätzlich als `Cmaj7`, `Csus2` oder `Csus4`
  akzeptiert.
- `E-Dur` wird nicht zusätzlich als `Esus2` akzeptiert.
- Ein Dominantseptakkord wird nicht zusätzlich als einfache Dur-Variante
  akzeptiert, wenn die Septime nicht stark genug ist.
- `sus2` und `sus4` werden nur akzeptiert, wenn ihre charakteristische
  Spannung gegenüber Terz-basierten Alternativen ausreichend hörbar ist.
- `add9` wird nicht allein wegen allgemeiner Nähe zur Triade mitakzeptiert.
- Nach jeder Phase bleibt `FN=0`.

---

## Betroffene Bereiche

Voraussichtlich relevant:

- `js/games/chordExerciseEssentia/essentiaChordLogic.js`
- `tests/helpers/chordRecognitionMetrics.js`
- `scripts/chord-recognition-fingerprint.mjs`
- `tests/unit/essentiaChordTargetedRegression.test.js`
- `tests/unit/essentiaChordLogic.test.js`
- ggf. zusätzliche zielgerichtete Regressionstests

---

## Umsetzungsreihenfolge

1. Varianten-/Alias-Themen und Metrik bereinigen.
2. Same-root-Disambiguierung für `sus2`, `sus4`, `add9`, `maj7`, `7`
   ergänzen.
3. Best-Match-Tolerance und Subset-Regeln begrenzen.
4. Verbleibende FP-Cluster analysieren und pro Akkordfamilie nachschärfen.
5. Nur wenn nötig globale Thresholds testen.

Nach jeder Phase:

- Fingerprint ausführen
- `TP/FP/FN/TN` dokumentieren
- bekannte Regressionstests ausführen

---

## Risiken

- Zu strenge Regeln für Erweiterungsakkorde können reale Gitarrenaufnahmen
  mit schwach ausgeprägten Zusatznoten plötzlich verwerfen.
- Eine bessere Roh-Precision kann teilweise nur aus Metrikbereinigung kommen;
  das muss von echter Erkennungsverbesserung getrennt betrachtet werden.
- Subset-Acceptance könnte sowohl notwendige Robustheit liefern als auch
  unnötige False Positives verursachen; Eingriffe daran müssen schrittweise
  erfolgen.
- Bass-Evidenz ist potenziell hilfreich, aber nicht in jeder Aufnahme stabil
  genug für harte Gates.

---

## Offene Entscheidungen

- Sollen vereinfachte Griffbild-Varianten mit identischer Pitch-Class-Struktur
  grundsätzlich als dieselbe Akkordklasse gelten?
  Vorschlag: ja.

- Soll der Fingerprint künftig sowohl Rohwerte als auch normalisierte Werte
  ausgeben?
  Vorschlag: ja, falls Varianten die Metrik weiter verzerren.

- Soll Bass-Support nur für knappe Same-root-Entscheidungen verwendet werden
  oder später stärker gewichtet werden?
  Vorschlag: zunächst nur als zusätzlicher Disambiguator.

---

## Erfolgskriterium

Die Aufgabe ist erfolgreich, wenn:

- die Precision spürbar steigt,
- `FN=0` erhalten bleibt,
- die verbleibenden False Positives klarer auf echte schwierige Grenzfälle
  statt auf Varianten- oder Toleranzartefakte zurückgehen.
