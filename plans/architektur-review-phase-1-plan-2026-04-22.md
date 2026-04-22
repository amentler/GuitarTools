# Phase 1 Detailplan: Architektur konsolidieren

Datum: 2026-04-22
Quelle: `plans/architektur-review-plan-2026-04-21.md`
Priorität: P1
Status: geplant

## Ziel von Phase 1

Phase 1 bereinigt die widersprüchliche Laufzeitarchitektur und legt einen verbindlichen Standard für den Start aller Übungen und Tools fest. Ziel ist nicht bereits die vollständige fachliche Entkopplung, sondern ein sauberer, einheitlicher Einstiegspunkt pro Seite als Grundlage für die späteren Phasen.

## Architekturentscheidung

Für `GuitarTools` wird als Zielarchitektur eine Multi-Page-App mit seitenlokalen Bootstrap-Dateien pro Seite festgelegt.

Das bedeutet konkret:

- `pages/` bleibt die Quelle für die einzelnen Seiten.
- Jede Seite erhält ein eigenes Verzeichnis unter `pages/`.
- In jedem Seitenverzeichnis liegen die seitenbezogenen Dateien zusammen, mindestens `index.html` und `bootstrap.js`.
- Bootstrap-Dateien importieren Komponenten und starten genau ein Feature oder Tool.
- Feature-Module exponieren eine einheitliche Lebenszyklus-Schnittstelle.
- Gemeinsame Logik liegt nicht in `pages/`, sondern z. B. unter `js/shared/`, `js/games/` oder `js/tools/`.
- Die bisherige Registry-/SPA-Idee wird in Phase 1 entfernt, sofern kein realer zentraler Router reaktiviert wird.

## Nicht-Ziele

- Noch keine größere Verschiebung von Fachlogik nach `js/domain/` oder `js/shared/`
- Noch keine Zerlegung der großen Controller
- Noch keine breite Naming-Bereinigung
- Noch keine tiefere Test-Neustrukturierung außerhalb der für Phase 1 nötigen Smoke-Absicherung

## Ist-Zustand

Die aktuelle Codebasis arbeitet faktisch bereits als Multi-Page-App, aber mit Altlasten aus einer SPA-/Registry-Idee:

- HTML-Seiten bootstrappen Features per Inline-`<script type="module">`.
- Viele Feature-Module registrieren sich zusätzlich über `registerExercise(...)`.
- `js/app.js` ist kein Composition Root für die Feature-Laufzeit.
- Exportmuster sind uneinheitlich:
  - oft `create...Exercise()` mit `startExercise()` und `stopExercise()`
  - in Einzelfällen direkter Export wie `startExercise()`

Betroffene zentrale Stellen im aktuellen Bestand:

- `js/exerciseRegistry.js`
- `js/app.js`
- `pages/exercises/*.html`
- `pages/tools/*.html`
- alle Feature-Einstiegsmodule unter `js/games/*/*.js` und `js/tools/*/*.js`

## Zielbild nach Phase 1

Nach Phase 1 gilt folgender Minimalstandard:

- Keine Inline-Bootstraps mehr in `pages/`
- Jede Seite liegt in einem eigenen Verzeichnis unter `pages/`
- Jedes Seitenverzeichnis enthält mindestens `index.html` und `bootstrap.js`
- Optional liegen seitennahe UI-Dateien wie `styles.css` oder `page.js` ebenfalls im selben Verzeichnis
- Ein Feature-/Tool-Modul liefert ein Objekt mit konsistenter API
- Die Seite startet nur über ihr lokales Bootstrap-Modul
- `exerciseRegistry` ist entfernt
- `js/app.js` bleibt auf Menü-/Startseitenverhalten begrenzt oder wird klar als Startseitenmodul eingegrenzt

## Standard-Schnittstelle

Für Phase 1 wird folgender gemeinsamer Vertrag eingeführt:

```js
{
  mount(root, deps?),
  unmount(),
  resume?(),
  suspend?()
}
```

Regeln dazu:

