# Plan: Legato-Erkennung in „Noten spielen" verbessern

## Kontext

**Problem:** In `sheetMusicReading` (das aktive „Noten spielen") ist Legato-Spiel kaum möglich.
Klingt ein Ton noch aus und der Spieler schlägt den nächsten an, registriert das
`noteOnsetGate` keinen neuen Onset – weil `canRetriggerOnSustain` verlangt, dass der neue Anschlag
**2,2×** den aktuellen Sustain-Floor überschreitet (`spikeFactor = 2.2`).
Bei einer noch klingenden Saite liegt der Floor oft bei RMS ≈ 0.04–0.06; der neue Anschlag
müsste dann ≥ 0.09–0.13 erreichen. Das ist für viele Gitarren-Anschläge zu hoch.

**Ziel:** `sheetMusicReading` erkennt Legato-Anschläge zuverlässig, ohne die Präzision von
„Ton spielen" (`notePlayingExercise`) zu beeinflussen. Beide Übungen sind unabhängig (eigener
AudioContext + OnsetGateState) – die Änderung erfolgt ausschließlich über einen neuen,
optionalen Parameter.

---

## Betroffene Dateien

| Datei | Was ändert sich |
|---|---|
| `js/shared/audio/noteOnsetGate.js` | Neue exportierte Konstante `ONSET_REATTACK_SPIKE_FACTOR = 1.5`; neuer Option-Parameter `reattackSpikeFactor` in `updateOnsetGate()` |
| `js/games/sheetMusicReading/sheetMusicReading.js` | Import + Übergabe von `ONSET_REATTACK_SPIKE_FACTOR` beim `updateOnsetGate()`-Aufruf in `analyzeFrame()` |
| `tests/unit/noteOnsetGate.test.js` | Neue Tests für `reattackSpikeFactor`-Option |

**Nicht geändert:** `notePlayingExercise.js`, `fastNoteMatcher.js`
(legacy), alle anderen Dateien.

---

## Neue Funktion / geänderter Export

### `noteOnsetGate.js`

```js
/** Separater Spike-Faktor für Re-Attack während eines laufenden Sustain.
 *  Niedriger als ONSET_SPIKE_FACTOR, da der Floor nicht auf 0 fällt. */
export const ONSET_REATTACK_SPIKE_FACTOR = 1.5;

export function updateOnsetGate(state, samplesOrRms, options = {}) {
  const spikeFactor         = options.spikeFactor         ?? ONSET_SPIKE_FACTOR;
  const reattackSpikeFactor = options.reattackSpikeFactor ?? spikeFactor; // NEU
  // ...
  const canRetriggerOnSustain = state.wasAboveThreshold
    && cooldownFramesRemaining === 0
    && trackedFloor !== null
    && rms > state.lastRms
    && rms >= trackedFloor * reattackSpikeFactor   // vorher: spikeFactor
    && (rms - trackedFloor) >= reattackMinDelta;
  // ...
}
```

**Signatur:** `updateOnsetGate(state, samplesOrRms, options = {})` – unverändert nach außen.
Alle bestehenden Aufrufer ohne `reattackSpikeFactor` behalten exakt das alte Verhalten.

### `sheetMusicReading.js` – `analyzeFrame()` (Zeile 373)

```js
import {
  ONSET_REATTACK_SPIKE_FACTOR,   // NEU
  createOnsetGateState, updateOnsetGate, isOnsetGateOpen, consumeOnsetGate,
} from '../../shared/audio/noteOnsetGate.js';

// in analyzeFrame():
const gate = updateOnsetGate(state.onsetGateState, buffer, {
  reattackSpikeFactor: ONSET_REATTACK_SPIKE_FACTOR,   // NEU
});
```

`handleTimedBeat()` ruft kein `updateOnsetGate()` auf – dort wird nur `createOnsetGateState()`
gesetzt, was ausreicht.

---

## Teststrategie

### Unit-Tests (vollständig automatisierbar) – `tests/unit/noteOnsetGate.test.js`

Vier neue Testfälle am Ende des bestehenden `describe('noteOnsetGate', ...)`:

**TC1 – Retrigger mit niedrigem `reattackSpikeFactor` feuert bei 1.6× Floor**
```
Setup: baseline ~0, onset bei rms=0.08 → consumeOnsetGate
Sustain: rms sinkt auf [0.07, 0.06, 0.05, 0.04] → trackedFloor≈0.04
New attack: rms=0.065 (= 1.625× floor), rms > lastRms
Option: { reattackSpikeFactor: 1.5 }
Erwartung: event === 'onset'
```

