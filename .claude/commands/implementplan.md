---
description: Implementiert einen Plan aus plans/ (TDD) und verschiebt die Plandatei danach nach plans/old/.
---

Implementiere den folgenden Plan:

$ARGUMENTS

Wenn kein konkreter Dateiname angegeben wurde, liste die Dateien in `plans/` und wähle die passendste aus.

**Pflichtschritte – führe sie in dieser Reihenfolge aus:**

1. **Plan lesen** – lies die Plandatei vollständig. Halte dich exakt an die dort beschriebene Implementierungsreihenfolge und Teststrategie.

2. **TDD-Zyklus** – gehe testgetrieben vor:
   - Schreibe zuerst die neuen/angepassten Tests (sie müssen rot sein).
   - Implementiere dann die Funktionen, bis alle Tests grün sind.
   - Führe nach jedem Implementierungsschritt `npm test` aus und behebe Fehler sofort.

3. **Lint** – führe nach erfolgreichen Tests `npm run lint` aus und behebe alle Warnungen/Fehler.

4. **version.txt aktualisieren** – trage das aktuelle Datum und die Uhrzeit ein (Format: `Version YYYY-MM-DD HH:MM`).

5. **Plandatei archivieren** – verschiebe die verwendete Plandatei mit `mv plans/<name>.md plans/old/<name>.md` in den Archivordner. Lege `plans/old/` an, falls es noch nicht existiert.

6. **Abschlussbericht** – gib eine kurze Zusammenfassung aus:
   - Welche Dateien wurden geändert?
   - Wie viele Tests laufen jetzt (vorher / nachher)?
   - Pfad der archivierten Plandatei.
