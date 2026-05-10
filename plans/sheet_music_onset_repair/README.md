# Plan: Sheet-Music-Guitar-Onset-Reparatur

**Erstellt:** 2026-05-10  
**Neu geschrieben:** 2026-05-10  
**Status:** Analyse- und Reparaturplan fuer den echten Uebungs-Onset-Pfad

---

## Ziel

Die Uebung `Noten lesen` soll schnelle und legato gespielte Gitarrenanschlaege
zuverlaessiger als neue Onsets erkennen.

Massgeblich ist nicht mehr der alte RMS-`noteOnsetGate`, sondern der echte
Produktpfad:

1. `sheetMusicReading.js` liest alle 50 ms ein `AnalyserNode`-Frame.
2. `guitarOnsetDetector.js` bewertet Time-Domain-RMS plus Frequenzspektrum.
3. Erst nach `event === 'onset'` wird `awaitingOnset` geloescht.
4. Pitch-/Accept-Logik darf danach entscheiden, ob die aktuelle Note passt.

`npm run sfp` soll deshalb fuer Sequenzen nur noch den Guitar-Onset-Detector
als Onset-Wahrheit ausweisen. Pitch-/Accept-Probleme bleiben sichtbar, sind
aber fuer diesen Plan nachrangig.

---

## Aktueller Wissensstand

`npm run sfp` nutzt fuer den Sequence-Onset-Count jetzt
`updateGuitarOnsetDetector()` mit 4096-Sample-Frames, 50-ms-Hop und per FFT
berechnetem dB-Spektrum.

Aktueller Stand:

| Bereich | Stand |
|---|---:|
| Sequence-Fixtures | 8 |
| Sequence passed | 5 |
| Sequence failed | 3 |
| Accepted notes | 100/128 |
| Note recall | 78.1% |
| Detected guitar onsets | 89/128 |
| Onset count ratio | 69.5% |

### Guitar-Onset-Counts

| Fixture | Erwartete Noten | Guitar-Onsets | Delta | Status |
|---|---:|---:|---:|---|
| `open-strings/aeaedgdgbebeabab_slow.wav` | 16 | 7 | -9 | under |
| `open-strings/aeaedgdgbebeabab.wav` | 16 | 5 | -11 | under |
| `open-strings/eeeeaaaaddddgggg.wav` | 16 | 16 | 0 | match |
| `open-strings/fast.wav` | 16 | 1 | -15 | under |
| `open-strings/medium.wav` | 16 | 16 | 0 | match |
| `open-strings/slow.wav` | 16 | 14 | -2 | under |
| `sheet-music-reading/4-4_40bpm_EBGDA_1jtn8.wav` | 16 | 15 | -1 | under |
| `sheet-music-reading/4-4_40bpm_EGADB_9low6.wav` | 16 | 15 | -1 | under |

### Interpretation

- Das alte Bild "zu viele RMS-Onsets" war fuer die echte Uebung irrefuehrend.
- Der echte Guitar-Onset-Detector zaehlt aktuell eher zu wenig als zu viel.
- `fast.wav` ist der Hauptfall: nur der erste Anschlag wird erkannt.
- `aeaedgdgbebeabab.wav` und besonders die Slow-Variante zeigen, dass der
  Detector Reattacks waehrend ausklingendem Sustain oft verpasst.
- `medium.wav` und `eeeeaaaaddddgggg.wav` sind wichtige Guardrails, weil sie
  mit dem echten Detector exakt `16/16` treffen.
- `sheet-music-reading/4-4_40bpm_EBGDA_1jtn8.wav` bleibt teilweise ein
  Pitch-/Accept-Fall, ist aber fuer diesen Plan nur als Onset-Guardrail
  relevant.

---

## Relevante Pipeline-Teile

