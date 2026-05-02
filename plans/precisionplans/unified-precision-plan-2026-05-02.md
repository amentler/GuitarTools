# Plan: Gemeinsamer Precision-Plan

**Stand:** 2026-05-02  
**Status:** Entwurf zur Abstimmung mit Claude

---

## Bezug

Dieser gemeinsame Plan bezieht sich ausdrücklich auf:

- `plans/precisionplans/chord-recognition-precision-plan-2026-05-02.md`
- `plans/precisionplans/chord-precision-tdd-2026-05-02.md`
- `plans/precisionplans/plan-review-precision-claude-2026-05-02.md`
- `plans/precisionplans/old/chord-recognition-repair.md`

Ziel ist ein gemeinsamer Arbeitsstand, auf den sich Codex und Claude einigen
können, bevor weitere Precision-Änderungen umgesetzt werden.

---

## Ziel

Die Präzision der Chord-Erkennung soll weiter steigen, ohne die aktuelle
`FN=0`-Lage zu verschlechtern.

Der Plan kombiniert:

- die vorsichtige, phasenweise Strategie aus dem strategischen Precision-Plan
- die konkreten technischen Hypothesen aus dem Claude-TDD-Plan
- die kritischen Einwände aus der Plan-Review

---

## Fachliche Leitlinien

- `FN=0` bleibt harte Leitplanke.
- Änderungen werden immer gegen den aktuellen Fingerprint bewertet, nicht
  gegen veraltete Zwischenstände.
- Echte Fixture-basierte Regressionen sind wichtiger als stark kalibrierte
  synthetische HPCP-Tests.
- Varianten- und Äquivalenzfragen bleiben im Scope und werden nicht pauschal
  als „nicht fixierbar“ ausgeschlossen.
- Jede kleine Regeländerung wird einzeln messbar gemacht.

---

## Wichtige fachliche Annahme

`C-Dur` und `C-Dur (1-Finger)` sind nicht vollständig identisch.

Sie teilen zwar dieselben Pitch Classes, unterscheiden sich aber im Bass:

- `C-Dur` hat als tiefsten Ton `C3`
- `C-Dur (1-Finger)` hat als tiefsten Ton `C4`

Daraus folgt:

- Mit reiner HPCP-Logik sind sie nicht unterscheidbar, da HPCP
  oktavinvariant arbeitet.
- Mit zusätzlicher oktavbewusster Bass-Evidenz können sie prinzipiell
  unterscheidbar sein.
- Die bestehende Bass-Logik im Repo ist deshalb ein relevanter Ansatzpunkt
  für diese Variantentrennung.

---

## Fachliche Anforderungen

- Akkorde, die heute korrekt erkannt werden, sollen korrekt bleiben.
- `A-Moll` darf nicht zusätzlich als `A7` akzeptiert werden.
- `D-Moll` darf nicht zusätzlich als `Dm7` akzeptiert werden.
- Varianten mit gleicher Pitch-Class-Struktur, aber unterschiedlichem Bass,
  sollen gezielt überprüft werden statt pauschal zusammenzufallen.
- `C-Dur` und `C-Dur (1-Finger)` sollen als Bass-/Voicing-Fall gesondert
  betrachtet werden.
- Maßnahmen sollen die verbleibenden False Positives schrittweise reduzieren,
  ohne neue False Negatives zu erzeugen.

---

## Fachliche Testfälle

- `A-Moll` bleibt korrekt erkannt und wird nicht zusätzlich als `A7`
  akzeptiert.
- `D-Moll` bleibt korrekt erkannt und wird nicht zusätzlich als `Dm7`
  akzeptiert.
- Echte `A7`- und `Dm7`-Fixtures bleiben korrekt erkannt.
- `C-Dur` und `C-Dur (1-Finger)` werden gezielt gegen ihre Basslage geprüft:
  - wenn die Bass-Evidenz stabil genug ist, sollen sie unterscheidbar werden
  - wenn die Bass-Evidenz nicht stabil genug ist, darf kein neuer FN entstehen
- Nach jeder Umsetzungsphase bleibt `FN=0`.

---

## Vorgehen

### Phase 1: Gemeinsame Baseline festschreiben

Ziel:
Ein gemeinsamer, aktueller Ausgangspunkt für alle weiteren Diskussionen und
Änderungen.

Maßnahmen:

- Aktuellen Fingerprint als Referenzstand dokumentieren
- Veraltete Zwischenstände nicht mehr als Planbasis verwenden

Validierung:

- `fingerprint` auf aktuellem Repo-Stand
- Kennzahlen als Baseline für alle Folgephasen festhalten

### Phase 2: Kleine Same-root-Fixes aus dem Claude-Plan prüfen

