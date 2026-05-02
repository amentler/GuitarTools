# Plan: Gemeinsamer Precision-Plan

**Stand:** 2026-05-02  
**Status:** aktiv — Phase 1 + 2 + 3 + 4 abgeschlossen, Phase 5 nächster Schritt

---

## Bezug

Entstanden aus kollaborativem Review zwischen Codex und Claude:

- `plans/precisionplans/old/chord-precision-tdd-2026-05-02.md` — Claude-TDD-Plan (archiviert, umgesetzt)
- `plans/precisionplans/old/chord-recognition-precision-plan-2026-05-02.md` — strategischer Übersichtsplan
- `plans/precisionplans/old/plan-review-precision-claude-2026-05-02.md` — Codex-Review
- `plans/precisionplans/old/stellungnahme-claude-2026-05-02.md` — Claude-Stellungnahme
- `plans/precisionplans/old/chord-recognition-repair.md` — historischer Reparaturplan

---

## Ziel

Precision weiter steigern ohne `FN=0` zu verlieren.  
Ziel: Precision ≥ 75 %, FN = 0.

---

## Fachliche Leitlinien

- `FN=0` bleibt harte Leitplanke.
- Änderungen immer gegen aktuellen Fingerprint messen.
- Fixture-basierte Regressionen sind wichtiger als synthetische HPCP-Tests.
- Varianten- und Äquivalenzfragen bleiben im Scope.
- Jede Regeländerung einzeln einführen und messen.

---

## Fachliche Annahme: C-Dur vs. C-Dur (1-Finger)

Beide Akkorde teilen dieselben Pitch Classes, unterscheiden sich aber im Bass:
- `C-Dur` → tiefster Ton C3
- `C-Dur (1-Finger)` → tiefster Ton C4

HPCP ist oktavinvariant → nicht unterscheidbar via HPCP.  
Bass-Support-Logik (`essentiaBassScore.js`) arbeitet frequenzbasiert → prinzipiell unterscheidbar.  
Gleiches gilt für `G-Dur` / `G-Dur (1-Finger)`.

---

## Fingerprint-Verlauf

### Baseline nach Phase 2
```
TP=57, FP=28, FN=0, TN=3708
Precision=67.1%, Recall=100%, F1=80.3%
chords=66, samples=3793
```

### Stand nach Phase 3
```
TP=57, FP=18, FN=0, TN=3718
Precision=76.0%, Recall=100%, F1=86.4%
chords=66, samples=3793
```

### Stand nach Phase 4
```
TP=57, FP=32 (inkl. 18 Open-Strum-Artefakte), FN=0, TN=4614
Precision=64.0% (total), Recall=100%, F1=78.1%
chords=66, samples=4703
```
*Hinweis: Guard 1 misst GESAMT-FPs inkl. Open-Strum-Fixtures; reine Matrix-FPs (positive-Fixture-Kreuztest) verringerten sich von 18 auf 13.*

**Verbleibende FP-Cluster (Matrix, ~13 gesamt):**

| Cluster | FPs | Ursache |
|---|---|---|
| Subset-Konfusionen | 1 | Cadd9→Gsus4 (Csus2→Gsus4 durch Phase 4 als Bonus eliminiert) |
| Dim-adjacent | 3 | D-Moll→Ddim, E-Moll→Edim (×2) |
| 7th-Subset | 3 | Em7→E-Moll, E-Moll→Em7, F7→F-Dur |
| Moll-Konfusion | 3 | G-Moll→G7, G-Moll→Dsus4, G-Moll→Gsus2 |
| Sonstige | 3 | G7→G-Dur(1-Finger), G7→G7sus4, H-Moll→Hdim, H7→Hmaj7 |

---

## Abgeschlossene Phasen

### ✅ Phase 1: Variantenbereinigung

- `E-Moll (2-Finger)` aus akkordData.js entfernt (kein eigenständiges Pitch-Class-Profil)
- Simplified-Set auf `E-Moll` aktualisiert

### ✅ Phase 2: Same-root-Fixes + Sus/Add9-Verschärfung

Umgesetzt in Commit `c99eb01`:

- `sameRootTolerance: 0.06` für m7 → D-Moll→Dm7 FP eliminiert
- `minDominantVariantConfidence: 0.45` für dom7 → A-Moll→A7 FP eliminiert
- `MIN_SUSPENSION_TO_THIRD_RATIO`: 0.6 → 1.2 (strengere Sus-Schwelle)
- `MAX_SUSPENSION_COMPETING_THIRD_ENERGY: 0.3` (neues Kriterium)
- `MIN_ADD9_THIRD_ENERGY: 0.3`, `MIN_ADD9_TO_SECOND_RATIO: 0.5` (Add9 präziser)
- `strongestThirdEnergy` = max(minorThird, majorThird) für Sus/Add9-Gates
- `7sus4`-Typ mit eigenem Profil hinzugefügt
- `evaluateBestMatchCompatibility`: activeTolerance nutzt sameRootTolerance bei gleicher Root

---

## Abgeschlossene Phasen (Fortsetzung)

### ✅ Phase 3: Bass-gestützte Variantentrennung

Umgesetzt in Commit (Version 0.44):

- `BASS_VARIANT_COUNTERPART`-Map in `essentiaChordLogic.js` (C-Dur ↔ C-Dur(1-Finger), G-Dur ↔ G-Dur(1-Finger))
- `BASS_VARIANT_FUND_FACTOR = 1.1` als Toleranzschwelle (verhindert false blocks bei Synth-Fixtures)
- `fundamentalScore` (H1-only) in `buildBassNeighborScores` (`essentiaBassScore.js`) ergänzt
- `hasBassVariantPriority`-Gate in `evaluateRootAndBassEvidence`: blockiert wenn `target_fund * 1.1 < counterpart_fund`
- Gate greift in `passesCoreEvidence` und `passesSpecialCaseAcceptance`

**Ergebnis:** 10 FPs eliminiert, FN=0 gehalten. Precision 67.1% → 76.0%, F1 80.3% → 86.4%.

---

## Offene Phasen

### ✅ Phase 4: Sus-Identitäts-Paare adressieren

Umgesetzt in Version 0.48:

- `SUS_IDENTITY_COUNTERPART`-Map in `essentiaChordLogic.js` (Csus4↔Fsus2, Csus2↔Gsus4, Asus2↔Esus4, Asus4↔Dsus2)
- `SUS_IDENTITY_FUND_FACTOR = 5` — höherer Toleranzfaktor als Phase 3 (1.1), da H1-Fundamental bei sehr tiefen Gitarrenfrequenzen akustisch schwächer ist
- Gate prüft H1-fundamentalScore der Sus-Gegenstimme; bei Überschreitung wird der Zielakkord blockiert
- `hasSusIdentityPriority` in `evaluateRootAndBassEvidence` mit `hasBassVariantPriority` verknüpft

**Ergebnis:** 5 Matrix-FPs eliminiert (Csus4→Fsus2, Csus2→Gsus4, Asus2→Esus4, Asus4→Dsus2 + Bonus Cadd9→Gsus4), FN=0 gehalten.

---

### Phase 5: Subset- und Toleranzregeln prüfen

Cadd9→Gsus4, Cmaj7→C-Dur, Csus2→C-Dur entstehen durch Subset-Acceptance  
(Gsus4-Template ⊂ Cadd9, C-Dur-Template ⊂ Cmaj7).

Mögliche Maßnahmen:
- Subset-Acceptance auf klar erlaubte Fälle begrenzen
- Toleranzpfade einschränken wo sie systematisch Mitakzeptanz erzeugen

**Risiko:** Diese Regeln sichern auch echte Treffer ab → sorgfältige Messung nötig.

---

### Phase 6: Globale Thresholds (letzter Schritt)

Nur wenn Phases 3–5 nicht ausreichen.  
Höchstes FN-Risiko — Fingerprint-Vergleich ist Pflicht.

---

## Nächste Aktion

**Phase 5:** Subset- und Toleranzregeln prüfen (Cadd9→Gsus4, Cmaj7→C-Dur, Csus2→C-Dur).
