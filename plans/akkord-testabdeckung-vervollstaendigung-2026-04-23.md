# Plan: Akkordliste, Tabs und WAV-Testabdeckung vervollstaendigen

Stand: 2026-04-23

## Ausgangslage

- Quelle fuer Akkordgriffe ist `js/data/akkordData.js`.
- `Akkord spielen` und `Akkorduebersicht` nutzen diese Akkordliste indirekt ueber `CHORDS`, `CHORD_CATEGORIES` und `CHORD_META`.
- Der Akkordfolgen-Trainer erzeugt Progressions fuer 12 Dur-Tonarten in `js/games/akkordfolgenTrainer/akkordfolgenLogic.js`.
- Aktuell gibt es 68 Akkorde in `CHORDS`, aber nur 18 WAV-Dateien unter `tests/fixtures/chords`.
- Die Progressions erzeugen 41 verschiedene Akkordnamen. Davon fehlen 20 komplett in `CHORDS`; 10 weitere sind vorhanden, haben aber noch keine WAV-Fixture.
- Die Akkorduebersicht filtert aktuell nur die Grundtoene `A C D E F G H`. Mit diesen aktuellen Filtern sind nur `D|Add`, `F|Add` und `H|Add` leer. Fuer eine echte 12-Tonarten-Abdeckung fehlen aber alle Kreuz-/b-Grundtoene im Filter und in der Akkordliste groesstenteils.

Tab-Notation in diesem Dokument: `E A D G H e` von tiefer E-Saite bis hoher e-Saite, `x` = nicht spielen.

## Prioritaet 0: vorhandene Progressions-Akkorde einspielen

Diese Akkorde sind bereits in `CHORDS` vorhanden und werden von Progressions erzeugt, haben aber noch keine WAV-Fixture. Diese Liste sollte zuerst aufgenommen werden, weil sie ohne neue Griffdaten sofort testbar ist.

Umsetzungsstand 2026-04-23:

- Neue rohe WAVs sind unter `tests/fixtures/chords/<Akkord>/` einsortiert und im HPCP-Fixture-Katalog registriert.
- Alle 10 geplanten Prioritaet-0-Akkorde werden mit den rohen Fixtures ueber die Live-aehnliche Erkennungspipeline aktuell als Zielakkord akzeptiert; fuer `F7` und `G7` sind jetzt jeweils vier positive Takes vorhanden.
- Die frueher geloeschte Akkordaufnahme `tests/fixtures/chords/G7/g7_chord.wav` wurde aus der Git-Historie wiederhergestellt und als rohe Aufnahme `tests/fixtures/chords/G7/04.wav` erneut als positiver Testfall aufgenommen.
- Korrektur: Die WAV-Dateien selbst sollen rohe Mikrofonaufnahmen bleiben. Die Onset-/Pegel-/Mono-Vorverarbeitung wurde in die normale Erkennungs-/Testextraktionspipeline verlagert; der temporaere WAV-Cleanup-Skill wurde entfernt.
- Die zuvor ungeeignete Variante `G7/02-alt.wav` wurde durch die positiven Takes `G7/02.wav` und `G7/03.wav` ersetzt.

| Akkord | Tab | Empfohlene WAV |
| --- | --- | --- |
| A7 | `x 0 2 0 2 0` | `tests/fixtures/chords/A7/01.wav` |
| C-Moll | `x 3 5 5 4 3` | `tests/fixtures/chords/C-Moll/01.wav` |
| E7 | `0 2 0 1 0 0` | `tests/fixtures/chords/E7/01.wav` |
| F-Moll | `1 3 3 1 1 1` | `tests/fixtures/chords/F-Moll/01.wav` |
| F7 | `1 3 1 2 1 1` | `tests/fixtures/chords/F7/01.wav` |
| G-Moll | `3 5 5 3 3 3` | `tests/fixtures/chords/G-Moll/01.wav` |
| G7 | `3 2 0 0 0 1` | `tests/fixtures/chords/G7/01.wav` |
| H-Dur | `x 2 4 4 4 2` | `tests/fixtures/chords/H-Dur/01.wav` |
| H-Moll | `x 2 4 4 3 2` | `tests/fixtures/chords/H-Moll/01.wav` |
| H7 (B7) | `x 2 1 2 0 2` | `tests/fixtures/chords/H7 (B7)/01.wav` |