| Modul | Rolle |
|---|---|
| `js/shared/audio/guitarOnsetDetector.js` | Einziger relevante Onset-Detector fuer `Noten lesen` und `Ton spielen`. |
| `js/games/sheetMusicReading/sheetMusicReading.js` | Echter Uebungscontroller: setzt `awaitingOnset` anhand des Guitar-Onsets. |
| `tests/helpers/sheetMusicSequenceFingerprint.js` | `sfp`-Sequenzdiagnose; zaehlt jetzt Guitar-Onsets statt RMS-Gate-Onsets. |
| `tests/helpers/chordHpcpExtraction.js` | Liefert `computeDbSpectrum()` fuer testseitige Frequenzdaten. |
| `tests/unit/guitarOnsetDetector.test.js` | Unit-Tests fuer Detector-Grundverhalten. |
| `tests/unit/sheetMusicSequenceFingerprint.test.js` | Guardrail fuer aktuell gruene Sequenzen. |
| `tests/e2e/sheet-music-reading-*.spec.js` | Realitaetsnahe Browserpfade mit Chromium-Fake-Mikrofon. |

Der alte RMS-`noteOnsetGate`-Pfad wurde aus der Anwendung entfernt. Gemeinsame
RMS-Berechnung liegt jetzt neutral in `js/shared/audio/rms.js`.

---

## Anforderungen

- `sfp` muss weiterhin direkt zeigen, wie viele echte Guitar-Onsets je Sequenz
  erkannt werden und wann sie auftreten.
- Onset-Arbeit darf nicht an Pitch-/Accept-Tuning gekoppelt werden.
- Verbesserungen muessen schnelle Reattacks erkennen, ohne die exakt passenden
  Guardrails in Overcount-Faelle zu verwandeln.
- Der echte Produktdetector bleibt die Quelle der Wahrheit. Neue Diagnose darf
  keine parallele Onset-Logik einfuehren, die die Uebung nicht nutzt.

---

## Guardrails

### Muss besser werden

- `open-strings/fast.wav`
  - Start: `1/16` Guitar-Onsets.
  - Ziel: deutlich mehr erkannte Anschlaege; erste sinnvolle Schwelle `>= 8/16`.

- `open-strings/aeaedgdgbebeabab.wav`
  - Start: `5/16` Guitar-Onsets.
  - Ziel: deutlich mehr Reattacks im Mittel-/Endteil; erste sinnvolle Schwelle
    `>= 10/16`.

- `open-strings/aeaedgdgbebeabab_slow.wav`
  - Start: `7/16` Guitar-Onsets.
  - Ziel: Reattacks waehrend Sustain besser erkennen; erste sinnvolle Schwelle
    `>= 12/16`.

### Darf nicht schlechter werden

- `open-strings/eeeeaaaaddddgggg.wav`: bleibt nahe `16/16`.
- `open-strings/medium.wav`: bleibt nahe `16/16`.
- `sheet-music-reading/*`: keine starken Overcounts; Zielkorridor `14..18`.

---

## Analysen

- [ ] **A1: Guitar-Onset-Trace fuer Problem-Fixtures**
  - Fuer `fast.wav`, `aeaedgdgbebeabab.wav` und
    `aeaedgdgbebeabab_slow.wav` pro 50-ms-Frame ausgeben:
    `timeMs`, `rms`, `broadbandFlux`, `bandRatio`, `activeBandRatio`,
    `cooldownFramesRemaining`, `event`.
  - Ziel: erkennen, ob Onsets wegen Flux-Schwelle, Band-Ratio, RMS-Attack,
    Cooldown oder fehlender spektraler Aenderung ausfallen.

- [ ] **A2: Erwartete Notenfenster gegen Onset-Zeitpunkte legen**
  - Pro Fixture erwartete Note `#1..#16` mit naechstem erkannten Guitar-Onset
    vergleichen.
  - Ziel: echte systematische Luecken sichtbar machen, statt nur Gesamtcounts
    zu betrachten.

- [ ] **A3: Reattack-vs-Sustain-Faelle isolieren**
  - Frames direkt vor und nach vermuteten fehlenden Reattacks vergleichen.
  - Ziel: entscheiden, ob ein relativer Flux-/RMS-Anstieg vorhanden ist, aber
    zu streng bewertet wird.

