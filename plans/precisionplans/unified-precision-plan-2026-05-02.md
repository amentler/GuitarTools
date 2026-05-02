# Plan: Gemeinsamer Precision-Plan

**Stand:** 2026-05-02  
**Status:** aktiv — Phase 1 + 2 abgeschlossen, Phase 3 nächster Schritt

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

## Aktueller Fingerprint-Stand (Baseline nach Phase 2)

```
TP=57, FP=28, FN=0, TN=3708
Precision=67.1%, Recall=100%, F1=80.3%
chords=66, samples=3793
```

**Verbleibende FP-Cluster (28 gesamt):**

| Cluster | FPs | Ursache |
|---|---|---|
| C-Dur ↔ C-Dur(1-Finger) | 4 | identische Pitch Classes, kein Bass-Gate |
| G-Dur ↔ G-Dur(1-Finger) | 2 | identische Pitch Classes, kein Bass-Gate |
| Sus-Identitäten: Xsus4 ↔ Ysus2 | 4 | Csus4/Fsus2, Csus2/Gsus4, Asus2/Esus4, Asus4/Dsus2 teilen exakt gleiche Pitch Classes |
| Subset-Konfusionen | 4 | Cadd9→Gsus4, Cmaj7→C-Dur, Csus2→C-Dur (Superset triggert) |
| Dim-adjacent | 3 | D-Moll→Ddim, E-Moll→Edim (×2) |
| 7th-Subset | 3 | Em7→E-Moll, E-Moll→Em7, F7→F-Dur |
| Sonstige | 8 | G-Moll→G7, weitere |

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

## Offene Phasen

### Phase 3: Bass-gestützte Variantentrennung

**Ziel:** C-Dur vs. C-Dur(1-Finger) und G-Dur vs. G-Dur(1-Finger) via Bass-Oktave unterscheiden.

**Erster Schritt (Analyse, keine Implementierung):**

Bass-Support-Werte für die problematischen Fixture-Paare ausgeben:
```bash
# C3 (C-Dur) vs C4 (C-Dur 1-Finger) in Bass-Evidenz vergleichen
# extractBassSupportMapFromWav ist in essentiaChordTargetedRegression.test.js bereits verfügbar
```

Frage: Ist `isLocallyDominant` für C3-Erwartung bei C-Dur-Audio stabil anders als bei C-Dur-1-Finger-Audio?

**Implementierung nur wenn:** Bass-Evidenz zuverlässig zwischen C3 und C4 trennt UND keine neuen FNs entstehen.

**Validierung:** Gezielte Fixture-Tests + Fingerprint. FN=0 bleibt Abbruchkriterium.

---

### Phase 4: Sus-Identitäts-Paare adressieren

**Problem:** Xsus4 und Ysus2 mit gleichem Pitch-Class-Set (z. B. Csus4={C,F,G} = Fsus2={F,G,C}).

Diese sind bei reiner HPCP-Erkennung strukturell nicht unterscheidbar.  
Lösungsansatz analog Phase 3: Bass-Root als Disambiguator.

**Vorbedingung:** Phase 3 muss zeigen, ob Bass-Root-Unterscheidung stabil genug ist.

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

**Phase 3, Analyseschritt:**  
Bass-Support-Ausgabe für `C-Dur/c_chord.wav` vs. `C-Dur (1-Finger)/csimp.wav` —  
prüfen ob `isLocallyDominant` für den C3-Bass zuverlässig unterscheidet.