## Prioritaet 1: fehlende Akkorde fuer alle 12 Progressions-Tonarten ergaenzen

Diese Akkorde werden durch `MAJOR_KEYS`/`PROGRESSIONS` erzeugt, existieren aber noch nicht in `CHORDS`. Sie muessen zuerst in `akkordData.js` und `CHORD_META` ergaenzt werden; danach sollten WAV-Fixtures aufgenommen und in `tests/helpers/chordHpcpFixtureCatalog.js` registriert werden.

| Akkord | Vorgeschlagener Tab | Grund |
| --- | --- | --- |
| As-Dur | `4 6 6 5 4 4` | I/IV/V in As/Es/Des |
| As7 | `4 6 4 5 4 4` | 12-Bar-Blues in As/Des |
| B-Dur | `x 1 3 3 3 1` | I/IV/V in B/F/Es |
| B-Moll | `x 1 3 3 2 1` | ii/vi in As/Des |
| B7 | `x 1 3 1 3 1` | 12-Bar-Blues in B |
| Cis-Dur | `x 4 6 6 6 4` | V in Fis, enharmonische Kreuztonarten |
| Cis-Moll | `x 4 6 6 5 4` | ii/vi in H/E/A |
| Cis7 | `x 4 6 4 6 4` | 12-Bar-Blues in Fis |
| Des-Dur | `x 4 6 6 6 4` | I/IV/V in Des/As |
| Des7 | `x 4 6 4 6 4` | 12-Bar-Blues in Des |
| Dis-Moll | `x 6 8 8 7 6` | ii/vi in Fis/H |
| Es-Dur | `x 6 8 8 8 6` | I/IV/V in Es/B/As |
| Es-Moll | `x 6 8 8 7 6` | ii in Des |
| Es7 | `x 6 8 6 8 6` | 12-Bar-Blues in Es/As |
| Fis-Dur | `2 4 4 3 2 2` | I/IV/V in Fis/H/D |
| Fis-Moll | `2 4 4 2 2 2` | ii/vi in E/D/A |
| Fis7 | `2 4 2 3 2 2` | 12-Bar-Blues in Fis/H |
| Ges-Dur | `2 4 4 3 2 2` | I/IV/V in Ges/Des |
| Ges7 | `2 4 2 3 2 2` | 12-Bar-Blues in Ges/Des |
| Gis-Moll | `4 6 6 4 4 4` | ii/vi in Fis/E/H |

Hinweis: Einige Eintraege sind enharmonisch identisch (`Cis-Dur`/`Des-Dur`, `Fis-Dur`/`Ges-Dur`). Fuer UI und Progressions ist es trotzdem sinnvoll, beide Namen als Aliase zu fuehren, solange die Tonarten auch beide Namen erzeugen.

## Prioritaet 2: komplette bestehende Akkordliste als WAV-Fixtures abdecken

Diese Akkorde existieren bereits in `CHORDS`, haben aber noch keine WAV-Fixture. Sie sind wichtig fuer die Uebung `Akkord spielen`, weil der Zufallspool mehr als nur Progressions-Akkorde umfasst.

