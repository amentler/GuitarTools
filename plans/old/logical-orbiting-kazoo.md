# Plan: Fix Cents-Anzeige (±12 statt ±5, Sprung -12→+12)

## Kontext

Der Live-Tuner zeigt für gut gestimmte Saiten (A2, G3) ±12 Cent an, obwohl die Gitarre auf ±5 Cent genau ist. Außerdem springt die Anzeige beim Hochstimmen von −12 direkt auf +12, ohne die 0 zu durchlaufen.

**Diagnose:** `detectPitch` selbst gibt korrekte Werte zurück (±5 Cent laut Diagnostic-Script). Der Fehler entsteht in `selectCombinedPitch` durch das **Mitteln von YIN und HPS**:

- HPS-Algorithmus (sowohl `detectPitchHps` als auch `hpsFromMagnitudes`) hat eine grobe Bin-Auflösung:
  - Bei n=8192: binHz = 5.38 Hz → ±20 Cent Quantisierungsfehler für G3
  - Bei n=16384 (Live-Modus, fftSize=16384): binHz = 2.69 Hz → Fehler von einem falschen Bin = ±22 Cent für G3
  - Bei n=32768: binHz = 1.35 Hz → Fehler ~3–6 Cent

- Wenn YIN (präzise) und HPS (binquantisiert) gemittelt werden: `(yinHz + hpsHz) / 2` → systematischer Bias.
- Wenn HPS zwischen zwei Bins springt (z. B. bei A2 zwischen Bin 40 und Bin 41), wechselt der Mittelwert abrupt → Sprung von −12 auf +12 ohne Nulldurchgang.

**YIN ist deutlich präziser als HPS**: YIN macht parabolische Interpolation innerhalb des Perioden-Rasters. HPS gibt immer ganzzahlige Bin-Frequenzen zurück. Daher muss YIN die alleinige Frequenzquelle sein.

**Ziel:** `selectCombinedPitch` nutzt YIN immer als Frequenzquelle. HPS dient nur noch als Plausibilitätsprüfung (Oktavkorrektur). Keine Mittelung mehr.

---

## Root Cause: `selectCombinedPitch` (tunerLogic.js, Zeile 219 + 222)

```js
// Zeile 219 – BUG: Mittelung erzeugt Bias durch schlechte HPS-Auflösung
if (centsDistance(yinHz, hpsHz) <= HPS_AGREEMENT_CENTS) return (yinHz + hpsHz) / 2;

// Zeile 222 – BUG: hpsHz hat Quantisierungsfehler; schlechte Frequenzgenauigkeit
if (centsDistance(yinHz * 2, hpsHz) <= 50) return hpsHz;
```

**Beispiel G3 (196 Hz) mit n=8192 im Testbetrieb:**
- binHz = 5.38 Hz/Bin
- HPS-Bin 36 = 193.7 Hz → −20.2 Cent von G3
- Mittelwert: (196 + 193.7)/2 = 194.85 Hz → **−10.2 Cent Bias** (zeigt −10 statt 0)

**Beispiel A2 (110 Hz) im Live-Modus mit fftSize=16384:**
- Bin 40 = 107.7 Hz (−38 Cent) vs Bin 41 = 110.4 Hz (+5.6 Cent)
- Wenn Saite leicht zu tief: HPS → Bin 40 → avg weit zu tief → **−12 Cent**
- Beim Hochstimmen wechselt HPS abrupt zu Bin 41 → avg wechselt auf **+12 Cent**
- → **Sprung ohne Nulldurchgang** ✓

---

## Betroffene Dateien

| Datei | Änderung |
|---|---|
| `js/tools/guitarTuner/tunerLogic.js` | `selectCombinedPitch`: 2 Zeilen (219, 222) |
| `tests/unit/tunerLogic.test.js` | 2 neue Präzisions-Tests für A2 und G3 |
| `version.txt` | Timestamp aktualisieren |

---

## Implementierung

### Fix: `selectCombinedPitch` (Zeilen 216–229)

