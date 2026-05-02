# Plan: Chord-Recognition-Precision — TDD-Implementierung

**Stand:** 2026-05-02  
**Status:** Entwurf  
**Bezug:** `plans/precisionplans/chord-recognition-precision-plan-2026-05-02.md` (strategische Übersicht)

---

## Kontext

**Ist-Zustand (Fingerprint 2026-05-02):** TP=57, FP=45, FN=0, Precision=55.9%, Recall=100%, F1=71.7%  
**Ziel:** FPs reduzieren ohne neue FNs einzuführen. Precision ≥ 65 %, FN bleibt 0.

**Zwei konkret fixierbare Ursachen:**

| Kat. | Beispiel | Ursache |
|---|---|---|
| **A** | D-Moll-Audio → Dm7 FP (conf=0.660) | `passesBestMatchTolerance` toleriert bis 0.12 Gap auch bei gleicher Tonika |
| **B** | A-Moll-Audio → A7 FP (conf=0.363) | `passesDominantSeventhVariantAcceptance` prüft nur `conf ≥ threshold` (=0.26) |

**Nicht fixierbar (Kat. C, ~15 FPs):** Strukturelle HPCP-Ambiguität zwischen C-Dur und C-Dur(1-Finger). Beide teilen identische Pitch-Class-Profile; das einfachere Template gewinnt durch Cosine-Scoring. Der `bestMatch === targetChordName`-Pfad wird berührt, nicht der Toleranz-Pfad → Threshold-Tuning greift nicht. Dokumentieren, nicht anfassen.

---

## Betroffene Dateien

| Datei | Änderung |
|---|---|
| `js/games/chordExerciseEssentia/essentiaChordLogic.js` | Neue Felder in Profilen; Logik in `evaluateBestMatchCompatibility` |
| `tests/unit/essentiaChordLogic.test.js` | Neuer `describe`-Block: 4 Unit-Tests mit synthetischem HPCP |
| `tests/unit/essentiaChordTargetedRegression.test.js` | 3 neue `it`-Blöcke in bestehendem `describe` |
| `version.txt` | Versions-Bump |

---

## Neue Konstanten / Felder

### 1. `DEFAULT_PROFILE` — neues Feld (nach `bestMatchTolerance: 0.12`, Zeile 53)

```js
sameRootTolerance: 0.07,   // stricter tolerance for same-root chord cousins
```

### 2. `CHORD_TYPE_PROFILES['7']` — neues Feld (nach `minSeventhEnergy: 0.05`, Zeile 105)

```js
minDominantVariantConfidence: 0.45,
```

### 3. `evaluateBestMatchCompatibility` — Logikänderung (Zeile ~462)

**Vorher:**
```js
const passesBestMatchTolerance = bestScore - confidence <= profile.bestMatchTolerance &&
  (!targetDescriptor || sharesRoot(targetDescriptor, bestDescriptor) || hasDominantSeventhEvidence);
```

**Nachher:**
```js
const rootsMatch = sharesRoot(targetDescriptor, bestDescriptor);
const activeTolerance = rootsMatch
  ? (profile.sameRootTolerance ?? profile.bestMatchTolerance)
  : profile.bestMatchTolerance;
const passesBestMatchTolerance = bestScore - confidence <= activeTolerance &&
  (!targetDescriptor || rootsMatch || hasDominantSeventhEvidence);
```

### 4. `passesDominantSeventhVariantAcceptance` — Logikänderung (Zeile ~467–472)

**Vorher (Zeile 472):**
```js
confidence >= profile.threshold,
```

**Nachher:**
```js
confidence >= profile.threshold &&
(profile.minDominantVariantConfidence === undefined ||
  confidence >= profile.minDominantVariantConfidence),
```

---

## Teststrategie

### Unit-Tests (synthetisch, in `essentiaChordLogic.test.js`)

Neuer `describe`-Block am Ende: `"sameRootTolerance und minDominantVariantConfidence"`.  
HPCP-Vektoren als `new Float32Array(12)` direkt konstruiert — keine Fixture-Abhängigkeit.

**Test U-1: sameRootTolerance blockiert Same-Root-FP**