| Akkord | Tab | Empfohlene WAV |
| --- | --- | --- |
| A-Moll (2-Finger) | `x 0 2 2 0 0` | `tests/fixtures/chords/A-Moll (2-Finger)/01.wav` |
| Aadd9 | `x 0 2 4 2 0` | `tests/fixtures/chords/Aadd9/01.wav` |
| Adim | `x 0 1 2 1 x` | `tests/fixtures/chords/Adim/01.wav` |
| Am7 | `x 0 2 0 1 0` | `tests/fixtures/chords/Am7/01.wav` |
| Amaj7 | `x 0 2 1 2 0` | `tests/fixtures/chords/Amaj7/01.wav` |
| Asus2 | `x 0 2 2 0 0` | `tests/fixtures/chords/Asus2/01.wav` |
| Asus4 | `x 0 2 2 3 0` | `tests/fixtures/chords/Asus4/01.wav` |
| Cadd9 | `x 3 2 0 3 0` | `tests/fixtures/chords/Cadd9/01.wav` |
| Cdim | `x 3 4 5 4 x` | `tests/fixtures/chords/Cdim/01.wav` |
| Cm7 | `x 3 5 3 4 3` | `tests/fixtures/chords/Cm7/01.wav` |
| Cmaj7 | `x 3 2 0 0 0` | `tests/fixtures/chords/Cmaj7/01.wav` |
| Csus2 | `x 3 0 0 1 0` | `tests/fixtures/chords/Csus2/01.wav` |
| Csus4 | `x 3 3 0 1 0` | `tests/fixtures/chords/Csus4/01.wav` |
| Ddim | `x x 0 1 x 1` | `tests/fixtures/chords/Ddim/01.wav` |
| Dm7 | `x x 0 2 1 1` | `tests/fixtures/chords/Dm7/01.wav` |
| Dmaj7 | `x x 0 2 2 2` | `tests/fixtures/chords/Dmaj7/01.wav` |
| Dsus2 | `x x 0 2 3 0` | `tests/fixtures/chords/Dsus2/01.wav` |
| Dsus4 | `x x 0 2 3 3` | `tests/fixtures/chords/Dsus4/01.wav` |
| E-Moll (2-Finger) | `0 2 2 0 0 0` | `tests/fixtures/chords/E-Moll (2-Finger)/01.wav` |
| Eadd9 | `0 2 2 1 0 2` | `tests/fixtures/chords/Eadd9/01.wav` |
| Edim | `0 1 2 0 x x` | `tests/fixtures/chords/Edim/01.wav` |
| Em7 | `0 2 0 0 0 0` | `tests/fixtures/chords/Em7/01.wav` |
| Emaj7 | `0 2 1 1 0 0` | `tests/fixtures/chords/Emaj7/01.wav` |
| Esus2 | `0 2 2 4 0 0` | `tests/fixtures/chords/Esus2/01.wav` |
| Esus4 | `0 2 2 2 0 0` | `tests/fixtures/chords/Esus4/01.wav` |
| F-Dur (klein) | `x x 3 2 1 1` | `tests/fixtures/chords/F-Dur (klein)/01.wav` |
| Fdim | `1 2 3 1 x x` | `tests/fixtures/chords/Fdim/01.wav` |
| Fm7 | `1 3 1 1 1 1` | `tests/fixtures/chords/Fm7/01.wav` |
| Fmaj7 | `1 3 3 2 1 0` | `tests/fixtures/chords/Fmaj7/01.wav` |
| Fsus2 | `1 3 3 0 1 1` | `tests/fixtures/chords/Fsus2/01.wav` |
| Fsus4 | `1 3 3 3 1 1` | `tests/fixtures/chords/Fsus4/01.wav` |
| G-Dur (Rock) | `3 2 0 0 3 3` | `tests/fixtures/chords/G-Dur (Rock)/01.wav` |
| G7sus4 | `3 3 0 0 1 1` | `tests/fixtures/chords/G7sus4/01.wav` |
| Gadd9 | `3 2 0 2 0 3` | `tests/fixtures/chords/Gadd9/01.wav` |
| Gdim | `3 4 5 3 x x` | `tests/fixtures/chords/Gdim/01.wav` |
| Gm7 | `3 5 3 3 3 3` | `tests/fixtures/chords/Gm7/01.wav` |
| Gmaj7 | `3 2 0 0 0 2` | `tests/fixtures/chords/Gmaj7/01.wav` |
| Gsus2 | `3 0 0 2 3 3` | `tests/fixtures/chords/Gsus2/01.wav` |
| Gsus4 | `3 3 0 0 1 3` | `tests/fixtures/chords/Gsus4/01.wav` |
| H7sus4 | `x 2 2 2 0 0` | `tests/fixtures/chords/H7sus4/01.wav` |
| Hdim | `x 2 3 4 3 x` | `tests/fixtures/chords/Hdim/01.wav` |
| Hm7 | `x 2 4 2 3 2` | `tests/fixtures/chords/Hm7/01.wav` |
| Hmaj7 | `x 2 4 3 4 2` | `tests/fixtures/chords/Hmaj7/01.wav` |
| Hsus2 | `x 2 4 4 2 2` | `tests/fixtures/chords/Hsus2/01.wav` |
| Hsus4 | `x 2 4 4 5 2` | `tests/fixtures/chords/Hsus4/01.wav` |

