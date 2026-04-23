# Archiv: Akkord-Testabdeckung - Prioritaet 0

Quelle: `plans/akkord-testabdeckung-vervollstaendigung-2026-04-23.md`
Archiviert: 2026-04-23
Grund: Prioritaet 0 wurde umgesetzt und verifiziert; Prioritaet 1/2 bleiben im aktiven Plan.

## Erledigter Abschnitt

### Prioritaet 0: vorhandene Progressions-Akkorde einspielen

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
