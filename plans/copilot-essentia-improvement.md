# Essentia PitchYin – Verbesserungsplan für die Noten-lesen-Erkennung

**Stand:** 2026-05-10  
**Ziel:** Essentia-Strategie mindestens auf das Niveau des fast-note-matchers bringen (aktuell 50 % vs. 62,5 % Fixture-Pass-Rate, 69,5 % vs. 78,1 % Note-Recall)

---

## Ist-Analyse (`npm run sfp`)

| Strategie | Pass-Rate | Note Recall | Onsets erkannt |
|---|---|---|---|
| fast-note-matcher | 62,5 % (5/8) | 78,1 % (100/128) | 69,5 % |
| essentia-pitch-yin | 50,0 % (4/8) | 69,5 % (89/128) | 69,5 % |

### Haupt-Fehlerquellen

| Fixture | FNM | Essentia | Fehlertyp |
|---|---|---|---|
| `aeaedgdgbebeabab.wav` | 5/16 | 5/16 | gleich schlecht → onset-Problem (nicht essentia-spezifisch) |
| `fast.wav` | 6/16 | 6/16 | gleich schlecht → onset-Problem |
| `slow.wav` | 16/16 ✓ | 16/16 ✓ | – |
| `4-4_40bpm_EBGDA_1jtn8.wav` | 16/16 ✓ | **9/16 ✗** | **6 × missing-accept** (D3, G3, E4, E2) |
| `4-4_40bpm_EGADB_9low6.wav` | 16/16 ✓ | 16/16 ✓ | – |

**Kernbefund:** Die entscheidende Differenz zwischen den Strategien sind die 6 `missing-accept`-Fälle im Fixture `4-4_40bpm_EBGDA_1jtn8.wav`. Dort werden Onsets sauber erkannt, aber PitchYin klassifiziert die Frames nicht als `correct`. Ursache ist sehr wahrscheinlich Oktavverwechslung (D3→D4, G3→G4 usw.) – ein bekanntes YIN-Problem.

### Strukturelle Unterschiede zu `detectPitch` (fast-note-matcher)

1. **Kein Vorfilter**: `detectPitch` wendet `applyGuitarBandpass` + Anschlag-Dämpfung an, bevor YIN läuft. Essentia erhält rohe Samples → Rauschen außerhalb des Gitarrenbereichs verfälscht YIN.
2. **Kein HPS-Abgleich**: `detectPitch` nutzt YIN+HPS-Hybrid zur Oktavenkorrektur. Essentia PitchYin ist reines YIN → anfällig für 2× / 0,5× Oktavfehler.
3. **Höherer RMS-Gate**: Essentia nutzt `GUITAR_MIN_RMS = 0.008`, fast-note-matcher `FAST_MIN_RMS = 0.005` → leise Töne werden häufiger abgelehnt.
4. **Feste Konfidenz-Schwelle**: `MIN_PITCH_CONFIDENCE = 0.4` verwirft valide Detektionen bei Transienten.
5. **Kein Pitch-Verlauf**: Jedes Frame wird unabhängig klassifiziert, keine Medianglättung wie im Tuner.

---

## Phasenplan

### Phase 1 – Diagnostik (Voraussetzung für alle anderen Phasen)

**Ziel:** Verstehen, was PitchYin frame-weise auf Fehler-Fixtures ausgibt.

**Aufgabe:**
- SFP um `--verbose-essentia`-Flag erweitern (oder separates Script), das für Fehler-Fixtures alle Frames mit `hz`, `pitchConfidence`, `detectedPitch` und `status` tabellarisch ausgibt.
- Frage beantworten: Werden D3/G3 als D4/G4 erkannt (Oktavfehler), als Fremdnote oder fällt die Konfidenz unter 0,4?

**Erfolgskriterium:** Mindestens eine klare Fehlerursache pro Fehler-Fixture identifiziert.

---

### Phase 2 – Vorfilter (erwarteter schneller Gewinn)

**Ziel:** Gleiche Audiovorverarbeitung wie `detectPitch`.

**Aufgabe:**
- Vor dem `essentia.PitchYin()`-Aufruf `applyGuitarBandpass()` aus `guitarPitchDetection.js` auf das Frame anwenden (Bandpass 70–1200 Hz).
- Optional: Anschlag-Dämpfung (Attack-Windowing) übernehmen – prüfen, ob PitchYin bei kurzen Transienten zuverlässiger wird.

**Erwartung:** Reduziert Rauschen außerhalb des Gitarrenbereichs → höhere Konfidenzwerte, weniger Fehlklassifikationen bei tiefen Saiten.

**Test:** SFP laufen lassen, Verbesserung der `essentia-pitch-yin`-Zeile messen.

---

### Phase 3 – RMS-Gate angleichen

**Ziel:** Essentia-Strategie mit gleichem Empfindlichkeits-Niveau wie fast-note-matcher.

**Aufgabe:**
- `GUITAR_MIN_RMS` (0.008) durch `FAST_MIN_RMS` (0.005) ersetzen (oder eigene Konstante `ESSENTIA_MIN_RMS = 0.005` exportieren).