- `mount(root, deps?)` initialisiert DOM-Bindungen, Services und Startzustand.
- `unmount()` räumt Listener, Timer, Audio-Kontexte und laufende Prozesse auf.
- `root` ist das Root-Element der jeweiligen Seite oder Feature-Section.
- Bestehende interne Methoden wie `startExercise()` oder `stopExercise()` dürfen temporär intern weiterverwendet werden, aber nicht mehr die externe Standard-API bilden.
- Falls ein vollständiger Umbau eines Features in Phase 1 zu teuer ist, ist ein Adapter zulässig, der die alte API auf die neue Schnittstelle abbildet.

## Arbeitspakete

### AP1: Zielarchitektur formell festschreiben

Ziel:
Die Architekturentscheidung wird aus dem Review in einen verbindlichen Umsetzungsstandard übersetzt.

Aufgaben:

- Kurzbeschreibung der Zielarchitektur in `docs/architecture.md` oder gleichwertigem Dokument anlegen
- Begriffe festziehen:
  - Seite
  - Bootstrap
  - Feature
  - Tool
  - Root-Element
  - Lifecycle
- Abgrenzung dokumentieren:
  - `pages/` enthält seitenbezogene UI-Dateien und Startlogik pro Seite
  - `pages/<seite>/bootstrap.js` ist der Einstiegspunkt der Seite
  - gemeinsame Logik lebt außerhalb von `pages/`, z. B. unter `js/shared/`
  - Feature-Ordner enthalten Implementierung, aber keine Inline-Page-Starts

Ergebnis:

- Architekturstandard ist schriftlich festgelegt
- Folgeschritte in Phase 1 referenzieren dieselbe Terminologie

Abnahme:

- Ein neues Teammitglied kann aus dem Dokument erkennen, wie eine neue Seite korrekt eingebunden wird

### AP2: Seitenstruktur mit lokalem Bootstrap einführen

Ziel:
Alle Seiten starten über dedizierte Bootstrap-Dateien im jeweiligen Seitenverzeichnis statt über Inline-Skripte in HTML.

Neue Zielstruktur:

```text
pages/
  tonspielen/
    index.html
    bootstrap.js
    styles.css
  metronome/
    index.html
    bootstrap.js
js/
  shared/
  games/
  tools/
```

Aufgaben:

- Für jede bestehende Seite ein eigenes Verzeichnis unter `pages/` anlegen oder die bestehende Struktur dorthin migrieren
- Pro Seite mindestens `index.html` und `bootstrap.js` erzeugen
- Optional seitennahe Dateien wie `styles.css` oder `page.js` ins selbe Seitenverzeichnis legen
- In jedem Bootstrap-Modul:
  - gemeinsame Komponenten importieren
  - Root-Element der Seite auflösen
  - passendes Feature importieren
  - `mount(root)` aufrufen
- HTML-Seiten umstellen:
  - Inline-`<script type="module">` entfernen
  - stattdessen genau das lokale `bootstrap.js` referenzieren

Betroffene Seiten:

- `pages/akkord-trainer/`
- `pages/akkordfolgen-trainer/`
- `pages/chord-playing-essentia/`
- `pages/fretboard-tone-recognition/`
- `pages/note-playing/`
- `pages/sheet-music-mic/`
- `pages/sheet-music-reading/`
- `pages/ton-finder/`
- `pages/akkord-uebersicht/`
- `pages/guitar-tuner/`
- `pages/metronome/`

Ergebnis:

- HTML wird deklarativer
- Seitenbezogene UI-Dateien liegen zusammen
- Startlogik ist testbar und direkt an der Seite auffindbar
- Jede Seite hat genau einen technischen Einstiegspunkt

Abnahme:

- Keine Inline-Bootstraps mehr in `pages/`
- Jede Seite hat genau ein lokales `bootstrap.js`
- Alle Seiten starten weiterhin funktionsfähig

### AP3: Gemeinsame Feature-API einziehen

Ziel:
Die inkonsistenten Einstiegsmuster werden auf einen einheitlichen Lifecycle-Vertrag gebracht.

Aufgaben:

- Ziel-API für alle Features und Tools festlegen: `mount/unmount`
- Bestehende Einstiegsmodule anpassen oder mit Adaptern umhüllen
- Vorläufige Namensstrategie:
  - Fabriken werden auf `createFeature()` oder `createTool()` vereinheitlicht, falls ohne große Nebenwirkung möglich
  - falls nicht, wird ein dünner Adapter im selben Ordner angelegt

Empfohlene Übergangsstrategie:

