# Plan: Vertikale Abstände in „Noten spielen“ schrittweise straffen

## Ziel
Die Übung `pages/exercises/note-playing.html` soll vertikal kompakter werden, ohne Lesbarkeit oder Bedienbarkeit zu verlieren.  
Fokus: Bereich unter „Spiele diesen Ton“, Notenname näher zur Zielnote, Weiter-Button in derselben Reihe wie Hilfen, weniger Leerraum nach der erkannten Note.

## Rahmen
- Noch **keine** Implementierung in diesem Schritt.
- Änderungen erfolgen in kleinen, testbaren Iterationen.
- Primärer Eingriffspunkt: `style.css` im Block `/* === Note Playing Exercise === */`.
- HTML nur anpassen, falls für Button-Ausrichtung notwendig (aktuell bereits in gleicher Hint-Row vorhanden).
- Wichtig: Vertikaler Platz über/unter dem Notensystem darf reduziert werden, aber nie so stark, dass hohe/tiefe Noten (inkl. Hilfslinien) visuell gequetscht oder abgeschnitten wirken.

## Schrittplan

1. Baseline erfassen
- Aktuelle Abstände dokumentieren (relevante CSS-Werte: `#view-note-play`, `.note-play-display`, `.note-play-target-note`, `.note-play-hints`, `.note-play-detected-notation`).
- Kurzen visuellen Vergleichspunkt festhalten (Desktop + Mobile), damit jede Teiländerung bewertet werden kann.

2. Oberen Bereich straffen (Überschrift/Prompt)
- Abstand im Container `#view-note-play` und in `.note-play-display` reduzieren.
- Falls nötig, den Prompt („Spiele diesen Ton:“) mit eigener Regel versehen, damit er weiter nach oben rückt und weniger Bottom-Space bekommt.
- Ziel: weniger „Luft“ zwischen Header und Notensystem.

3. Zielnote + Notenname enger zusammenführen
- Vertikalen Abstand zwischen `.note-play-notation` und `.note-play-target-note` reduzieren.
- `min-height`/line-height der `.note-play-target-note` prüfen und bei Bedarf verkleinern.
- Dabei gezielt Mindest-Headroom und Mindest-Fußraum am Notensystem belassen (für Extremnoten).
- Ziel: Notenname wirkt als direkte Zuordnung zur angezeigten Note.

4. Button-Zeile konsolidieren (Hilfen + Weiter)
- Sicherstellen, dass `#note-play-skip` im selben Flow wie `.note-play-hints` bleibt (eine gemeinsame Reihe, mit sauberem Wrap auf kleineren Breiten).
- Bei Bedarf Button-spezifische Klassen ergänzen statt global `btn-mode` zu verbiegen.
- Ziel: „Weiter“ ist visuell Teil der Hilfsaktionen.

5. Unteren Bereich straffen (erkannte Note)
- Abstand von `.note-play-detected-label` und `.note-play-detected-notation` nach unten reduzieren.
- Unnötigen Bottom-Raum bis zum Ende von `.note-play-display` entfernen.
- Ziel: kompakter Abschluss ohne gequetscht zu wirken.

6. Feintuning für Mobile
- Auf kleinen Viewports prüfen, ob Wrap/Zeilenumbrüche bei den drei Buttons sauber bleiben.
- Bei Bedarf media-query-spezifisch minimale Gap-Anpassung.

7. Abnahme
- Prüfen: gewünschte 5 Punkte sind sichtbar verbessert.
- Sicherstellen: keine Regression bei Interaktion (Hint 1/2, Weiter, Feedback, Score/Header).
- Danach erst Commit mit klarer Message.

## Akzeptanzkriterien
- Unter „Spiele diesen Ton“ ist sichtbar weniger vertikaler Leerraum.
- Die Überschrift/Prompt sitzt höher und hat weniger Abstand nach unten.
- Der angezeigte Notenname steht näher an der Zielnote.
- Der Weiter-Button ist in derselben Button-Reihe wie die Hilfen.
- Unter der Anzeige der erkannten Note ist weniger Abstand bis zum unteren Rand.
- Hohe/tiefe Noten inklusive Hilfslinien haben weiterhin ausreichend Raum über/unter den Linien und werden nicht abgeschnitten.