## Akkorduebersicht: Filterstrategie

Aktueller Zustand:

- `ROOT_ORDER` und die HTML-Filter enthalten nur `A C D E F G H`.
- Innerhalb dieser sieben Wurzeln sind nur `D|Add`, `F|Add` und `H|Add` leer.
- `CHORD_META` enthaelt keine Kreuz-/b-Wurzeln wie `Fis`, `Cis`, `Es`, `B`, `As`.

Empfohlener Plan:

1. Kurzfristig leere Filterkombinationen verhindern: Filterbuttons deaktivieren oder ausblenden, wenn `getFilteredChords()` fuer diese Kombination leer waere.
2. Progressions-Wurzeln in der Uebersicht ergaenzen: mindestens `B`, `Es`, `As`, `Des`, `Fis`, `Ges`, `Cis`, `Gis`, `Dis`.
3. Alias-Policy definieren: Deutsche Namen in der UI beibehalten (`H` = B natural, `B` = Bb), aber interne Pitch-Class-Erkennung weiter ueber `GERMAN_TO_BIN` absichern.
4. Wenn alle sichtbaren Root/Type-Kombinationen Ergebnisse liefern sollen, entweder fehlende Akkorde tatsaechlich ergaenzen oder den Type-Filter pro Root dynamisch auf vorhandene Typen reduzieren.
5. Fuer die drei aktuell leeren Kombinationen entscheiden:
   - `D|Add`: entweder `Dadd9` ergaenzen oder `Add` bei Root `D` deaktivieren.
   - `F|Add`: entweder `Fadd9` ergaenzen oder `Add` bei Root `F` deaktivieren.
   - `H|Add`: entweder `Hadd9` ergaenzen oder `Add` bei Root `H` deaktivieren.

## Testfaelle nach den Aufnahmen

- Jede neue WAV in `tests/helpers/chordHpcpFixtureCatalog.js` als positiver Fall eintragen.
- Nach Ergaenzung der Griffdaten `buildChordTemplates()` automatisch alle neuen Akkorde abdecken lassen.
- Frozen-HPCP-Goldens fuer neue WAVs erzeugen und `tests/fixtures/chord-hpcp/frozen-hpcp-fixtures.json` aktualisieren.
- Fuer jeden neuen Akkord mindestens einen negativen Nachbarfall testen:
  - Dur vs Moll gleicher Wurzel, z. B. `Fis-Dur` darf nicht als `Fis-Moll` durchgehen.
  - Dom7 vs Dur gleicher Wurzel, z. B. `G7` darf nicht als `G-Dur` durchgehen, wenn die kleine Septime stark ist.
  - Enharmonische Aliase duerfen je nach Produktentscheidung gleich oder getrennt behandelt werden; das muss explizit getestet werden.
- Fuer Progressions eine Integritaetspruefung ergaenzen: Jede von `buildProgression()` und `generateRandomProgression()` erzeugte Akkordbezeichnung muss in `CHORDS` existieren.
- Fuer die Akkorduebersicht eine Filtermatrix testen: Jeder sichtbare Root-/Type-Button soll entweder mindestens ein Ergebnis liefern oder deaktiviert sein.

## Aufnahme-Richtlinie

- Pro Akkord mindestens zwei Takes aufnehmen: ein sauberer Downstroke und ein natuerlicher Strum mit leichtem Timing-Versatz.
- WAV konsistent halten: gleiche Gitarre, gleiche Stimmung, gleiche Mikrofonposition, keine Effekte, moeglichst wenig Raumanteil.
- Pro Take ca. 2 Sekunden klingen lassen; vorher und nachher kurze Stille lassen.
- Gemutete Saiten wirklich nicht anschlagen, weil die HPCP-Erkennung sonst falsche Pitch-Classes lernt.
- Barre-Akkorde sauber abdämpfen; bei Kreuz-/b-Akkorden lieber langsam und klar anschlagen als rhythmisch perfekt.