Konstruiere HPCP mit starker D-Moll-Charakteristik und schwacher Septime.  
Gap zwischen D-Moll (bestMatch) und Dm7 (probe) soll im Bereich `(0.07, 0.12)` liegen,  
sodass es mit alter Toleranz (0.12) passt, mit neuer (0.07) nicht.

```
Ziel-HPCP: bin2(D)≈1.0, bin5(F)≈0.70, bin9(A)≈0.60, bin0(C)≈0.10
Target:     'Dm7'
Vor Impl.:  isCorrect: true  (aktueller FP)
Nach Impl.: isCorrect: false
Sanity:     matchHpcpToChord(hpcp, 'D-Moll', ...).isCorrect === true  (kein FN)
```

*Kalibrierung:* Exakte Float-Werte beim Implementieren durch iteratives Laufen ermitteln,  
bis der gemessene Gap im Zielbereich (0.07–0.12) liegt.

**Test U-2: sameRootTolerance greift nicht bei gap < sameRootTolerance**

HPCP so konstruiert, dass gap ≤ 0.05 → Probe bleibt `isCorrect: true` (keine Überblockierung).

**Test U-3: sameRootTolerance greift nicht bei verschiedener Tonika**

Cross-root-Situation: gap liegt zwischen 0.07 und 0.12, aber bestMatch hat anderen Root.  
→ `bestMatchTolerance` (0.12) gilt, nicht `sameRootTolerance` → `isCorrect: true`.

**Test U-4: minDominantVariantConfidence blockiert schwachen Dom7-Acceptance**

HPCP mit starker A-Moll-Charakteristik, schwaches G (keine echte Septime):

```
Ziel-HPCP: bin9(A)≈0.90, bin0(C)≈0.75, bin4(E)≈0.95, bin7(G)≈0.12
Target:     'A7'
Vor Impl.:  isCorrect: true  (aktueller FP via passesDominantSeventhVariantAcceptance)
Nach Impl.: isCorrect: false
Sanity:     matchHpcpToChord(hpcp, 'A-Moll', ...).isCorrect === true  (kein FN)
```

---

### Fixture-Integrationstests (in `essentiaChordTargetedRegression.test.js`)

Neue `it`-Blöcke am Ende des bestehenden `describe('Targeted chord regressions', ...)`.  
Infrastruktur (`getMatchResult`, `TEMPLATES`) ist bereits vorhanden.

**Test R-1: D-Moll-Fixtures dürfen nicht als Dm7 erkannt werden**

```js
it('akzeptiert D-Moll-Fixtures nicht fälschlich als Dm7', () => {
  for (const wavFile of ['D-Moll/dmin.wav', 'D-Moll/dmoll_steel.wav']) {
    const dMollResult = getMatchResult('D-Moll', wavFile, 'D-Moll');
    const dm7Result   = getMatchResult('D-Moll', wavFile, 'Dm7');
    expect(dMollResult.isCorrect).toBe(true);
    expect(dm7Result.isCorrect).toBe(false);
  }
});
```

**Test R-2: A-Moll-Fixtures dürfen nicht als A7 erkannt werden**

```js
it('akzeptiert A-Moll-Fixtures nicht fälschlich als A7', () => {
  for (const wavFile of ['A-Moll/amin.wav', 'A-Moll/amoll_steel.wav']) {
    const aMinorResult = getMatchResult('A-Moll', wavFile, 'A-Moll');
    const a7Result     = getMatchResult('A-Moll', wavFile, 'A7');
    expect(aMinorResult.isCorrect).toBe(true);
    expect(a7Result.isCorrect).toBe(false);
  }
});
```

**Test R-3: Echte A7-Fixtures bleiben akzeptiert (Regressionssicherung)**

```js
it('erkennt A7-Fixtures weiterhin als A7 (kein FN durch minDominantVariantConfidence)', () => {
  for (const wavFile of ['A7/01.wav', 'A7/a7_steel.wav']) {
    const result = getMatchResult('A7', wavFile, 'A7');
    expect(result.isCorrect).toBe(true);
  }
});
```

---

### Was NICHT unit-testbar ist

Die Gesamtmetrik (FP-Gesamtzahl, Precision) ist nur via `fingerprint`-Skript messbar.  
Unit-Tests verifizieren die einzelnen Logikänderungen; das Skript misst den Nettoeffekt.

---

## TDD-Reihenfolge

