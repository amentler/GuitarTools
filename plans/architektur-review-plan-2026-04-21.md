# Architektur- und Designreview

Datum: 2026-04-21
Projekt: `GuitarTools`
Umfang: Review von Struktur, Modulgrenzen, SOLID, Wiederverwendung, Konventionen, Testbarkeit und Betriebsaspekten.

## Bewertungsrahmen

Die Review wurde entlang dieser Themen und Kriterien durchgeführt:

1. Zielarchitektur und Composition Root
   - Gibt es einen klaren Einstiegspunkt?
   - Gibt es nur eine aktive Bootstrapping-Strategie?
   - Sind Routing, Initialisierung und Lebenszyklus konsistent?

2. Modularisierung und Abhängigkeitsrichtung
   - Zeigen Abhängigkeiten von außen nach innen statt umgekehrt?
   - Sind `components`, `games`, `tools`, `utils`, `data` sauber getrennt?
   - Werden fachliche Kernbausteine in neutralen Modulen gehalten?

3. SOLID
   - Single Responsibility: mischen Controller DOM, State, Audio, Persistenz und Rendering?
   - Open/Closed: lassen sich neue Übungen ohne Copy/Paste ergänzen?
   - Dependency Inversion: hängen UI-Bausteine an Feature-Code oder an stabile Abstraktionen?

4. UI-Architektur
   - Gibt es wiederverwendbare Komponenten statt DOM-Zugriff pro Feature?
   - Werden Event-Listener und globale Events sauber verwaltet?
   - Ist das Bootstrapping in HTML und JS konsistent?

5. Audio- und Infrastruktur-Services
   - Ist Mikrofon-/AudioContext-Lifecycle zentralisiert?
   - Sind Persistenz und Browser-APIs gekapselt?
   - Sind PWA- und Caching-Aspekte wartbar organisiert?

6. Code Conventions und Konsistenz
   - Einheitliche Benennung, Exportmuster und Dateistruktur
   - Einheitliche Sprache in APIs und Modulen
   - Begrenzung von Dateigröße und Verantwortungsumfang

7. Testbarkeit und Qualitätsprozess
   - Gute Trennung von Pure Logic und IO
   - Sinnvolle Testabdeckung der kritischen Schichten
   - Stabiler und schneller CI-Lauf

## Ergebnisübersicht

Gesamtbild:
Die Codebasis ist funktional, bereits testorientierter als viele kleine Browserprojekte und enthält gute Ansätze wie Pure-Logic-Module, Web Components und eine saubere Trennung einzelner Feature-Ordner. Die Architektur ist aber historisch gewachsen und momentan nicht konsequent vereinheitlicht. Die größten Probleme sind doppelte Laufzeitmodelle, Schichtverletzungen zwischen Features und sehr große Controller mit vermischten Verantwortlichkeiten.

Stärken:

- Pure-Logic-Module existieren und sind oft gut testbar, z. B. `sheetMusicLogic`, `pitchLogic`, `fastNoteMatcher`, `fretboardLogic`.
- Tests und Linting sind grundsätzlich vorhanden, CI ist eingerichtet.
- Wiederverwendung wurde punktuell schon verbessert, z. B. `js/utils/settings.js`.
- Datenhaltung für Akkorde ist zentralisiert in `js/data/akkordData.js`.

## Abgearbeitete Themen

### 1. Zielarchitektur und Composition Root

Bewertung: kritisch

Befunde:

- Es existieren zwei konkurrierende Architekturen:
  - Eine Registry-/SPA-Idee über `js/exerciseRegistry.js`
  - Eine echte Multi-Page-Initialisierung über Inline-Bootstrapping in jeder HTML-Seite
- `registerExercise(...)` wird in fast allen Modulen verwendet, aber die Seiten instanziieren ihre Übungen direkt selbst.
- `js/app.js` ist sehr klein und übernimmt faktisch nur Versionsanzeige und Menüinitialisierung, nicht aber die zentrale Laufzeitsteuerung.

