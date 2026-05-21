---
description: Aktualisiert den Graphify-Wissensgraphen und ermöglicht graph-basierte Abfragen.
---

Führe Graphify-Operationen für das GuitarTools-Repo aus.

$ARGUMENTS

**Wenn kein konkretes Argument übergeben wurde:**

1. Prüfe ob der Graph aktuell ist:
   ```
   git rev-parse HEAD
   ```
   Vergleiche mit dem Commit in `graphify-out/GRAPH_REPORT.md`. Falls veraltet:

2. Aktualisiere den Graph:
   ```
   graphify update .
   ```

3. Zeige eine kurze Zusammenfassung aus `graphify-out/GRAPH_REPORT.md` (God-Nodes, Community-Count).

**Wenn ein Suchbegriff oder eine Frage übergeben wurde:**

Verwende folgende Graphify-Befehle je nach Fragetyp:

- **"Was macht X?"** → `graphify explain "<X>"`
- **"Wie hängen A und B zusammen?"** → `graphify path "<A>" "<B>"`
- **"Zeige alle Abhängigkeiten von X"** → `graphify query "dependencies of <X>"`
- **Allgemeine Frage** → `graphify query "<Frage>"`

**Regeln:**
- Lies immer zuerst `graphify-out/GRAPH_REPORT.md` bevor du Quell-Dateien öffnest
- Nutze den Graph für Architektur-Fragen statt grep/glob
- Nach Code-Änderungen immer `graphify update .` ausführen
