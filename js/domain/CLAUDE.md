# js/domain — Domain Logic Layer

Dieses Verzeichnis enthält die domänenfachlichen Kernlogiken als reine Funktionen ohne Seiteneffekte.

## Struktur

```
js/domain/
├── chords/
│   ├── chordCatalog.js          – Alle 35 Akkord-Definitionen (SSOT-Wrapper auf akkordData.js)
│   ├── chordDetectionLogic.js   – Akkord-Erkennungsalgorithmen (Score-basiert)
│   └── chordFretboardMapping.js – Mapping: Akkord-String ↔ Griffbrett-Index
├── fretboard/
│   └── fretboardLogic.js        – Noten auf Griffbrettposition (kanonische Version)
└── pitch/
    └── pitchCore.js             – Kernalgorithmen: MIDI, Frequenz, Notennamen
```

## Konventionen

- **Reine Funktionen:** Keine DOM-Zugriffe, keine imports aus `js/shared/`, `js/games/`, `js/tools/`
- **Single Source of Truth:** `chordCatalog.js` re-exportiert aus `js/data/akkordData.js` — niemals direkt `akkordData.js` aus Domain importieren
- **100 % Unit-Test-Abdeckung** ist das Ziel für alle `*Logic.js` und `*Core.js` Dateien
- **Architektur-Grenzwächter:** `tests/unit/architectureBoundaryGuards.test.js` prüft maschinell, dass Domain-Module keine Shared-/Game-Imports enthalten

## Abhängigkeiten (erlaubt)

- `js/data/` — Nur Datendateien (akkordData.js, keine Module)
- Andere Domain-Module untereinander

## Abhängigkeiten (verboten)

- `js/shared/` — Shared-Services sind Infrastruktur, nicht Domäne
- `js/games/`, `js/tools/`, `js/components/` — Controller/UI-Layer
- DOM-APIs, `window`, `document`
