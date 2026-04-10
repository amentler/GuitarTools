# Tuner – Analyse & Verbesserungsplan

Stand: 2026-04-10

---

## 1. Analyse der aktuellen Probleme

### 1.1 Trägheit (langsame Reaktion)

Der Tuner reagiert langsam, weil mehrere Mechanismen Verzögerung addieren:

#### a) Großes FFT-Fenster
`getAdaptiveFftSize()` liefert **16 384 Samples** (ca. 372 ms bei 44100 Hz)
für alle Saiten außer E2/A2, für die sogar **32 768 Samples** (~743 ms) verwendet werden.
Das bedeutet: Jeder Frame analysiert Audio, das bis zu 370–740 ms alt ist.
Für die oberen Saiten (G3, B3, E4 ab ca. 196–329 Hz) reichen **8 192 Samples** (~186 ms) aus – das entspricht bei G3 noch ~36 Schwingungsperioden, mehr als genug für YIN.

#### b) Analyse-Intervall 100 ms
`ANALYZE_INTERVAL_MS = 100` → der Tuner liest nur **10× pro Sekunde** einen neuen
Buffer. Zusammen mit dem großen Fenster werden Tonänderungen erst mit deutlicher Verzögerung sichtbar.

#### c) Rolling Median über 5 Werte
`HISTORY_SIZE = 5` bei 100 ms Intervall = **500 ms Glättungsfenster**.
Der Median-Filter macht den Tuner stabil, aber er verschleppt Sprünge und
echte Tonänderungen um bis zu eine halbe Sekunde.

#### d) Notenwechsel-Hysterese (3 Frames)
`NOTE_SWITCH_CONFIRM_FRAMES = 3` bedeutet: ein neuer Ton wird erst nach
**3 aufeinanderfolgenden übereinstimmenden Frames** (= 300 ms) übernommen.
Diese Verzögerung addiert sich zu Punkt b und c.

**Gesamteffekt:** Ändert man den Ton, kann es 500–800 ms dauern, bis das Display
reagiert. Mobile Apps arbeiten typischerweise mit 50 ms Intervall und 3–4 Frames Glättung.

---

### 1.2 Sprünge (unvorhergesehenes kurzes Zucken)

#### a) HPS-Algorithmus ist fehlerhaft langsam (O(n²))
`detectPitchHps()` implementiert eine **handgestrickte diskrete Fouriertransformation**
per Bin – ohne FFT. Für einen 16 384-Sample-Buffer und maxBin ≈ 156 sind das
ca. **~12,9 Millionen Multiplikationen pro Frame** (131 aktive Bins × 3 DFTs × 2 Ops/Sample × 16 384 Samples).
Das ist auf Mobilgeräten so langsam, dass der Main Thread blockiert, danach
mehrere Frames „nachgeholt" werden und die Nadel ruckartig springt.

#### b) YIN allein als Fallback
Wenn YIN und HPS nicht übereinstimmen, fällt `selectCombinedPitch()` auf **YIN
allein** zurück. YIN kann bei harten Transienten oder Oberton-reichen Gitarrentönen
(z. B. frisch angeschlagene E2-Saite) kurzzeitig die doppelte Frequenz liefern
(Oktavfehler). Dieser falsche Wert wird dann direkt als Median-Input verwendet
und durch den Rolling-Median verschleppt.

