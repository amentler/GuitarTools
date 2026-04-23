---
name: introduce chord fixture
description: Sortiert neu hinzugekommene Chord-WAV-Fixtures in die bestehende Ordnerstruktur unter tests/fixtures/chords ein, aktualisiert den HPCP-Fixture-Katalog und erzeugt frozen/golden HPCP-JSON-Dateien. Verwenden, wenn neue Akkord-WAVs hinzugefügt wurden oder Chord-Fixtures konsistent nachgezogen werden sollen.
---

# Introduce Chord Fixture

## Zweck

Neue Chord-WAVs reproduzierbar ins Repository übernehmen:
- lose WAVs unter `tests/fixtures/chords/` in Akkord-Unterordner verschieben
- `tests/helpers/chordHpcpFixtureCatalog.js` deterministisch neu erzeugen
- `tests/fixtures/chord-hpcp/frozen-hpcp-fixtures.json` aus den aktuellen WAVs neu erzeugen
- relevante Tests zur Struktur und zu den Goldens ausführen

## Workflow

1. Prüfen, ob neue lose WAVs direkt unter `tests/fixtures/chords/` liegen.
2. Den Repo-Automationslauf starten:

```bash
npm run fixtures:chords:introduce
```

3. Danach die relevanten Tests ausführen:

```bash
npx vitest run tests/unit/priority0ChordFixtureCoverage.test.js tests/unit/essentiaChordExtractionSnapshot.test.js tests/unit/essentiaChordAudio.test.js tests/unit/essentiaChordCagedMatrix.test.js tests/unit/essentiaChordCagedStrictMatrix.test.js
```

## Regeln

- Lose positive Chord-WAVs gehören nicht dauerhaft direkt unter `tests/fixtures/chords/`.
- Die Negativfixtures `0_strum.wav` und `d_chord_wrong.wav` bleiben im Root von `tests/fixtures/chords/`.
- Der Katalog wird nicht per Hand gepflegt, sondern vom Skript neu geschrieben.
- Wenn ein lose hinzugefügter Dateiname keinem bekannten Akkordalias zugeordnet werden kann, den Lauf stoppen und die Alias-Tabelle in `scripts/introduce-chord-fixture.mjs` ergänzen.

## Hinweise

- Das Skript erhält bestehende Dateinamen und verschiebt nur den Speicherort.
- Positive Folder-Fixtures werden automatisch mit der aktuellen Matcher-Erwartung (`expected.isCorrect`) katalogisiert.
- Manuell gepflegte Negativfälle bleiben als explizite Katalogeinträge erhalten.
