# Fixture Drop Zone

Chord-Recorder-ZIPs hier in Git einchecken, dann Importskript ausführen.

## Workflow

```bash
# 1. ZIP(s) via GitHub in dieses Verzeichnis hochladen
# 2. git pull
# 3. Importieren:
node scripts/import-drop-fixtures.mjs
# 4. Chord-Catalog aktualisieren:
node scripts/introduce-chord-fixture.mjs
# 5. Tests prüfen:
npm test
# 6. Ergebnisse committen
```

## Was passiert

Das Skript entpackt jede ZIP, liest den JSON-Sidecar jeder Aufnahme und
verschiebt die WAV-Datei nach `tests/fixtures/chords/<chord>/`.  
Der Zielordner ergibt sich aus dem `chord`-Feld im JSON (z. B. `"G-Dur"` → `chords/G-Dur/`).  
Bei Namenskollisionen wird automatisch ein Suffix angehängt (`_2`, `_3`, …).  
Aufnahmen mit `quality.passed: false` werden importiert, aber mit Warnung markiert.  
Die ZIP wird nach erfolgreichem Import gelöscht.
