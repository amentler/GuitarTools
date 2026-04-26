# Phase 4: Shared Controls Extraction

Datum: 2026-04-25
Bezug: [GEMINI.md](../../GEMINI.md) (Phase  roll-out), [plans/architektur-review-plan-2026-04-21.md](../architektur-review-plan-2026-04-21.md)
Status: In Planung

## Ziel

Phase 4 extrahiert wiederkehrende UI-Bedienelemente in Web Components, um Redundanz in HTML und JS-Controllern zu reduzieren. Der Fokus liegt auf den Einstellungs-Panels, die in fast allen Übungen vorkommen.

Die Phase zielt darauf ab:
1. Den HTML-Boilerplate pro Übung zu senken.
2. Die JS-Wiring-Logik (`wireStringToggles`, `wireFretSlider`) durch deklarative Komponenten zu ersetzen.
3. Ein einheitliches Look-and-Feel für Einstellungen sicherzustellen.

## Aktuelle Duplikate

Fast alle Übungen (`tonFinder`, `fretboardToneRecognition`, `sheetMusicMic`, `notePlaying`, `akkordTrainer`) enthalten:
- **Saiten-Auswahl:** 6 Buttons (E, A, D, G, B, e).
- **Bund-Bereich:** Ein Range-Slider mit Label (0 – X).
- **Settings-Panel:** Ein Container für diese Zeilen.

## Neue Komponenten

### 1. `<gt-string-selector>`
- **Zustand:** `activeStrings` (Array von 0-5).
- **Attribute:** `active-strings` (String, z.B. "0,1,2,3,4,5").
- **Events:** `change` -> `{ activeStrings }`.
- **UI:** Rendert die 6 Buttons mit korrekter Beschriftung und Aktiv-Status.

### 2. `<gt-fret-slider>`
- **Zustand:** `maxFret` (Zahl).
- **Attribute:** `value` (Zahl), `min` (default 0), `max` (default 12), `label` (default "Bünde").
- **Events:** `change` -> `{ value }`.
- **UI:** Rendert Label (mit Formatierung "0 – X") und Slider.

### 3. `<gt-settings-container>` (Optional)
- Ein einfacher Wrapper für `<div class="settings-panel">`, um Styles zu zentralisieren.

## Vorgehen

### 4A: Komponenten-Implementierung
1. `js/components/gt-string-selector.js` erstellen.
2. `js/components/gt-fret-slider.js` erstellen.
3. In `js/components/index.js` registrieren.
4. Unit-Tests für die Komponenten-Logik (Attribut-Synchronisation, Event-Firing) erstellen.

### 4B: Migration Ton-Finder
1. `pages/ton-finder/index.html` auf neue Komponenten umstellen.
2. `js/games/tonFinder/tonFinder.js` anpassen (Events statt `wire...`).
3. Verifizieren.

### 4C: Migration Fretboard Tone Recognition
1. `pages/fretboard-tone-recognition/index.html` umstellen.
2. `js/games/fretboardToneRecognition/fretboardExercise.js` anpassen.
3. Verifizieren.

### 4D: Migration weiterer Übungen
- `sheetMusicMic`, `notePlaying`, `akkordTrainer`, `chordExerciseEssentia`.

## Akzeptanzkriterien

- `js/utils/settings.js` kann gelöscht oder deutlich reduziert werden (wenn alle Features migriert sind).
- Die HTML-Dateien der Übungen sind kürzer und nutzen `<gt-string-selector>` und `<gt-fret-slider>`.
- Die Controller-Logik für Einstellungen beschränkt sich auf das Lauschen auf Events der Komponenten.
- Das visuelle Erscheinungsbild bleibt konsistent oder verbessert sich durch Zentralisierung der Styles.

## Risiken

- **Styling-Kollisionen:** Komponenten-internes Styling vs. globales CSS (`style.css`). Bevorzugung von globalen Klassen für Konsistenz.
- **State-Synchronisation:** Sicherstellen, dass Attribute und JS-Properties synchron bleiben.
