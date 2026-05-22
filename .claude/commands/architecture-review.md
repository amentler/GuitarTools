---
description: GuitarTools Architecture Review: LOC-Grenzen prüfen, Layer-Verstöße finden, Verbesserungen vorschlagen. Verwenden wenn der Nutzer "architecture-review" schreibt oder die Architektur analysieren will.
---

Führe einen vollständigen Architektur-Review für das GuitarTools-Repo durch.

## Aufgaben

### 1. LOC-Audit (File Size Limits)

Prüfe alle Controller-Dateien auf LOC-Überschreitungen:

```bash
wc -l js/games/**/*.js js/tools/**/*.js | sort -rn | head -20
```

Schwellenwerte laut `docs/architecture.md` und `AGENTS.md`:
- Controller/Feature-Module: < 300 Zeilen (Policy); 800 Zeilen (Harter Grenzwert via Test)
- Logic-Module (`*Logic.js`): < 150 Zeilen (Policy)

Dateien über 300 Zeilen → in `plans/architecture-refactoring.md` als neue Phase eintragen.

### 2. Layer-Verletzungen prüfen

Prüfe ob Logic-Module UI-Code importieren (DOM-Manipulation, innerHTML, document.*):

```bash
grep -rn "document\.\|innerHTML\|createElement\|querySelector" js/domain/ js/games/*Logic.js js/tools/*Logic.js 2>/dev/null
```

Logic-Module dürfen KEIN DOM manipulieren. Verstöße melden.

### 3. Ungekoppelte Module identifizieren

```bash
graphify query "welche Module haben keine Imports und keine Importeure?"
```

### 4. Architektur-Report erstellen

Ausgabe als kompakte Tabelle:

| Datei | Zeilen | Status | Empfehlung |
|-------|--------|--------|------------|
| ...   | ...    | ✅/⚠️/🔴 | ...       |

- ✅ = Innerhalb der Policy (<300 Zeilen)
- ⚠️ = Überschreitet Policy (300–800 Zeilen) → Split empfohlen
- 🔴 = Überschreitet Hard Cap (>800 Zeilen) → Split erforderlich

### 5. Maßnahmen vorschlagen

Für jede ⚠️/🔴-Datei:
- Sinnvolle Split-Grenze bestimmen (Rendering/Audio/State)
- Neue Phase in `plans/architecture-refactoring.md` vorschlagen

## Referenz-Dateien

- `docs/architecture.md` — Layer-Modell und Coding Standards
- `plans/architecture-refactoring.md` — Aktueller Refactoring-Stand
- `AGENTS.md` Section 2 — File Size Limit Konvention