```js
function selectCombinedPitch(yinHz, hpsHz, lastStableHz = null) {
  if (yinHz === null && hpsHz === null) return null;
  if (yinHz !== null && hpsHz !== null) {
    // YIN hat Subpixel-Interpolation → präziser als HPS (Integer-Bins).
    // Bei Übereinstimmung: YIN als alleinige Frequenzquelle verwenden.
    if (centsDistance(yinHz, hpsHz) <= HPS_AGREEMENT_CENTS) return yinHz;

    // Oktavkorrektur: YIN liegt ~1 Oktave unter HPS → Subharmonic-Fehler.
    // yinHz * 2 statt hpsHz: YIN-Präzision bei korrekter Oktave.
    if (centsDistance(yinHz * 2, hpsHz) <= 50) return yinHz * 2;

    if (lastStableHz !== null) {
      return centsDistance(yinHz, lastStableHz) <= centsDistance(hpsHz, lastStableHz)
        ? yinHz : hpsHz;
    }
    return yinHz;
  }
  return yinHz ?? hpsHz;
}
```

**Änderungen:**
- Zeile 219: `return (yinHz + hpsHz) / 2` → `return yinHz`
- Zeile 222: `return hpsHz` → `return yinHz * 2`

---

## Neue Funktionen / Exports

Keine neuen Exports. Nur interne Logik.

---

## Teststrategie

### Neue Unit-Tests (in `tunerLogic.test.js`, Describe: `detectPitch – regression after V1/V3/V4 improvements`)

| Test | Signal | Bedingung | Rot/Grün |
|---|---|---|---|
| A2 Genauigkeit | synth(110, 44100, 32768) | `|cents from A2| < 2` | Rot vor Fix (3.2 Cent Bias), Grün danach |
| G3 Genauigkeit | synth(196, 44100, 8192) | `|cents from G3| < 5` | Rot vor Fix (10.2 Cent Bias), Grün danach |

```js
it('A2 detection has no HPS averaging bias (within 2 cents)', () => {
  const buf = synth(110, 44100, 32768);
  const hz = detectPitch(buf, 44100);
  expect(hz).not.toBeNull();
  expect(Math.abs(1200 * Math.log2(hz / 110))).toBeLessThan(2);
});

it('G3 detection has no HPS averaging bias (within 5 cents)', () => {
  const buf = synth(196, 44100, 8192);
  const hz = detectPitch(buf, 44100);
  expect(hz).not.toBeNull();
  expect(Math.abs(1200 * Math.log2(hz / 196))).toBeLessThan(5);
});
```

### Bestehende Tests

Alle bestehenden `detectPitch`-Tests verwenden weite Hz-Bereiche → bleiben grün. ✓  
B3/E4-Tests (Octave-Korrektur) prüfen nur Note/Oktave, nicht Cent-Genauigkeit → bleiben grün. ✓  
Audio-Fixture-Tests: A2, G3 (korrekte Note+Oktave) bleiben grün. ✓

### Nicht unit-testbar

Der eigentliche HPS-Bin-Sprung-Effekt (Live-Modus mit `hpsFromMagnitudes`) lässt sich nur im Browser mit echtem Mikrofon testen.

---

## TDD-Reihenfolge

1. **Rot:** A2- und G3-Präzisions-Tests schreiben → schlagen fehl (Bias > Threshold)
2. **Grün:** 2 Zeilen in `selectCombinedPitch` ändern
3. `npm test` → alle Tests grün, inkl. B3/E4-Fixture-Tests
4. Lint

---

## Implementierungsreihenfolge

1. Neue Tests in `tunerLogic.test.js` schreiben
2. `npm test` → rot bestätigen
3. `selectCombinedPitch` Zeile 219: `(yinHz + hpsHz) / 2` → `yinHz`
4. `selectCombinedPitch` Zeile 222: `return hpsHz` → `return yinHz * 2`
5. `npm test` → alle grün
6. `npm run lint`
7. `version.txt` aktualisieren

---

## Verifikation

```bash
npm test
# Erwartet: 225 Tests grün (2 neue Präzisions-Tests + alle Fixture-Tests)

# Live-Prüfung: gut gestimmte Gitarre → Tuner sollte ±5 Cent anzeigen
# Hochstimmen durch 0: Cents-Anzeige soll monoton von negativ → 0 → positiv laufen
```