Belege:

- `js/exerciseRegistry.js`
- `js/games/notePlayingExercise/notePlayingExercise.js:342`
- `js/games/sheetMusicReading/sheetMusicReading.js:393`
- `js/tools/metronome/metronome.js:120`
- `pages/exercises/note-playing.html:62`
- `pages/exercises/sheet-music-reading.html`

Konsequenz:

- Unklare Zielarchitektur erschwert Erweiterungen.
- Neue Features können nicht erkennen, ob sie sich registrieren, direkt bootstrappen oder beides sollen.
- Toter oder halbgenutzter Architekturcode erhöht kognitive Last.

Optimierung:

- Entscheidung treffen: entweder echte Multi-Page-App oder echte zentrale SPA-Runtime.
- Nicht gewählte Architektur konsequent entfernen.
- Einen expliziten Composition Root einführen, z. B. `bootstrapPage({ componentRegistry, exerciseFactory, lifecycle })`.
- Inline-Module in HTML durch dedizierte Bootstrap-Dateien ersetzen.

### 2. Modularisierung und Abhängigkeitsrichtung

Bewertung: kritisch

Befunde:

- `components` hängt an `games`, obwohl Komponenten die stabilere äußere Schicht sein sollten.
- Tools und Features importieren gegenseitig konkrete Implementierungen statt neutrale Kernlogik.
- Domänenlogik liegt teilweise in Feature-Ordnern und wird projektweit wiederverwendet.

Belege:

- `js/components/fretboard/gt-fretboard.js:2`
  - Die generische Komponente importiert `getNoteAtPosition` aus `games/fretboardToneRecognition/fretboardLogic.js`.
- `js/games/tonFinder/tonFinderLogic.js:1`
  - Fachlogik hängt an `fretboardToneRecognition`.
- `js/tools/akkordUebersicht/akkordUebersicht.js:3`
  - Tool hängt an `games/akkordTrainer/akkordSVG.js`.
- `js/games/sheetMusicReading/playbackController.js:16`
  - Notenübung hängt direkt an `tools/metronome/metronomeLogic.js`.
- `js/games/sheetMusicMic/fastNoteMatcher.js:43`
  - Feature-spezifische Matcher-Logik hängt an Tuner-Implementierung.

Konsequenz:

- Feature-Ordner sind keine klaren Grenzen, sondern werden de facto zu Shared Libraries.
- Refactorings in einem Feature können andere Features oder Komponenten brechen.
- Verletzung von Dependency Inversion und teilweise auch von Stable Dependencies.

Optimierung:

- Gemeinsame Domänenbausteine in neutrale Schichten ziehen:
  - `js/domain/fretboard/*`
  - `js/domain/audio/*`
  - `js/domain/chords/*`
  - `js/shared/rendering/*`
- Regel definieren:
  - `components` darf nicht aus `games` oder `tools` importieren
  - `tools` und `games` dürfen nur auf `domain`, `shared`, `data`, `components` zugreifen
- Import-Lint-Regeln für unerlaubte Schichtzugriffe ergänzen.

### 3. SOLID: Single Responsibility

Bewertung: hoch kritisch

Befunde:

- Mehrere Controller bündeln zu viele Aufgaben:
  - DOM-Resolution
  - State-Mutation
  - Event-Wiring
  - Browser-Persistenz
  - Audio-Lifecycle
  - Business-Regeln
  - Rendering-Trigger
- Besonders groß und risikoreich:
  - `js/games/akkordfolgenTrainer/akkordfolgenTrainer.js` mit 510 Zeilen
  - `js/tools/guitarTuner/guitarTuner.js` mit 487 Zeilen
  - `js/games/sheetMusicMic/sheetMusicMicExercise.js` mit 453 Zeilen
  - `js/games/sheetMusicReading/sheetMusicReading.js` mit 400 Zeilen
  - `js/games/notePlayingExercise/notePlayingExercise.js` mit 348 Zeilen

Beispiele:

- `js/games/sheetMusicReading/sheetMusicReading.js:23-387`
  - Enthält State, LocalStorage, Event-Wiring, Playback-Steuerung, Endless-Mode, DOM-Updates, globale Keyboard-Events.
- `js/tools/guitarTuner/guitarTuner.js:64-233`
  - Enthält UI-Reset, Audio-Aufbau, Modusverwaltung, Guided-Tuning-Flow und Analyse-Loop.
- `js/games/notePlayingExercise/notePlayingExercise.js:67-220`
  - Mischt UI-Aufbau, Mikrofonzugriff, Spielzustand und Analyse-Steuerung.

Konsequenz:

- Änderungen sind fehleranfällig.
- Reuse ist erschwert.
- Tests bleiben auf Pure-Logic-Inseln konzentriert, während Controller schwerer zu verifizieren sind.

Optimierung:

- Pro großem Feature Controller in kleinere Bausteine zerlegen:
  - `state`
  - `storage`
  - `audioSession`
  - `uiAdapter`
  - `presenter/rendering`
  - `featureController`
- Zielgröße festlegen:
  - Controller typischerweise < 200-250 Zeilen
  - reine Logik bevorzugt < 150 Zeilen
- Explizite Teardown-Verantwortung pro Feature definieren.

### 4. SOLID: Open/Closed und Erweiterbarkeit

Bewertung: mittel

Befunde:

- Neue Übungen folgen zwar häufig ähnlichen Mustern, aber die Muster sind nicht formalisiert.
- Wiederkehrende Bootstraps, DOM-Resolution und Audio-Initialisierung werden pro Feature neu gebaut.
- `create...Exercise()` ist verbreitet, aber nicht durch eine gemeinsame Feature-Schnittstelle abgesichert.

Konsequenz:

- Neue Features entstehen wahrscheinlich per Copy/Paste statt durch definierte Extension Points.

Optimierung:

- Standardvertrag für Übungen und Tools einführen:
  - `mount(root, deps)`
  - `unmount()`
  - `resume()` optional
  - `suspend()` optional
- Gemeinsame Basiskonzepte definieren:
  - `MicrophoneFeatureController`
  - `SettingsPanelController`
  - `ScorePresenter`

### 5. UI-Architektur und DOM-Zugriff

Bewertung: hoch

Befunde:

- Sehr viele direkte `document.getElementById(...)`- und `querySelectorAll(...)`-Zugriffe in Feature-Controllern.
- Page-Bootstrapping ist als Inline-Script dupliziert.
- Es gibt globale Listener auf `document`, die zwar nur einmal verdrahtet werden, aber nicht als zentral verwaltete Infrastruktur behandelt werden.

Belege:

- `js/games/sheetMusicReading/sheetMusicReading.js:342-376`
- `js/games/notePlayingExercise/notePlayingExercise.js:45-59`
- praktisch alle Dateien unter `js/games/*/*.js` und `js/tools/*/*.js`

Konsequenz:

- UI-Struktur und Fachlogik sind eng gekoppelt.
- Refactorings an HTML-Strukturen sind teuer.
- Lifecycle-Fehler werden wahrscheinlicher.

Optimierung:

- Pro Feature einen `resolveElements(root)`-Adapter oder `ViewAdapter` einführen.
- HTML-Seiten nur noch deklarativ halten; Bootstrapping in JS-Dateien auslagern.
- Global-Events zentral registrieren und dokumentieren.
- Wiederkehrende UI-Bausteine stärker in Komponenten kapseln.

### 6. Shared Services für Browser-APIs

Bewertung: hoch

Befunde:

- Audio- und Mikrofon-Lifecycle wird in mehreren Features separat gelöst.
- `localStorage` wird direkt in Feature-Controllern gelesen und beschrieben.
- Caching/PWA-Konfiguration ist funktionsfähig, aber stark manuell gepflegt.

Belege:

- Audio-Duplikation in:
  - `js/tools/guitarTuner/guitarTuner.js`
  - `js/games/notePlayingExercise/notePlayingExercise.js`
  - `js/games/sheetMusicMic/sheetMusicMicExercise.js`
  - `js/games/akkordfolgenTrainer/akkordfolgenTrainer.js`
- Persistenz direkt im Controller:
  - `js/games/sheetMusicReading/sheetMusicReading.js:28-31`, `120`, `274`, `292`, `307`, `314`
  - `js/tools/metronome/metronome.js:35`, `42`, `87`, `95`
- Manuelle Precache-Liste:
  - `sw.js:13-27`

Konsequenz:

- Browser-API-Wissen ist verteilt statt zentralisiert.
- Verhalten wird inkonsistent, wenn neue Features entstehen.
- Service Worker driftet leicht von echten Assets/Pages weg.

Optimierung:

- `storageService` oder `settingsRepository` je Feature-Typ einführen.
- `audioSessionFactory` und `microphoneAccessService` extrahieren.
- Service-Worker-Precache aus Manifest/Build-Liste ableiten oder zumindest zentral generieren.

### 7. Code Conventions und Konsistenz

Bewertung: mittel bis hoch

Befunde:

- Sprachmix aus Deutsch und Englisch in Dateinamen, Bezeichnern und UI-IDs:
  - `akkordUebersicht`, `TonFinder`, `sheetMusic`, `notePlaying`, `fretboard`
- Exportmuster sind inkonsistent:
  - manche Seiten verwenden `create...Exercise()`
  - `akkordUebersicht` exportiert direkt `startExercise()`
- Konventionen für Dateigröße und Verantwortungsumfang sind nicht erkennbar.
- HTML enthält Inline-Styles und Inline-Bootstraps.

Belege:

- `pages/exercises/note-playing.html:13`, `22`, `25`
- `pages/*/*.html` Inline-Module
- `js/tools/akkordUebersicht/akkordUebersicht.js`

Konsequenz:

- Lesbarkeit sinkt.
- API-Oberfläche wirkt uneinheitlich.
- Onboarding wird unnötig schwer.

Optimierung:

- Naming-Konvention festlegen:
  - entweder fachliche Begriffe deutsch und technische Begriffe englisch
  - oder komplett englische Code-APIs bei deutscher UI
- Einheitliches Exportmuster für alle Features definieren.
- Inline-Styles entfernen, in CSS-Klassen überführen.
- Architektur- und Code-Standards in `codex.md` oder `docs/architecture.md` dokumentieren.

### 8. Testbarkeit und Qualitätsprozess

Bewertung: mittel

Befunde:

- Positiv:
  - viele Pure-Logic-Module sind getestet
  - Linting läuft sauber
  - CI führt `lint` und `test` aus
- Schwächer:
  - Große Controller sind nur begrenzt isoliert testbar
  - Bootstrapping, Lifecycle und Seitenintegration sind kaum als standardisierte Schicht testbar
  - Der Volltestlauf `npm test` hat in der Review nicht innerhalb des Beobachtungsfensters abgeschlossen; das deutet auf langsame oder potenziell hängende Tests hin

Verifikation in dieser Review:

- `npm run lint`: erfolgreich
- `npm test`: gestartet, aber im Beobachtungsfenster nicht abgeschlossen

Optimierung:

- Tests in schnelle und langsame Suiten trennen:
  - `test:unit`
  - `test:audio`
  - `test:ci`
- Für langsame Audio-Tests explizite Timeouts und Reporter einführen.
- Controller-Tests über Adapter und Mocks vereinfachen.
- Smoke-Tests für alle Page-Bootstraps ergänzen.

### 9. PWA, Deployment und Betriebsaspekte

Bewertung: mittel

Befunde:

- Service Worker ist ordentlich kommentiert, aber die Asset-Liste ist manuell.
- `version.txt` wird manuell eingebunden; Release- und Cache-Versionierung sind nicht aus einer Quelle abgeleitet.

Optimierung:

- Version, Cache-Version und Release-Metadaten zusammenführen.
- Release-Prozess dokumentieren oder automatisieren.
- PWA-Asset-Inventar aus einer zentralen Definition erzeugen.

## Priorisierter Optimierungsplan

### Phase 1: Architektur konsolidieren

Priorität: P1

1. Zielarchitektur festlegen: Multi-Page-App mit JS-Bootstrap pro Seite.
2. `exerciseRegistry` und übrig gebliebene SPA-Artefakte entfernen oder reaktivieren, aber nicht beides parallel betreiben.
3. Für jede Seite dedizierte Bootstrap-Dateien anlegen statt Inline-Skripten in HTML.
4. Ein gemeinsames Feature-Interface definieren und für alle Übungen/Werkzeuge vereinheitlichen.

### Phase 2: Schichtgrenzen sauber ziehen

Priorität: P1

1. Gemeinsame Fachlogik aus Feature-Ordnern in neutrale Shared-/Domain-Module verschieben.
2. `components` von `games` entkoppeln.
3. Rendering-Helfer, Audio-Helfer und Fretboard-/Chord-Domain zentralisieren.
4. Import-Regeln etablieren und per ESLint absichern.

### Phase 3: Große Controller zerlegen

Priorität: P1

1. Zuerst diese Dateien schneiden:
   - `js/tools/guitarTuner/guitarTuner.js`
   - `js/games/sheetMusicReading/sheetMusicReading.js`
   - `js/games/akkordfolgenTrainer/akkordfolgenTrainer.js`
   - `js/games/sheetMusicMic/sheetMusicMicExercise.js`
   - `js/games/notePlayingExercise/notePlayingExercise.js`
2. Pro Feature trennen in:
   - State
   - UI-Adapter
   - Audio-/Storage-Service
   - Controller
3. Globale Browser-Events und Timer systematisch teardown-fähig machen.

### Phase 4: Shared Infrastructure einführen

Priorität: P2

1. `storageService` für `localStorage`-Zugriffe einführen.
2. `audioSession`/`microphoneService` für wiederkehrende Web-Audio-Muster extrahieren.
3. Wiederkehrende Settings-Patterns weiter vereinheitlichen.
4. Service-Worker-Precache-Liste zentralisieren.

### Phase 5: Konventionen schärfen

Priorität: P2

1. Naming-Konvention für Module, IDs und Exporte festlegen.
2. Standard für Dateigröße und Verantwortungsumfang dokumentieren.
3. HTML ohne Inline-Bootstrap und ohne Inline-Styles.
4. Architekturregeln in `docs/architecture.md` dokumentieren.

### Phase 6: Test- und CI-Qualität verbessern

Priorität: P2

1. Hängende oder sehr langsame Tests identifizieren und separieren.
2. Test-Skripte nach Typ splitten.
3. Smoke-Tests für Bootstrapping und Lifecycle ergänzen.
4. Architekturkritische Regeln per Lint und Tests absichern.

## Empfohlene Reihenfolge der Umsetzung

1. Architekturentscheidung treffen und Registry/Bootstrapping bereinigen.
2. Gemeinsame Domain-/Shared-Module extrahieren.
3. Die größten Controller in Scheiben schneiden.
4. Erst danach Naming, Struktur und Tests nachziehen.

## Zielbild

Angestrebtes Ziel ist eine klare, einfache Struktur:

- `pages/` enthält nur deklarative HTML-Seiten.
- `js/bootstrap/` startet Seiten und verdrahtet Features.
- `js/features/` enthält konkrete Übungen/Werkzeuge.
- `js/domain/` enthält fachliche Kernlogik ohne DOM.
- `js/shared/` enthält Rendering, Storage, Audio und Infrastruktur.
- `js/components/` enthält generische UI-Bausteine ohne Feature-Abhängigkeiten.

Damit würden SOLID, Testbarkeit, Erweiterbarkeit und Lesbarkeit deutlich gewinnen, ohne das Projekt unnötig zu verkomplizieren.
