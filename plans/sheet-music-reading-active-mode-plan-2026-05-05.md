# Plan: Noten lesen mit optionalem Aktiv- und Metronom-Modus

**Erstellt:** 2026-05-05  
**Status:** Phase 1 und Phase 2 (Aktiv ohne Metronom) begonnen; getrennte
Aktiv-/Metronom-UI und sequentielle Mic-Erkennung in Umsetzung

---

## Ziel

Die Übung **„Noten lesen“** wird zur zentralen Noten-Übung und erhält zwei
getrennte, unabhängig schaltbare Modi:

- `Aktiv`
- `Metronom`

Beide Modi sind optional. Daraus entstehen vier fachliche Betriebszustände:

1. weder aktiv noch Metronom
2. nur aktiv
3. nur Metronom
4. aktiv + Metronom

Die bestehende Übung **„Noten spielen“** (`sheetMusicMic`) soll später entfallen,
wenn ihr Verhalten in „Noten lesen“ aufgegangen ist. Die Übung
**„Ton spielen“** (`notePlayingExercise`) ist **explizit nicht Teil dieses Tasks**
und darf weder fachlich noch technisch verändert werden.

---

## Ergebnisbild

Nach Abschluss der Gesamtaufgabe soll gelten:

- „Noten lesen“ bleibt ohne Mikrofon vollständig benutzbar.
- „Noten lesen“ kann optional gespielte Töne per Mikrofon erkennen.
- Das Metronom kann unabhängig vom aktiven Erkennungsmodus genutzt werden.
- Der aktive Modus ohne Metronom ersetzt fachlich den bisherigen
  sequentiellen Ablauf von `sheetMusicMic`.
- Der aktive Modus mit Metronom bewertet nur die aktuell zeitlich fällige Note;
  ausgelassene Noten sind erlaubt.
- `sheetMusicMic` kann nach erfolgreicher Migration entfernt werden.
- `notePlayingExercise` bleibt unverändert.

---

## Fachliche Anforderungen

### 1. Grundverhalten von „Noten lesen“

- Die bestehende Notendarstellung bleibt erhalten:
  - 4 Takte
  - BPM
  - Taktart
  - Endlosmodus
  - optional Tabs
- Ohne aktivierten Modus verhält sich die Übung wie heute als passive
  Leseübung.

### 2. Getrennte Modi

- `Aktiv` und `Metronom` sind getrennte Schalter.
- `Aktiv` darf ohne `Metronom` laufen.
- `Metronom` darf ohne `Aktiv` laufen.
- Mikrofonzugriff wird nur benötigt, wenn `Aktiv` eingeschaltet wird.

### 3. Verhalten je Moduskombination

#### A. `Aktiv = aus`, `Metronom = aus`

- reines Notenlesen
- keine Tonerkennung
- kein Zeitdruck

#### B. `Aktiv = aus`, `Metronom = an`

- passives Notenlesen mit Zeit-/Cursor-Führung
- keine Tonerkennung
- keine Mikrofonpflicht

#### C. `Aktiv = an`, `Metronom = aus`

- Noten müssen in Reihenfolge korrekt gespielt werden
- die aktuelle Zielnote bleibt aktiv, bis sie korrekt erkannt wurde
- falsche Töne schalten nicht weiter
- identische Folgetöne erfordern neue Anschläge
- dies ist der direkte fachliche Ersatz für den Kern von `sheetMusicMic`

#### D. `Aktiv = an`, `Metronom = an`

- nur die aktuell zeitlich fällige Note zählt
- die Zeitachse läuft unabhängig von Trefferpflicht weiter
- verpasste Noten dürfen ausgelassen werden
- alte Noten dürfen nicht rückwirkend nacherfüllt werden
- dies ist eine spätere, gesonderte Ausbauphase

### 4. Anschlagspflicht / Sustain

- Wiederholte gleiche Noten dürfen nicht allein durch Sustain automatisch
  erfüllt werden.
- Für identische Zielnoten hintereinander ist jeweils ein frischer Anschlag
  nötig.

### 5. Migration / Rückbau

- `sheetMusicMic` wird erst entfernt, wenn mindestens der aktive Modus ohne
  Metronom in „Noten lesen“ stabil übernommen wurde.
- Navigation, Tests, Dokumentation und Debug-Pfade von `sheetMusicMic` werden
  erst im Rückbau-Schritt entfernt.
- `notePlayingExercise` bleibt unberührt.

---

## Fachliche Testfälle

### Passive Nutzung

- Nutzer öffnet „Noten lesen“ ohne aktivierte Modi und sieht das bisherige
  Verhalten unverändert.
- Nutzer aktiviert nur das Metronom und erhält Cursor/Beat-Führung ohne
  Mikrofonabfrage.

### Aktiver Modus ohne Metronom

- richtige Note in richtiger Reihenfolge → nächste Zielnote wird aktiv
- falsche Note → aktuelle Zielnote bleibt offen
- gleiche Zielnote zweimal hintereinander → zwei frische Anschläge notwendig
- Sustain allein erfüllt die nächste gleiche Note nicht

