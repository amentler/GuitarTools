# Sequence Fixture Drop Zone

ZIP-Dateien mit neuen Notensequenzen hier ablegen. Dieser Ordner ist nur die
Eingangszone. Importierte Sequenzen sollen spaeter als stabile Testfixtures nach
`tests/fixtures/sequences/<category>/` ueberfuehrt werden.

## Erwartete ZIP-Struktur

Eine ZIP darf eine oder mehrere Sequenzen enthalten. Jede Sequenz besteht aus:

- genau einer WAV-Datei
- genau einem JSON-Manifest mit gleichem Basisnamen

Beispiel:

```text
my-open-string-run.zip
  open_strings_take_01.wav
  open_strings_take_01.json
  open_strings_take_02.wav
  open_strings_take_02.json
```

Unterordner in der ZIP sind erlaubt, werden beim Import aber nur zur
Organisation gelesen. Der Zielordner wird nicht aus dem ZIP-Pfad, sondern aus
dem Manifest-Feld `category` bestimmt.

## Ziel nach dem Import

Nach der Umwandlung soll jede Sequenz als Paar aus WAV und Manifest hier liegen:

```text
tests/fixtures/sequences/<category>/<name>.wav
tests/fixtures/sequences/<category>/<name>.json
```

Beispiel:

```text
tests/fixtures/sequences/open-strings/open_strings_take_01.wav
tests/fixtures/sequences/open-strings/open_strings_take_01.json
```

Bei Namenskollisionen muss der Importer einen stabilen Suffix anhaengen, z. B.
`_2`, `_3`, damit keine vorhandenen Fixtures ueberschrieben werden.

## Gueltiges Manifest-Format

Das Manifest ist eine JSON-Datei. Minimal erforderlich:

```json
{
  "category": "open-strings",
  "notes": ["E2", "A2", "D3", "G3"],
  "tempoBpm": 90,
  "notesPerBeat": 1,
  "description": "Kurze offene-Saiten-Sequenz, eine Note pro Beat"
}
```

Pflichtfelder:

- `category`: Ziel-Unterordner unter `tests/fixtures/sequences/`.
  Erlaubt sind kleingeschriebene Ordnernamen mit Buchstaben, Zahlen und
  Bindestrichen, z. B. `open-strings`, `fretted-notes`, `mixed-sequences`.
- `notes`: Erwartete Notenfolge als Array. Jede Note muss eine Pitch-Klasse und
  Oktave enthalten, z. B. `E2`, `A2`, `D3`, `G3`, `B3`, `E4`, `C#4`.
  Oktaven sind zwingend, weil der Fingerprint gegen konkrete Ziel-Pitches
  testet.

Empfohlene Felder:

- `tempoBpm`: Tempo der Aufnahme als Zahl.
- `notesPerBeat`: Anzahl gespielter Noten pro Beat als Zahl. Fuer Viertelnoten
  `1`, fuer Achtelnoten `2`.
- `description`: Kurzer menschlicher Kontext zur Aufnahme.

Tempo-Hinweis: `tempoBpm`, `bpm` und `notesPerBeat` sind nur Metadaten zur
Aufnahme. Echte Takes koennen langsamer, schneller oder ungleichmaessig
gespielt sein. Sheet-Fingerprint-Tests duerfen daraus keine exakten
Notenzeitpunkte ableiten.

Optionale Felder:

- `source`: Freitext zur Herkunft, z. B. Gitarre, Mikrofon, Take-Name.
- `expectedMode`: Erwarteter Testmodus. Derzeit sinnvoll: `sheetfingerprint`.
- `knownLimitations`: Array mit kurzen Hinweisen, wenn eine Aufnahme bewusst
  schwierig ist, z. B. Legato, Nebengeraeusche oder sehr schnelles Tempo.

Beispiel mit optionalen Feldern:

```json
{
  "category": "mixed-sequences",
  "notes": ["A2", "E2", "A2", "E2", "D3", "G3", "D3", "G3"],
  "tempoBpm": 120,
  "notesPerBeat": 2,
  "description": "Legato-Sequenz mit offenen und gegriffenen Noten",
  "source": "Akustikgitarre, Laptop-Mikrofon, Take 03",
  "expectedMode": "sheetfingerprint",
  "knownLimitations": ["legato", "fast-tempo"]
}
```

## Umwandlung in Testfaelle

Der spaetere Importer soll fuer jede ZIP:

1. ZIP entpacken und alle WAV/JSON-Paare finden.
2. Manifest validieren.
3. WAV-Datei mit dem lokalen WAV-Decoder pruefen.
4. Sequenz nach `tests/fixtures/sequences/<category>/` kopieren oder verschieben.
5. Manifest neben der WAV ablegen.
6. `npm run sheetfingerprint` ausfuehren und den Report pruefen.
7. Nur vollstaendig erkannte Positiv-Fixtures in die schnelle Positivliste des
   Sheet-Fingerprints aufnehmen.

Wichtig: Der Unit-/Audio-Test darf nicht auf eine kuenstlich verkleinerte
Pipeline umgestellt werden. Die Fixtures sollen moeglichst nah am echten
Sheet-Music-Live-Audio-Pfad bleiben, damit Playwright- und Unit-Ergebnisse
nicht auseinanderlaufen.
