---
description: Zeigt eine LOC-Tabelle aller Controller-Dateien und warnt bei Überschreitung des 400-LOC-Limits.
---

Führe einen schnellen Architektur-Check aus: LOC-Tabelle aller Controller-/Tool-Dateien + Warnungen.

**Schritte:**

1. Zähle die Zeilen aller JS-Dateien in `js/games/*/` und `js/tools/*/` (direkte Dateien, keine Subdirs):
   ```bash
   wc -l $(find js/games js/tools -maxdepth 2 -name "*.js" | sort) | sort -rn | head -30
   ```

2. Erstelle eine Tabelle:
   | Datei | LOC | Status |
   |-------|-----|--------|
   Markiere Dateien > 400 LOC mit ⚠️, Dateien > 700 LOC mit 🔴.

3. Prüfe den Status der offenen Refactoring-Phasen aus `plans/architecture-refactoring.md`:
   - Lies die Status-Felder (ERLEDIGT / OFFEN) und zeige eine kompakte Übersicht.

4. Empfehle die nächste Refactoring-Phase (erste Phase mit Status OFFEN).

**Grenzwerte:**
- ✅ ≤ 400 LOC: OK
- ⚠️ 401–700 LOC: Refactoring empfohlen
- 🔴 > 700 LOC: Refactoring dringend (über Plan dokumentieren)