- [ ] **A4: Guardrail-Trace fuer Match-Fixtures**
  - `medium.wav` und `eeeeaaaaddddgggg.wav` tracebar machen.
  - Ziel: verstehen, warum diese exakt funktionieren, damit Reparaturen diese
    Eigenschaften nicht zerstoeren.

---

## Reparaturoptionen

- [ ] **R1: Reattack-Kriterium im Guitar-Onset-Detector verbessern**
  - Fuer Sustain-Frames einen lokalen Floor/Decay-Tracker nutzen.
  - Reattack nicht nur als absoluter RMS-Sprung, sondern als relativer
    Anstieg gegen den lokalen Sustain-Floor bewerten.
  - Risiko: zu empfindlich bei Nebengeraeuschen oder Saitenresonanzen.

- [ ] **R2: Spektral-Flux fuer schnelle Reattacks lokaler bewerten**
  - Aktuell kann ein neuer Anschlag untergehen, wenn viele Baender durch
    vorheriges Sustain bereits aktiv sind.
  - Moegliche Richtung: positive Flux-Spitzen gegen eine kurze lokale Historie
    statt gegen starre globale Schwellwerte bewerten.

- [ ] **R3: Active-Band-Neuheit ergaenzen**
  - Nicht nur "wie viele Bins wachsen", sondern ob neue relevante Baender
    hinzukommen oder vorhandene Baender deutlich neu anziehen.
  - Besonders interessant bei Saitenwechseln waehrend Sustain.

- [ ] **R4: Cooldown nur dann blockierend halten, wenn das Signal stabil ist**
  - Cooldown verhindert Doppeltaehlung, kann aber schnelle echte Anschlaege
    unterdruecken.
  - Moegliche Richtung: innerhalb des Cooldowns starke Spektral-Neuheit als
    Reattack zulassen.

---

## Akzeptanzkriterien

- [x] `npm run sfp` nutzt im Sequence-Onset-Teil ausschliesslich den echten
  `guitarOnsetDetector`.
- [ ] `fast.wav` steigt von `1/16` auf mindestens `8/16` Guitar-Onsets.
- [ ] `aeaedgdgbebeabab.wav` steigt von `5/16` auf mindestens `10/16`.
- [ ] `aeaedgdgbebeabab_slow.wav` steigt von `7/16` auf mindestens `12/16`.
- [ ] `medium.wav` und `eeeeaaaaddddgggg.wav` bleiben im Zielkorridor
  `15..17`.
- [ ] `sheet-music-reading/*` bleiben im Zielkorridor `14..18`.
- [ ] `tests/unit/guitarOnsetDetector.test.js` und
  `tests/unit/sheetMusicSequenceFingerprint.test.js` laufen gruen.
- [ ] Mindestens ein Regressionstest beschreibt den verbesserten Reattack-Fall
  mit realer Sequenz-Fixture oder einem daraus isolierten Trace-Ausschnitt.

---

## Vorgeschlagene Reihenfolge

1. Trace-Ausgabe fuer `guitarOnsetDetector` in `sfp` oder einem gezielten
   Diagnose-Skript ergaenzen.
2. `fast.wav`, `aeaedgdgbebeabab.wav`, `aeaedgdgbebeabab_slow.wav`,
   `medium.wav` und `eeeeaaaaddddgggg.wav` vergleichen.
3. Eine kleine Detector-Aenderung testen: zuerst R1 oder R2, nicht alles auf
   einmal.
4. `npm run sfp` nach jeder Variante als Entscheidungsgrundlage nutzen.
5. Erst wenn die Onset-Counts stabil besser sind, Pitch-/Accept-Themen wieder
   separat betrachten.

---

## Offene Fragen

- Sollen die Mindestziele (`fast >= 8/16`, `aeaed... >= 10/16`) direkt als
  harte Tests codiert werden oder vorerst nur als SFP-Entscheidungskriterien
  dienen?
- Reicht ein testseitiger FFT-Emulator fuer `sfp`, oder sollen Sequenz-Onsets
  langfristig ueber Chromium-Analyser-Goldens wie bei den Single-Note-Onsets
  gemessen werden?