- Phase 1 verändert nur die öffentliche Einstiegsschicht
- Interne Controller-Methoden wie `startExercise()` und `stopExercise()` bleiben vorerst zulässig
- Bootstrap-Dateien in `pages/*` sprechen ausschließlich mit der neuen API

Beispiel für Adapterrichtung:

```js
export function createNotePlayingFeature() {
  const legacy = createNotePlayingExercise();
  return {
    mount() {
      return legacy.startExercise();
    },
    unmount() {
      return legacy.stopExercise?.();
    },
  };
}
```

Ergebnis:

- Einheitlicher Start- und Stop-Vertrag
- Die seitenlokale Einstiegsschicht kennt keine historisch gewachsenen Sonderfälle

Abnahme:

- Kein Bootstrap ruft mehr direkt `startExercise()` auf
- Kein Bootstrap hängt an seitenindividuellen Sonder-Exports

### AP4: Registry-/SPA-Artefakte entfernen

Ziel:
Die widersprüchliche zweite Laufzeitstrategie verschwindet aus dem aktiven Codepfad.

Aufgaben:

- Alle Vorkommen von `registerExercise(...)` erfassen und entfernen
- Prüfen, ob `js/exerciseRegistry.js` noch produktiv benutzt wird
- `js/exerciseRegistry.js` löschen, wenn keine produktive Verwendung bleibt
- Kommentare und Dokumentation bereinigen, die auf `js/app.js` als zentrales Exercise-Routing verweisen
- `js/app.js` auf seine tatsächliche Rolle reduzieren:
  - Startseiten-/Menülogik
  - keine implizite Feature-Orchestrierung

Aktuell betroffene Module laut Review und Codebestand:

- `js/games/akkordTrainer/akkordTrainer.js`
- `js/games/akkordfolgenTrainer/akkordfolgenTrainer.js`
- `js/games/chordExerciseEssentia/chordExerciseEssentia.js`
- `js/games/fretboardToneRecognition/fretboardExercise.js`
- `js/games/notePlayingExercise/notePlayingExercise.js`
- `js/games/sheetMusicMic/sheetMusicMicExercise.js`
- `js/games/sheetMusicReading/sheetMusicReading.js`
- `js/games/tonFinder/tonFinder.js`
- `js/tools/akkordUebersicht/akkordUebersicht.js`
- `js/tools/guitarTuner/guitarTuner.js`
- `js/tools/metronome/metronome.js`

Ergebnis:

- Nur noch ein aktives Laufzeitmodell
- Weniger toter oder irreführender Architekturcode

Abnahme:

- `rg "registerExercise\\(" js` liefert keine produktiven Treffer mehr
- `js/exerciseRegistry.js` ist entfernt oder klar als ungenutzt ausgeschlossen

### AP5: Minimale Lifecycle-Regeln absichern

Ziel:
Mount und Unmount verhalten sich konsistent genug, um spätere Refactorings sicher tragen zu können.

Aufgaben:

- Für jedes migrierte Feature definieren:
  - welche Listener bei `mount()` gebunden werden
  - welche Listener, Timer und Audio-Ressourcen bei `unmount()` freigegeben werden
- Für Mikrofon-/Audio-Features explizit dokumentieren:
  - Stream stoppen
  - AudioContext schließen oder suspendieren
  - Analyse-Loops beenden
- Einfache Smoke-Tests oder manuelle Prüfcheckliste für Start/Stop pro Seite ergänzen

Mindestens kritisch für Phase 1:

- `js/tools/guitarTuner/guitarTuner.js`
- `js/games/notePlayingExercise/notePlayingExercise.js`
- `js/games/sheetMusicMic/sheetMusicMicExercise.js`
- `js/games/akkordfolgenTrainer/akkordfolgenTrainer.js`

Ergebnis:

- Die neue API ist nicht nur syntaktisch einheitlich, sondern räumt Ressourcen definiert auf

Abnahme:

- Keine bekannten hängenden Audio- oder Event-Reste beim Seitenwechsel oder erneuten Mount

## Reihenfolge der Umsetzung

1. Architekturstandard dokumentieren
2. Seitenverzeichnis-Muster mit lokalem Bootstrap festziehen
3. Zwei Referenzseiten exemplarisch migrieren
4. Feature-API-Adapter für alle übrigen Seiten einziehen
5. Alle Seiten auf lokales `bootstrap.js` umstellen
6. Registry und Altkommentare entfernen
7. Smoke-Checks und Lifecycle-Abnahme durchführen