```
Schritt 1 — RED: Tests schreiben, bestätigen dass sie scheitern
  - essentiaChordLogic.test.js: U-1 bis U-4 einfügen
  - essentiaChordTargetedRegression.test.js: R-1, R-2, R-3 einfügen
  - Laufen lassen: U-1, U-4, R-1, R-2 rot; U-2, U-3, R-3 grün (Sanity-Checks)

Schritt 2 — GREEN (Kategorie A): sameRootTolerance implementieren
  a) DEFAULT_PROFILE: sameRootTolerance: 0.07 hinzufügen
  b) evaluateBestMatchCompatibility: rootsMatch + activeTolerance einbauen
  c) vitest: U-1, R-1 → grün; alle anderen bleiben grün

Schritt 3 — GREEN (Kategorie B): minDominantVariantConfidence implementieren
  a) dom7-Profil: minDominantVariantConfidence: 0.45 hinzufügen
  b) passesDominantSeventhVariantAcceptance: Guard-Bedingung einbauen
  c) vitest: U-4, R-2 → grün; alle anderen bleiben grün

Schritt 4 — Vollständige Regression
  a) npm test: alle bestehenden Tests müssen grün bleiben
  b) Falls sameRootTolerance=0.07 zu viele TPs killt → auf 0.08 erhöhen und erneut messen
  c) Falls minDominantVariantConfidence=0.45 echte A7-Fixtures blockiert → auf 0.40 senken

Schritt 5 — Fingerprint messen
  a) node scripts/chord-recognition-fingerprint.mjs
  b) FN muss 0 sein (harte Leitplanke)
  c) FP-Ziel: ≤ 35 (realistisch ≤ 30 nach Kat-C-Abzug)
```

---

## Implementierungsreihenfolge (konkret)

1. `essentiaChordLogic.test.js`: Neuen `describe`-Block mit U-1–U-4 am Ende einfügen
2. `essentiaChordTargetedRegression.test.js`: R-1–R-3 vor schließender `});` einfügen
3. `npx vitest run` — neue Tests rot bestätigen (außer U-2, U-3, R-3)
4. `essentiaChordLogic.js`, `DEFAULT_PROFILE` Zeile 53: `sameRootTolerance: 0.07` einfügen
5. `essentiaChordLogic.js`, `evaluateBestMatchCompatibility` Zeile ~462: `activeTolerance`-Logik einbauen
6. `npx vitest run` — U-1, R-1 grün; Regression prüfen
7. `essentiaChordLogic.js`, `CHORD_TYPE_PROFILES['7']` Zeile ~105: `minDominantVariantConfidence: 0.45` einfügen
8. `essentiaChordLogic.js`, `passesDominantSeventhVariantAcceptance` Zeile ~472: Guard einbauen
9. `npm test` — alle Tests grün
10. `node scripts/chord-recognition-fingerprint.mjs` — Kennzahlen notieren
11. Ggf. Werte nachjustieren (siehe Schritt 4)
12. `version.txt` bumpen; Kommentar zu Kat-C-Limitation im Code

---

## Verifikation

```bash
# Alle Tests grün
npm test

# Fingerprint mit Kennzahlen
node scripts/chord-recognition-fingerprint.mjs

# Einzelne Suiten
npx vitest run tests/unit/essentiaChordLogic.test.js
npx vitest run tests/unit/essentiaChordTargetedRegression.test.js
npx vitest run tests/unit/essentiaChordConfusionMetrics.test.js
```

**Erfolgskriterien:**

| Metrik | Ziel |
|---|---|
| FN | = 0 (hart) |
| FP | ≤ 35 (Ziel ≤ 30) |
| Precision | ≥ 65 % |
| Alle bestehenden Tests | grün |

---

## Known Limitations

**Kat. C (~15 FPs, nicht behoben):**  
C-Dur ↔ C-Dur(1-Finger) teilen identische Pitch-Class-Profile. Das einfachere Template  
erzielt höheren Cosine-Score auf C-Dur-Audio; der Treffer erfolgt via `bestMatch === targetChordName`,  
nicht via Toleranz-Logik. Behebung erfordert Änderung der Score-Funktion (Template-Größen-Normalisierung),  
was bestehende TPs destabilisieren kann. → Kommentar im Code, kein Fix in diesem Plan.
