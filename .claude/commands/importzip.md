---
description: Importiert neue Audio-Fixtures aus ZIP-Dateien in tests/fixtures/drop/. Verwenden wenn der Nutzer neue WAVs, neue Aufnahmen oder neues Audio importieren will, oder wenn ZIP-Dateien im Drop-Ordner liegen. Auch bei Text-Aufforderungen wie "importiere die ZIPs", "neues Audio einsortieren", "neue Waves übernehmen" o. ä.
---

## Workflow

### 1. ZIPs prüfen

```bash
ls tests/fixtures/drop/*.zip 2>/dev/null || echo "Keine ZIPs vorhanden"
```

Falls keine ZIPs vorhanden: Nutzer informieren und abbrechen.

### 2. ZIPs importieren

```bash
node scripts/import-drop-fixtures.mjs
```

WAVs landen in `tests/fixtures/chords/<chord>/`, ZIPs werden gelöscht.
Aufnahmen mit `quality.passed: false` werden importiert, aber im Output markiert.

### 3. Chord-Katalog aktualisieren

```bash
npm run fixtures:chords:introduce
```

### 4. Chord-Tests ausführen

```bash
npx vitest run tests/unit/priority0ChordFixtureCoverage.test.js tests/unit/essentiaChordExtractionSnapshot.test.js tests/unit/essentiaChordAudio.test.js tests/unit/essentiaChordCagedMatrix.test.js tests/unit/essentiaChordCagedStrictMatrix.test.js
```

### 5. Ergebnis berichten

Zusammenfassen: wie viele WAVs wurden in welche Akkord-Ordner importiert,
ob Tests bestanden, ob Aufnahmen mit `quality.passed: false` dabei waren.

## Regeln

- Schritt 3 und 4 nur ausführen, wenn Schritt 2 mindestens eine WAV importiert hat.
- Bei FEHLER in Schritt 2 (z. B. kein `chord`-Feld im JSON): Nutzer informieren, betroffene ZIP benennen, manuellen Eingriff vorschlagen.
- Nicht committen — das ist Aufgabe des Nutzers.