## Empfohlene Referenzmigration

Diese Reihenfolge minimiert Risiko und schafft früh ein belastbares Muster:

1. `pages/note-playing/`
   - repräsentiert ein Mikrofon-Feature mit überschaubarer Größe
2. `pages/metronome/`
   - repräsentiert ein Nicht-Mikrofon-Tool mit einfacherem Lifecycle
3. danach restliche Exercises und Tools in Chargen

Begründung:

- Ein Audio-/Mikrofon-Fall deckt den komplexeren Lifecycle ab
- Ein einfacherer Tool-Fall validiert das Muster ohne Audio-Sonderfälle

## Risiken und Gegenmaßnahmen

### Risiko 1: Versteckte Seiteneffekte in `startExercise()`

Problem:
Bestehende Controller könnten stillschweigend auf globales DOM oder einmalige Initialisierung vertrauen.

Gegenmaßnahme:

- Adapter zuerst dünn halten
- Initiale Migration ohne tiefe interne Umbauten
- Referenzmigration mit zwei unterschiedlichen Feature-Typen durchführen

### Risiko 2: Fehlendes oder unvollständiges `stopExercise()`

Problem:
Einige Module könnten keinen vollständigen Teardown besitzen.

Gegenmaßnahme:

- Für Phase 1 je Feature Minimal-`unmount()` definieren
- Fehlende Cleanup-Punkte dokumentieren und als Anschlussarbeit für Phase 3 markieren

### Risiko 3: HTML-Seiten koppeln an implizite Script-Reihenfolge

Problem:
Komponentenregistrierung und Feature-Start könnten heute zufällig über Inline-Skripte korrekt erfolgen.

Gegenmaßnahme:

- In jedem seitenlokalen Bootstrap zuerst Komponenten importieren, dann Feature
- Für alle Seiten dasselbe Bootstrap-Schema verwenden

### Risiko 4: Umfang driftet in Phase 2 oder 3

Problem:
Beim Umbau der Einstiegsschicht könnten direkt fachliche Entkopplungen oder Controller-Schnitte mitgezogen werden.

Gegenmaßnahme:

- In Phase 1 nur Einstiegsschicht, API-Vereinheitlichung und Registry-Bereinigung umsetzen
- Größere interne Strukturänderungen explizit zurückstellen

## Definition of Done

Phase 1 ist abgeschlossen, wenn alle folgenden Punkte erfüllt sind:

- Zielarchitektur Multi-Page + seitenlokaler Bootstrap ist dokumentiert
- `pages/` enthält keine Inline-Bootstrap-Skripte mehr
- Jede Seite liegt in einem eigenen Verzeichnis unter `pages/`
- Jedes Seitenverzeichnis enthält mindestens `index.html` und `bootstrap.js`
- Alle Seiten starten über `mount(root, deps?)`
- Alle migrierten Features bieten `unmount()`
- `registerExercise(...)` ist aus produktivem Code entfernt
- `js/exerciseRegistry.js` ist entfernt oder endgültig außer Betrieb
- `js/app.js` enthält keine implizite Feature-Runtime
- Smoke-Prüfung für alle Seiten wurde durchgeführt

## Konkrete Deliverables

- neues Architektur-Dokument oder Abschnitt zur Zielarchitektur
- 11 Seitenverzeichnisse unter `pages/` mit lokalem Bootstrap
- 11 `bootstrap.js`-Dateien in den jeweiligen Seitenverzeichnissen
- angepasste `index.html`-Dateien ohne Inline-Bootstraps
- vereinheitlichte Einstiegsschicht in allen Feature-/Tool-Modulen
- Entfernung der Registry-Artefakte
- kurze Migrationsnotiz für Phase 2 und 3 mit offenen Lifecycle-Lücken

## Anschluss an Phase 2

Nach Abschluss von Phase 1 ist die Codebasis bereit für Phase 2, weil dann:

- die Einstiegsschicht eindeutig ist
- Features nicht mehr gleichzeitig an zwei Laufzeitmodelle gebunden sind
- Shared-/Domain-Extraktion auf einer stabilen Seiten- und Lifecycle-Struktur aufsetzen kann