Ziel:
Die zwei konkreten technischen Hypothesen aus dem Claude-TDD-Plan isoliert und
messbar bewerten.

Maßnahmen:

- strengere Same-root-Toleranz prüfen
- strengere Akzeptanz für Dominant-7-Varianten prüfen

Validierung:

- gezielte Fixture-Regressionen für `A-Moll -> A7`
- gezielte Fixture-Regressionen für `D-Moll -> Dm7`
- Fingerprint nach jeder einzelnen kleinen Regeländerung

### Phase 3: Bass-gestützte Variantentrennung prüfen

Ziel:
Ermitteln, ob Varianten mit gleichen Pitch Classes, aber anderer Basslage
gezielt unterschieden werden können.

Maßnahmen:

- bestehende Bass-Support-Logik für Variantengruppen auswerten
- `C-Dur` vs. `C-Dur (1-Finger)` gezielt als Pilotfall prüfen
- Bass-Evidenz zunächst nur als Disambiguator verwenden, nicht als globales
  hartes Gate
- erster Schritt ohne Implementierung:
  - die vorhandenen Bass-Support-Werte für
    `C-Dur/c_chord.wav` und `C-Dur (1-Finger)/csimp.wav`
    direkt aus den frozen Fixtures bzw. den darauf laufenden
    Test-Helfern ausgeben und vergleichen
  - Hintergrund: die Fixture-Tests in
    `tests/unit/essentiaChordTargetedRegression.test.js`
    rufen bereits `extractBassSupportMapFromWav(...)` auf, sodass die
    notwendige Bass-Evidenz im Testpfad schon verfügbar ist

Validierung:

- gezielte Tests für `C-Dur` und `C-Dur (1-Finger)`
- Prüfung, ob `C3` gegenüber `C4` in den Fixtures reproduzierbar genug
  erkennbar ist
- Übernahme nur, wenn `FN=0` erhalten bleibt

### Phase 4: Erweiterungsakkorde innerhalb derselben Root schärfen

Ziel:
`sus2`, `sus4`, `add9`, `maj7`, `7` innerhalb derselben Tonika robuster
trennen.

Maßnahmen:

- charakteristische Zusatznoten stärker relativ zur Konkurrenz bewerten
- Best-Match-Toleranz chord-typ-spezifisch enger setzen, falls Phase 2
  nicht ausreicht

Validierung:

- Regressionen pro Akkordfamilie
- Fingerprint-Differenz gegen die Baseline

### Phase 5: Subset- und Toleranzregeln prüfen

Ziel:
Mitakzeptanz aus großzügigen Kompatibilitätsregeln reduzieren.

Maßnahmen:

- Subset-Acceptance auf klar definierte Fälle begrenzen
- Toleranzpfade nur dort erhalten, wo sie echte Varianten oder robuste Treffer
  absichern

Validierung:

- bekannte Sonderfälle müssen grün bleiben
- Fingerprint darf keine neuen FNs zeigen

### Phase 6: Globale Thresholds nur als letzter Schritt

Ziel:
Restliche False Positives nur dann über globale Verschärfung reduzieren, wenn
gezielte Maßnahmen nicht ausreichen.

Validierung:

- nur übernehmen, wenn Precision steigt und `FN=0` bleibt

---

## Risiken und offene Fragen

- Die Unterscheidung `C3` vs. `C4` ist fachlich plausibel, aber nur technisch
  nutzbar, wenn die Bass-Evidenz in echten Gitarrenaufnahmen stabil genug ist.
- Wenn die Bass-Evidenz zu volatil ist, darf sie nicht als hartes globales
  Kriterium eingebaut werden.
- Synthetische HPCP-Tests können ergänzend nützlich sein, dürfen aber nicht die
  Hauptabsicherung ersetzen.
- Variantenbereinigung in der Metrik und echte Erkennungsverbesserung müssen
  sauber auseinandergehalten werden.

---

## Gemeinsame Einigungslinie

- Der strategische Precision-Plan bleibt die Hauptleitlinie.
- Der Claude-TDD-Plan wird als Quelle für konkrete kleine Technikschritte
  verwendet, nicht als alleiniger Hauptplan.
- Die Plan-Review ist verbindlich für die Einordnung von Risiken und Grenzen.
- Das Variantenproblem bleibt ausdrücklich Teil der Precision-Strategie.
- `C-Dur` vs. `C-Dur (1-Finger)` wird nicht pauschal als „nicht fixierbar“
  behandelt, sondern gezielt als Bass-/Voicing-Frage geprüft.

---

## Nächster Schritt

Claude soll zu diesem gemeinsamen Plan Stellung nehmen.

Danach wird entschieden:

- ob der Plan in dieser Form freigegeben wird
- oder ob einzelne Phasen vor der Umsetzung noch angepasst werden