### Aktiver Modus mit Metronom

- korrekt gespielte aktuelle Note wird im aktuellen Zeitfenster akzeptiert
- verpasste Note blockiert den Ablauf nicht
- eine zu spät gespielte alte Note hakt keinen vergangenen Slot nachträglich ab
- die Zeitachse schreitet auch ohne Treffer weiter fort

### Fehler- und Randfälle

- `Aktiv = an`, Mikrofon nicht freigegeben → klarer UI-Zustand statt stiller
  Fehlfunktion
- Frets-/Strings-Änderungen beeinflussen den Notenpool weiter konsistent
- Endlosmodus bleibt sowohl passiv als auch aktiv verwendbar

### Regressionen

- nach Entfernung von `sheetMusicMic` existieren keine toten Links oder
  gebrochenen Smoke-/E2E-Tests
- `notePlayingExercise` verhält sich vor und nach der Aufgabe identisch

---

## Technischer Zuschnitt

### Im Scope

- `js/games/sheetMusicReading/*`
- `js/games/sheetMusicMic/*`
- `pages/sheet-music-reading/*`
- `pages/sheet-music-mic/*`
- zugehörige Navigation, Dokumentation, Unit-/Smoke-/E2E-Tests

### Explizit außerhalb des Scopes

- `js/games/notePlayingExercise/*`
- `pages/note-playing/*`
- Tests und Logik der Übung „Ton spielen“

### Technische Leitidee

- `sheetMusicReading` wird Zielmodul.
- `sheetMusicMic` liefert die wiederverwendbare Mikrofon- und
  Fortschrittslogik.
- Die Architektur sollte die Modi früh explizit modellieren:
  - `active: boolean`
  - `metronome: boolean`
- Daraus ergeben sich zwei getrennte Fortschrittsmodelle:
  - sequenziell bei `active && !metronome`
  - zeitgebunden bei `active && metronome`

### Technische Absicht

- Pitch-Erkennung, Onset-Gate und Match-State aus `sheetMusicMic` wiederverwenden
- Noten-/Score-/Playback-Darstellung in `sheetMusicReading` als führende UI
  behalten
- keine neue dritte Parallel-Implementierung bauen
- `notePlayingExercise` nicht als Refactoring-Quelle heranziehen

---

## Phasen

### Phase 1: Modusmatrix und Zielverhalten absichern

**Ziel**

- Vier Zustände fachlich sauber definieren:
  - passiv
  - metronome-only
  - active-sequential
  - active-timed

**Validierung**

- keine Widersprüche im Verhalten zwischen `Aktiv` und `Metronom`
- klare UI- und Zustandsregeln für Mikrofonfreigabe

### Phase 2: Aktiver Modus ohne Metronom

**Ziel**

- „Noten lesen“ kann Noten sequentiell per Mikrofon prüfen
- direkter funktionaler Ersatz für den Kern von `sheetMusicMic`

**Validierung**

- korrekte Reihenfolge
- falsche Töne blockieren
- frischer Anschlag für gleiche Folgetöne

### Phase 3: Technische Konsolidierung

**Ziel**

- Audio-/Onset-/Match-Logik aus `sheetMusicMic` in eine tragfähige Struktur für
  `sheetMusicReading` überführen

**Validierung**

- keine dauerhafte doppelte Parallel-Logik
- „Noten lesen“ trägt die aktive Sequenzprüfung eigenständig

### Phase 4: Rückbau von `sheetMusicMic`

**Ziel**

- `sheetMusicMic` aus Navigation, Routing, Tests und Doku entfernen, sobald
  Phase 2/3 stabil abgeschlossen sind

**Validierung**

- keine toten Links
- keine gebrochenen Smoke-/E2E-Tests
- `notePlayingExercise` bleibt unverändert erreichbar

### Phase 5: Aktiver Modus mit Metronom

**Ziel**

- zeitfensterbasierte Bewertung ergänzen
- nur die aktuell zu spielende Note zählt
- ausgelassene Noten sind erlaubt

**Validierung**

- Taktfluss bleibt stabil
- vergangene Noten werden nicht rückwirkend erfüllt
- Metronom-only und aktiv-only bleiben regressionsfrei

---

## Risiken und offene Punkte

- `active + metronome` ist fachlich kein kleiner Zusatz, sondern eine eigene
  Bewertungslogik.
- Die visuelle Behandlung verpasster Noten ist noch nicht final entschieden.
- Die UI muss trennscharf erklären, warum Metronom laufen kann, obwohl keine
  Tonprüfung aktiv ist.
- Der Rückbau von `sheetMusicMic` darf nicht zu früh passieren, sonst geht
  funktionale Referenz verloren.

---

## Vorläufige Defaults für die spätere Umsetzung

- `Aktiv` und `Metronom` werden getrennt gespeichert.
- `Aktiv` ist standardmäßig aus.
- `Metronom` ist standardmäßig aus.
- Im ersten aktiven Ausbauschritt wird nur `active && !metronome` umgesetzt.
- Die zeitgebundene Erkennung `active && metronome` ist ausdrücklich die letzte
  Phase.
