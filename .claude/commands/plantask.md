---
description: Erarbeitet im Plan-Modus einen Implementierungsplan mit Testfällen und speichert ihn in plans/.
---

Erstelle einen vollständigen Implementierungsplan für folgende Aufgabe:

$ARGUMENTS

**Pflichtschritte – führe sie in dieser Reihenfolge aus:**

1. **Plan-Modus aktivieren** – wechsle mit `EnterPlanMode` in den Plan-Modus. Erforsche dort die relevanten Teile der Codebase (Explore-Agents, Read, Grep) und erarbeite den Plan vollständig, bevor du irgendwelche Änderungen machst.

2. **Plan ausarbeiten** – der Plan muss folgende Abschnitte enthalten:
   - **Kontext:** Warum wird die Änderung gemacht, was ist das Ziel?
   - **Betroffene Dateien:** Konkrete Dateipfade und was sich dort ändert.
   - **Neue Funktionen / Exports:** Signaturen, Parameter, Rückgabewerte.
   - **Teststrategie:** Welche Unit-Tests sind nötig (neue und angepasste)? Was ist *nicht* unit-testbar und warum? Konkrete Testfälle mit Eingabe/Erwartung angeben.
   - **TDD-Reihenfolge:** Tests zuerst schreiben (rot), dann implementieren (grün).
   - **Implementierungsreihenfolge:** Schritt-für-Schritt-Sequenz.

3. **Plan speichern** – wähle einen kurzen, beschreibenden Dateinamen und speichere den fertigen Plan unter `plans/<name>.md`. Kein neues Verzeichnis anlegen – direkt in `plans/`.

4. **Plan-Modus beenden** – rufe `ExitPlanMode` auf, sobald der Plan in `plans/` gespeichert ist.

5. **Dateiinhalt ausgeben** – lies die gespeicherte Datei und gib ihren vollständigen Inhalt aus.