#### c) Fehlende Ausreißer-Filterung
Der Rolling Median schützt gegen einzelne falsche Werte – aber wenn der Ausreißer
groß genug ist, kann er den Median trotzdem verschieben. Eine **Rejection**-Logik
(„Wert mehr als X Cents vom aktuellen stabilen Wert entfernt → verwerfen")
fehlt.

---

### 1.3 Hintergrundgeräusche

#### a) Schwacher Bandpass-Filter (1. Ordnung)
`applyGuitarBandpass()` kombiniert einen einfachen **One-Pole-Hochpass und
One-Pole-Tiefpass (je 6 dB/Oktave)**. Das entspricht einem sehr flachen Roll-off.
Rauschen bei 500–1000 Hz (z. B. Gespräche, Lüfter) wird kaum gedämpft und
kann den YIN-Algorithmus mit seinem Oberton-Spektrum stören.

#### b) Fixer RMS-Schwellwert
`GUITAR_MIN_RMS = 0.008` ist ein statischer Wert. In einer leisen Umgebung
schützt er zuverlässig gegen Stille. In lauten Umgebungen kann Hintergrundgeräusch
diesen Schwellwert überschreiten und als „valides Signal" durchkommen – der Tuner
zeigt dann einen zufälligen Ton an.

#### c) Kein Noise Floor Estimation
Mobile Tuner-Apps messen beim Start oder kontinuierlich den Umgebungslärm
(Noise Floor) und setzen den RMS-Schwellwert **relativ dazu** (`min_rms = noise_floor × factor`).
Diese adaptive Schwelle fehlt komplett.

#### d) YIN-Threshold nicht adaptiv
Der YIN-Schwellwert von `0.15` ist fest kodiert. Bei starkem Hintergrundgeräusch
sollte er strenger sein (z. B. `0.10`), damit nur klare, periodische Signale
erkannt werden.

---

## 2. Verbesserungsvorschläge

Die Vorschläge sind nach **Impact** und **Umsetzungsaufwand** priorisiert.

---

### Prio 1 – Schnell umsetzbar, großer Gewinn

#### V1: Adaptive FFT-Fenstergröße verfeinern
**Problem:** Obere Saiten (G3, B3, E4) bekommen ein viel zu großes 16 384-Fenster.
**Lösung:** Drei Stufen statt zwei:

| Frequenzbereich | Saite(n) | Neue fftSize | Dauer (44100 Hz) |
|-----------------|----------|-------------|------------------|
| ≤ 90 Hz         | E2       | 32 768      | 743 ms           |
| 90–160 Hz       | A2, D3   | 16 384      | 371 ms           |
| > 160 Hz        | G3, B3, E4 | 8 192     | 186 ms           |

Damit halbiert sich die Analyse-Latenz für die oberen Saiten.

#### V2: Analyse-Intervall auf 50 ms reduzieren
**Problem:** 100 ms = nur 10 Frames/s, spürbar träge.
**Lösung:** `ANALYZE_INTERVAL_MS = 50` → 20 Frames/s.
Das verdoppelt die Reaktionsgeschwindigkeit ohne die Genauigkeit zu verschlechtern.
Der Rolling Median (5 Werte × 50 ms) deckt dann noch 250 ms ab – ausreichend.

#### V3: Ausreißer-Rejection vor dem Median
**Problem:** Einzelne falsche Frequenzwerte werden direkt in den Median eingespeist.
**Lösung:** Werte, die mehr als **350 Cents** (~3,5 Halbtöne) vom aktuellen stabilen
Wert abweichen, werden verworfen (nicht in `freqHistory` eingefügt). Erst nach 2
aufeinanderfolgenden weit entfernten Werten wird ein echter Saitenwechsel akzeptiert.

Begründung für 350 Cents: Der kleinste Saitenabstand der Gitarre beträgt 400 Cents
(G3→B3). 350 Cents lässt normales Stimmen durch den gesamten Saitenbereich zu, blockt
aber echte Ausreißer (z. B. zufällige Fehlmessungen bei > 500 Cents Abstand).

```
if (stableFrequency !== null && |cents(hz, stableFrequency)| > 350 && rejectionStreak < 2)
  → hz verwerfen, rejectionStreak++
else
  → hz verwenden, rejectionStreak = 0
```

#### V4: Adaptiven RMS-Schwellwert einführen (Noise Gate)
**Problem:** Fixer `GUITAR_MIN_RMS = 0.008` zu tolerant bei Hintergrundgeräuschen.
**Lösung:**
- Beim Start des Tuners: ersten 0,5 s ohne Ton laufen lassen und den RMS des Rauschens
  messen → `noiseFoorRms`.
- Dynamischer Schwellwert: `effectiveMinRms = max(0.008, noiseFloorRms * 4)`.
- Alle 30 s neu messen (wenn kein stabiles Signal erkannt wird).

---

### Prio 2 – Mittlerer Aufwand, deutlicher Gewinn

#### V5: HPS-Algorithmus durch Web-Audio-FFT ersetzen
**Problem:** Die handgestrickte DFT in `detectPitchHps()` ist extrem langsam (O(n²))
und blockiert auf Mobilgeräten den Main Thread → ruckartige Sprünge.
**Lösung:** `AnalyserNode` hat eine eingebaute FFT. Zweiten `AnalyserNode` mit
`getFloatFrequencyData()` verwenden statt eigenem DFT:

```js
// Statt DFT von Hand:
analyserFft.getFloatFrequencyData(freqData);  // decibel magnitudes, O(n log n)
// Dann HPS direkt auf dem Magnitude-Spektrum anwenden:
// score[k] = mag[k] + mag[2k] + mag[3k]   (in dB → Summe statt Produkt)
```

Das reduziert die HPS-Berechnung von ~7,7M auf wenige Tausend Operationen.

#### V6: Höherwertiger Bandpass-Filter (2. Ordnung, Highpass + Lowpass)
**Problem:** 1. Ordnung (6 dB/Oktave) filtert Hintergrundgeräusche kaum.
**Lösung:** Zwei `BiquadFilterNode`s in Serie über die Web Audio API – Highpass + Lowpass:

```js
const hpFilter = audioCtx.createBiquadFilter();
hpFilter.type = 'highpass';
hpFilter.frequency.value = 60;   // Schneidet Rumpeln/DC-Offset <60 Hz weg
hpFilter.Q.value = 0.7;          // Butterworth-ähnlich (kein Überschwingen)

const lpFilter = audioCtx.createBiquadFilter();
lpFilter.type = 'lowpass';
lpFilter.frequency.value = 500;  // Schneidet Obertöne >500 Hz weg
lpFilter.Q.value = 0.7;

source.connect(hpFilter).connect(lpFilter).connect(analyser);
```

Der Passbereich 60–500 Hz deckt E2 (82 Hz) bis E4 (330 Hz) vollständig ab und
lässt ausreichend Spielraum für Vibrato. Roll-off: 12 dB/Oktave auf beiden Seiten.
Filterung erfolgt nativ (Audio-Thread), ohne den Main Thread zu belasten.

**Wichtig:** Kein `type='bandpass'` verwenden – ein Bandpass mit Q=1,5 und
Mittenfrequenz 200 Hz lässt nur 133–267 Hz durch und würde E2, A2, D3 und E4
stark dämpfen.

---

### Prio 3 – Mehr Aufwand, langfristig wertvoll

#### V8: AudioWorklet für Off-Main-Thread-Analyse
**Problem:** Gesamte Pitch-Erkennung läuft im Main Thread. Bei großen Buffern
(16 384 Samples) blockiert das die UI.
**Lösung:** `AudioWorkletProcessor` übernimmt die YIN-Berechnung im Audio-Thread.
Ergebnis wird per `postMessage` zurückgemeldet. Die UI-Aktualisierung bleibt
im Main Thread, wird aber nie durch die Analyse blockiert.

**Aufwand:** Hoch – erfordert separate Worklet-Datei und Messaging-Protokoll.

#### V9: Separate Cents-Glättung für flüssigere Nadel
**Problem:** Die Nadel springt diskret, weil `cents` direkt aus dem Median kommt.
**Lösung:** Zwei getrennte Smoothing-Stufen:
1. **Tonwechsel-Erkennung:** robust, langsam (aktuell)
2. **Cents-Anzeige:** eigener exponentieller Glätter (EMA mit α ≈ 0.4) auf dem
   rohen `cents`-Wert. Die Nadel bewegt sich flüssig, während der Ton stabil bleibt.

```js
smoothedCents = α * rawCents + (1 − α) * smoothedCents;
```

#### V10: Spektrale Plausibilitätsprüfung (Harmonizität)
**Problem:** Hintergrundrauschen mit periodischen Komponenten (z. B. 50-Hz-Brumm,
Klimaanlage) kann fälschlich als Ton erkannt werden.
**Lösung:** Nachdem ein Kandidat-Ton (Hz) gefunden wurde, prüfen ob das FFT-Spektrum
die erwarteten Obertöne (2×, 3×, 4× Grundfrequenz) enthält. Nur wenn mindestens
2 von 3 Obertönen deutlich sichtbar sind, gilt der Ton als valide.
Dies filtert Brummgeräusche und Hintergrundlärm sehr effektiv.

---

## 3. Zusammenfassung: Was Mobile Apps besser machen

| Feature | Aktuelle App | Mobile Tuner-Apps |
|---|---|---|
| Analyse-Intervall | 100 ms (10 fps) | 50 ms (20 fps) |
| FFT-Fenstergröße | 16–32K (370–743 ms) | 4–8K (93–186 ms) |
| Glättung | Median 5 Werte | EMA + Median |
| Noise Gate | Fixer RMS-Wert | Adaptiv |
| Filterung | 1. Ordnung IIR | Native BiquadFilter |
| HPS | Hand-DFT O(n²) | FFT-basiert O(n log n) |
| Thread-Modell | Main Thread | AudioWorklet |
| Harmonizitätsprüfung | Nein | Ja (bei guten Apps) |

---

## 4. Empfohlene Implementierungsreihenfolge

1. **V1 + V2** (FFT-Größe + Intervall) → größter Latenz-Gewinn, wenig Risiko
2. **V3** (Ausreißer-Rejection) → sofort weniger Sprünge
3. **V4** (adaptiver Noise Floor) → weniger Hintergrundgeräusch-Probleme
4. **V5** (FFT-basiertes HPS) → Performance auf Mobile, weniger Ruckeln
5. **V6** (Highpass + Lowpass Filter) → bessere Rauschunterdrückung
6. **V9** (Cents-Glättung) → komfortablere Nadel-Anzeige
7. **V8 + V10** (AudioWorklet + Harmonizität) → langfristig, wenn nötig