**TC2 – Gleiches Szenario ohne Option: Retrigger feuert NICHT**
```
Gleicher Setup wie TC1, KEIN reattackSpikeFactor (default 2.2)
rms=0.065 < 0.04 * 2.2 = 0.088
Erwartung: event === null
```

**TC3 – Absolutes Delta-Limit gilt weiterhin**
```
Setup: baseline~0, onset bei rms=0.003 → consumeOnsetGate
Sustain: rms fällt auf 0.002 → trackedFloor≈0.002
New attack: rms=0.004 (= 2.0× floor, > 1.5× floor)
Aber: (0.004 - 0.002) = 0.002 < ONSET_REATTACK_MIN_DELTA (0.015)
Option: { reattackSpikeFactor: 1.5 }
Erwartung: event === null  (absolutes Delta schützt vor Rauschen)
```

**TC4 – Rückwärtskompatibilität: kein Option → altes Verhalten**
```
Gleicher Aufruf wie bisheriger Test "reopens on a strong re-attack":
Floor≈0.018, attack=0.055 (≈3.0× floor)
Kein reattackSpikeFactor
Erwartung: event === 'onset'  (unverändert)
```

### Playwright-E2E-Test – `tests/e2e/sheet-music-reading-legato.spec.js`

Zwei Tests (fast + slow) mit echten Gitarren-WAV-Fixtures, die legato aufgenommen wurden:

| Fixture | Pfad |
|---|---|
| Fast | `tests/fixtures/sequences/open-strings/aeaedgdgbebeabab.wav` |
| Slow | `tests/fixtures/sequences/open-strings/aeaedgdgbebeabab_slow.wav` |

Sequenz: A2–E2–A2–E2 · D3–G3–D3–G3 · B3–E4–B3–E4 · A2–B3–A2–B3 (16 Töne, 4 Takte)

Chromium-Flags: `--use-fake-ui-for-media-stream --use-file-for-fake-audio-capture=<wav>`

Assertions:
1. `#sheet-music-current-note` = `D3` (nach Takt 1)
2. `#sheet-music-current-note` = `B3` (nach Takt 2)
3. `#sheet-music-current-note` = `✓` + Feedback `Alle Noten gespielt!`
4. 16 grüne SVG-Elemente (`fill="#2ecc71"`)

Der Test schlägt vor dem Fix fehl (Gate zu streng für Legato) und ist grün danach.

---

## TDD-Reihenfolge

1. **Rot:** TC1–TC4 in `noteOnsetGate.test.js` schreiben → `npm test` schlägt fehl
2. **Grün (`noteOnsetGate.js`):**
   - `ONSET_REATTACK_SPIKE_FACTOR = 1.5` exportieren
   - `reattackSpikeFactor` als Option ergänzen
   - `canRetriggerOnSustain` nutzt `reattackSpikeFactor` statt `spikeFactor`
   - `npm test` → grün
3. **Controller (`sheetMusicReading.js`):**
   - Import `ONSET_REATTACK_SPIKE_FACTOR`
   - `analyzeFrame()` übergibt `{ reattackSpikeFactor: ONSET_REATTACK_SPIKE_FACTOR }`
   - `npm run lint` → grün

---

## Implementierungsreihenfolge

1. `tests/unit/noteOnsetGate.test.js` – TC1–TC4 einfügen (rot)
2. `js/shared/audio/noteOnsetGate.js` – Konstante + Option + `canRetriggerOnSustain`-Fix (grün)
3. `js/games/sheetMusicReading/sheetMusicReading.js` – Import + Übergabe in `analyzeFrame()`
4. `npm test && npm run lint`
5. Playwright-E2E: `tests/e2e/sheet-music-reading-legato.spec.js` läuft grün (Fixtures bereits vorhanden)

---

## Manuelle Verifikation

- Übung `sheetMusicReading` öffnen (Aktiv-Modus an)
- Zwei verschiedene Töne legato spielen (zweiter Anschlag, während erster noch klingt)
- → Beide Töne werden erkannt, kein zweites Anschlagen nötig
- „Ton spielen" öffnen → Verhalten unverändert (kein Einfluss)