**Erwartung:** Leise Töne, die der fast-note-matcher noch akzeptiert, werden nicht mehr frühzeitig abgeblockt.

---

### Phase 4 – HPS-Oktavenkorrektur (Hauptverbesserung für `missing-accept`)

**Ziel:** Oktavfehler von PitchYin nachträglich korrigieren.

**Aufgabe:**
- Nach `PitchYin()`-Ergebnis: HPS-Spektrum des Frames berechnen (Hilfsfunktion aus `guitarPitchDetection.js` oder einfache eigene Implementierung).
- Prüfen: Ist `pitch` aus PitchYin oder `pitch / 2` (halbe Oktave) die stärkere Fundamentale laut HPS?
- Wenn HPS auf halbe Frequenz zeigt und der halbe Wert näher am Zielton liegt → korrigierte Frequenz verwenden.
- Alternativ: Die bereits in `guitarPitchDetection.js` vorhandene `detectPitch`-Funktion direkt in der Essentia-Strategie als Fallback aufrufen, wenn PitchYin eine Oktave daneben liegt.

**Erwartung:** Behebt die `4-4_40bpm_EBGDA_1jtn8.wav`-Fehler (D3→D4-Typ).

**Test:** SFP, Ziel: `4-4_40bpm_EBGDA_1jtn8.wav` auf 16/16.

---

### Phase 5 – Adaptive Konfidenz-Schwelle

**Ziel:** Feste Schwelle (0,4) durch signal-stärkeabhängige Schwelle ersetzen.

**Aufgabe:**
- Bei hohem RMS (deutlicher Ton): niedrigere Konfidenz-Schwelle akzeptieren (z. B. 0,25).
- Bei niedrigem RMS (nahe Gate): höhere Schwelle fordern.
- Beispielformel: `minConf = lerp(0.45, 0.20, clamp((rms - minRms) / 0.05, 0, 1))`

**Erwartung:** Gültige Detektionen bei Transienten (kurzer Anschlag) werden nicht mehr irrtümlich durch die Konfidenz-Schwelle verworfen.

---

### Phase 6 – Pitch-Verlauf / Median-Glättung

**Ziel:** Stabile Klassifikation über mehrere Frames wie im Tuner.

**Aufgabe:**
- Kleinen Ring-Buffer der letzten 3–5 PitchYin-Frequenzwerte (nur konfidente Detektionen) führen.
- Medianwert als effektive Frequenz für die Klassifikation nutzen.
- Buffer bei Zielton-Wechsel zurücksetzen.

**Erwartung:** Flackernde Klassifikationen (1× correct, 1× unsure, 1× correct) werden zu konsistenten Correct-Streifen → höhere Accept-Rate ohne falsche Accepts.

---

### Phase 7 – Erweiterte Fixtures & Per-Strategie-Reporting

**Ziel:** Testabdeckung erhöhen, Regression verhindern.

**Aufgabe:**
- Zusätzliche Sequenz-Fixtures für die bisher schlechten Fälle aufnehmen (D3-Wiederholungen, schnelle Läufe auf hohen Saiten).
- SFP-Report um zweite Strategie-Detailsektion erweitern, sodass auch die Essentia-Zeile Onset-Alignment-Details zeigt (nicht nur der Default).

---

## Offene Fragen / Klärungsbedarf

1. **Soll Essentia den `detectPitch`-Fallback bekommen?** Wenn Phase 4 zeigt, dass HPS-Korrektur den Großteil der Fehler behebt, könnte man die Essentia-Strategie auch einfach auf `detectPitch` als Haupt-Algorithmus umstellen und PitchYin nur als Zusatzinformation nutzen. Das wäre effektiv eine Kombination beider Strategien.

2. **Latenz-Budget**: PitchYin + HPS + Bandpass läuft alles im 50ms-Takt. Ist das im Browser auf schwächeren Geräten noch vertretbar? Sollen Benchmarks gemessen werden?

3. **Warum ist `fast.wav` und `aeaedgdgbebeabab.wav` bei BEIDEN Strategien schlecht?** Das liegt am `guitarOnsetDetector`, der dort versagt (6 statt 16 / 5 statt 16 Onsets). Diese Fälle sollten separat als Onset-Detektions-Bugs behandelt werden – sie sind kein Essentia-Problem.

4. **PitchYin-`tolerance`-Parameter (0.15)**: Soll dieser experimentell angepasst werden (z.B. 0.10 oder 0.20)? Der Wert steuert, wie aggressiv YIN nach Periodenmaxima sucht.

---

## Empfohlene Reihenfolge

```
Phase 1 (Diagnostik) → Phase 2 (Vorfilter) → Phase 3 (RMS-Gate) 
  → Phase 4 (HPS, Kern-Fix) → Phase 5 (Konfidenz) → Phase 6 (Median) → Phase 7 (Fixtures)
```

Phase 1 ist Pflicht vor allen anderen, weil sie ggf. Phase 4 oder 5 als primären Hebel identifiziert und den Plan schärft. Phases 2–3 sind einfache Einzeiler und können sofort umgesetzt werden. Phase 4 ist der erwartete Haupt-Gewinn.
