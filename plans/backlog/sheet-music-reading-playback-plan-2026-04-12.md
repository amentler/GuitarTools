# Plan: Enhanced "Noten lesen" with Metronome, Moving Bar & Endless Mode

Stand: 2026-04-29
Status: Teilweise umgesetzt. Der Kernumfang ist produktiv; offen sind nur noch klar begrenzte Restpunkte.

## Bereits umgesetzt

- Metronom-Integration, Playback-Bar und Highlighting sind vorhanden.
- Mehrere Taktarten, Endless Mode und Auto-Scrolling sind implementiert.
- Persistenz, Error-Handling und Visual Polish wurden groesstenteils umgesetzt.
- Relevante Unit-/Smoke-Tests existieren bereits, unter anderem:
  - `tests/unit/playbackController.test.js`
  - `tests/unit/playbackBar.test.js`
  - `tests/unit/autoScroll.test.js`
  - `tests/unit/endlessBarGenerator.test.js`
  - `tests/unit/vexflowConfig.test.js`

## Noch offen

### 1. Keyboard Shortcuts

Die in der Ursprungsplanung beschriebenen Shortcuts sind nicht vollstaendig als abgeschlossene Phase dokumentiert.

Offen:
- klare Shortcut-Matrix bestaetigen
- Tests fuer Shortcut-Verhalten und Fokus/Lifecycle absichern
- Dokumentation im Feature-Doc aktualisieren

### 2. Virtualisierung / Langzeitsessions

Die Planung sah Virtualisierung als optionalen Performance-Schritt vor.

Offen:
- entscheiden, ob die aktuelle Endless-Mode-Performance fuer lange Sessions ausreicht
- nur bei nachgewiesenem Bedarf DOM-/Buffer-Virtualisierung nachziehen
- dann explizite Performance-/Langzeittests ergaenzen

### 3. Test- und Suite-Stabilitaet

Der Featureumfang ist vorhanden, aber die Gesamtqualitaet ist noch nicht als abgeschlossen zu betrachten, solange der Volltestlauf nicht stabil und sinnvoll getrennt ist.

Offen:
- langsame oder flakey Tests im Gesamtlauf identifizieren
- Testskripte spaeter mit dem uebergeordneten CI-Plan sauber aufteilen
- verbleibende Render-/Lifecycle-Risiken bei Bedarf mit weiteren Smoke-/E2E-Checks absichern

## Aus dem aktiven Umfang entfernt

Der fruehere Abschnitt zu bereits erledigten Kernphasen bleibt nicht mehr in `plans/backlog.md`.
Historischer Kontext bleibt ueber Git-Historie und die vorhandenen Test-/Codeartefakte nachvollziehbar.

## Abgrenzung

Nicht mehr als offener Teil dieses Plans behandelt:
- Mikrofonbasierte Notenvalidierung fuer dieses Feature
- allgemeine Architekturarbeiten ausserhalb von `sheetMusicReading`
- globale CI-/Test-Skript-Aufteilung jenseits des konkreten Featurebezugs

Diese Themen liegen jetzt in anderen aktiven Planen oder im allgemeinen Backlog.
