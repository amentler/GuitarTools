# Chord Recognition Path Separation Plan

## Ziel

Die Akkorderkennung wird in vollstaendig getrennte Erkennungspfade aufgeteilt.
Der Pure-JS-Pfad wird fachlich in einen frueheren, stabilen Zustand mit gleicher Charakteristik zurueckgefuehrt.
Der Essentia-Pfad bleibt der Entwicklungs-Default und wird anschliessend matcher-seitig neu aufgebaut, ohne Seiteneffekte auf Pure-JS.

## Umsetzungsstand 2026-05-03

- Erledigt: strukturelle Pfadtrennung fuer Matcher und Laufzeit-Routing.
- Erledigt: eigener Essentia-Matcher mit eigenem Fingerprint-Fallback in separatem Modul.
- Erledigt: zentraler Pfad-Resolver mit Essentia als Entwicklungsdefault.
- Erledigt: Fingerprint-, Session- und Guard-Tests auf getrennte Matcher-Einstiege umgestellt.
- Offen: historisches Pure-JS-Referenzverhalten aus der Git-Historie dokumentiert wiederherstellen.
- Offen: Pure-JS-Fingerprint-/Direkt-WAV-Qualitaet wieder auf den gewuenschten Referenzstand anheben.

## Anforderungen

- Pure-JS und Essentia muessen eigene Matcher besitzen.
- Eine Aenderung am Essentia-Matcher darf Pure-JS-Ergebnisse nicht veraendern.
- Eine Aenderung am Pure-JS-Matcher darf Essentia-Ergebnisse nicht veraendern.
- Die aktuelle `strategy`-Flag im gemeinsamen Matcher reicht nicht mehr aus und wird durch echte Pfadtrennung ersetzt.
- Die UI soll spaeter den aktiven Erkennungspfad waehlen koennen.
- Der Entwicklungsdefault ist kuenftig immer Essentia.
- Die Architektur muss weitere zukuenftige Erkennungspfade aufnehmen koennen.

## Fachliche Zielbilder

### Pure-JS

- Historische, fachlich gleichwertige Matcher-Charakteristik wiederherstellen.
- Keine bitgenaue Rueckkehr zu einem alten Commit noetig.
- Referenz ist das fruehere fachliche Verhalten, nicht alter Code um jeden Preis.

### Essentia

- Eigener Matcher ohne implizite Abhaengigkeit vom Pure-JS-Matcher.
- Kein gemeinsamer Regelkern mit Pure-JS.
- Nach der Trennung matcher-seitig bewusst neu aufbauen.

## Architektur

### Gemeinsame Schicht

- Chord-Stammdaten
- gemeinsame Ergebnisstruktur
- neutrale Utilities ohne Matcher-Regeln
- gemeinsame Test- und Fingerprint-Harnesses

### Pfadmodule

- `pure-js`
  - eigene Feature-Erzeugung
  - eigener Matcher
  - eigene Metrik-Anbindung
- `essentia`
  - eigene Feature-Erzeugung
  - eigener Matcher
  - eigene Metrik-Anbindung
- spaeter weitere Pfade nach demselben Muster

### Routing

- Ein zentraler Resolver waehlt anhand des aktiven Pfads das passende Modul.
- Kein gemeinsamer Matcher mit internem `strategy`-Switch.
- Die UI liefert spaeter den aktiven Pfad.
- Ohne explizite UI-Wahl wird in Entwicklung Essentia verwendet.

## Umsetzungsphasen

### Phase 1: Historie und Referenzverhalten sichern

- Git-Historie des Pure-JS-Matchers untersuchen.
- Commit-Spanne identifizieren, in der der Pure-JS-Pfad fachlich noch stabil war.
- Commit oder Commit-Spanne als Referenz fuer die Wiederherstellung dokumentieren.
- Fingerprint- und Direkt-WAV-Verhalten dieses Referenzstands festhalten.

### Phase 2: Matcher-Pfade strukturell trennen

- Gemeinsame Matcher-Logik identifizieren.
- Pure-JS- und Essentia-spezifische Regeln aus dem gemeinsamen Matcher herausziehen.
- Neue Modulgrenzen fuer Pfade und Routing schaffen.

### Phase 3: Pure-JS fachlich wiederherstellen

- Historische Pure-JS-Logik fachlich gleichwertig in den neuen Pure-JS-Pfad uebernehmen.
- JS-Fingerprint und direkte WAV-Tests explizit gegen nur diesen Pfad laufen lassen.
- Verhalten gegen die Referenzcharakteristik vergleichen.

### Phase 4: Essentia isolieren

- Essentia-Matcher von Pure-JS-Altlasten entkoppeln.
- Essentia-Fingerprint, direkte WAV-Tests und App-Pfad auf den neuen Essentia-Matcher umstellen.
- Vorhandene matcher-spezifische Fallbacks und Heuristiken neu bewerten.

### Phase 5: UI-Pfadwahl vorbereiten

- Konfigurationsmodell fuer spaetere UI-Umschaltung festlegen.
- Essentia als Entwicklungsdefault verdrahten.
- Sicherstellen, dass neue Pfade spaeter ohne Matcher-Vermischung hinzukommen koennen.

## Akzeptanzkriterien

- Pure-JS und Essentia laufen durch getrennte Matcher-Dateien oder getrennte Matcher-Module.
- Es gibt keinen gemeinsamen Matcher mehr, der ueber `strategy` unterschiedliche Regelsaetze simuliert.
- Fingerprint- und Direkt-WAV-Tests koennen pro Pfad separat ausgefuehrt werden.
- Essentia ist Default in der Entwicklung.
- Pure-JS ist fachlich wiederhergestellt und gegen die historische Charakteristik validiert.

## Risiken

- Der historische Pure-JS-Zustand kann auf aelteren Fixtures beruhen.
- Die heutige Fixture-Menge kann die historische Charakteristik anders belasten.
- Test- und Script-Infrastruktur koennen derzeit zu stark an den gemeinsamen Matcher gekoppelt sein.

## Naechster Umsetzungsschritt

1. Historischen Pure-JS-Referenzstand in der Git-Historie eingrenzen.
2. Gemeinsamen Matcher auf echte Pfadgrenzen analysieren.
3. Danach Pure-JS zuerst wiederherstellen und erst anschliessend Essentia neu aufsetzen.
