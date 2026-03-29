# js/spiele – Interaktive Übungen

Jede Datei hier implementiert eine eigenständige Übung (Spiel). Sie verwalten ihren eigenen State und
verdrahten alle DOM-Interaktionen. Hilfsfunktionen werden aus `../tools/` importiert.

## Schnittstelle einer Übung

Jedes Spiel exportiert mindestens:
```js
export function startExercise()  // State zurücksetzen, DOM aufbauen, Rendering starten
export function stopExercise()   // Laufende Timeouts bereinigen
```

`js/app.js` ruft diese Funktionen beim Navigieren zwischen Views auf.

## Dateien

### `fretboardExercise.js` – Griffbrett: Töne erkennen

Der Nutzer sieht einen markierten Punkt auf dem SVG-Griffbrett und muss den richtigen Ton aus
12 Tasten auswählen.

**State:**
| Feld | Typ | Beschreibung |
|---|---|---|
| `targetPosition` | `{ string, fret }` | Aktuelle Frageposition |
| `feedbackState` | `null \| 'correct' \| 'wrong'` | Aktueller Feedback-Zustand |
| `score` | `{ correct, total }` | Punktestand |
| `settings` | `{ maxFret, activeStrings[] }` | Spieleinstellungen (persistent über Neustarts) |
| `chancesLeft` | `1–3` | Verbleibende Versuche für aktuelle Position |
| `wrongAnswers` | `string[]` | Bereits falsch geratene Töne (werden deaktiviert) |

**Ablauf pro Frage:**
1. Zufällige Position innerhalb der aktiven Saiten und des eingestellten Bund-Bereichs
2. Nutzer klickt Ton-Button:
   - Richtig → grün, Score++, nach 1,2s nächste Position
   - Falsch, Chancen verbleibend → Button rot+disabled, Chancen-Punkt faded
   - Falsch, 0 Chancen → korrekte Note grün, alle falschen rot, nach 1,2s nächste Position
3. `advanceToNextPosition()` setzt State zurück (chancesLeft=3, wrongAnswers=[])

**Settings-Verdrahtung:** einmalig beim ersten `startExercise()`-Aufruf (`settingsWired`-Flag).
Einstellungsänderungen lösen immer sofort `resetAndAdvance()` aus.

## Neue Übung hinzufügen

1. Neue Datei `js/spiele/meinSpiel.js` anlegen mit `startExercise()` / `stopExercise()`
2. View-HTML in `index.html` ergänzen (`<section id="view-mein-spiel" class="view">`)
3. Navigation in `js/app.js` verdrahten (Button + `navigateTo`-Aufruf)
4. CLAUDE.md hier aktualisieren
