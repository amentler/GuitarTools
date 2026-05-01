# Globaler Debug-Modus auf Startseite und Unterseiten

## Ziel und Ergebnis

Die Anwendung soll einen global aktivierbaren Debug-Modus erhalten, der von
der Startseite aus eingeschaltet werden kann und danach auf allen Unterseiten
konsistent verfuegbar ist.

Nach Abschluss der Umsetzung soll folgendes gelten:

- Auf der Startseite gibt es am unteren Seitenende einen klaren Einstieg
  `Debug-Modus AN`.
- Der Aktivzustand des Debug-Modus bleibt nach Navigation und Reload erhalten.
- Auf Unterseiten ist ein einheitlicher Debug-Zugang verfuegbar, solange der
  Debug-Modus aktiv ist.
- Der Debug-Zugang oeffnet ein In-App-Debug-Fenster innerhalb der aktuellen
  Seite.
- Das Debug-Fenster zeigt strukturierte Ereignisse in zeitlicher Reihenfolge.
- Das Debug-Fenster besitzt einen Knopf `Alles kopieren`, der den aktuellen
  Debug-Inhalt inklusive Kontextmetadaten in die Zwischenablage legt.
- Fachspezifische Debug-Daten, wie aktuell bereits bei `Noten spielen`,
  koennen in die gemeinsame Infrastruktur eingespeist werden.

## Fachliche Anforderungen

### Muss-Anforderungen

- Die Startseite bietet am unteren Seitenende einen Debug-Schalter oder
  Debug-Knopf zum Einschalten des globalen Debug-Modus.
- Der Aktivzustand des Debug-Modus ist seitenuebergreifend verfuegbar.
- Auf jeder Unterseite ist ein Debug-Einstieg vorhanden, sobald der
  Debug-Modus aktiv ist.
- Das Debug-Fenster ist auf Mobil und Desktop bedienbar.
- Das Debug-Fenster zeigt strukturierte Eintraege statt unlesbarer Rohlogs.
- Jeder Eintrag enthaelt mindestens:
  - Zeitpunkt
  - Quelle oder Seitenkontext
  - Ereignistyp
  - relevante Nutzdaten oder Statuswerte
- Es gibt einen Knopf `Alles kopieren`.
- `Alles kopieren` kopiert den kompletten aktuellen Debug-Inhalt inklusive
  relevanter Metadaten.
- Fehlerfaelle beim Kopieren werden fuer den Nutzer sichtbar behandelt.
- Der Debug-Modus veraendert keine Fachlogik im Normalbetrieb.

### Soll-Anforderungen

- Das Debug-Fenster zeigt garantierte Basisereignisse auf allen Seiten:
  - `page-loaded`
  - `navigation`
  - `ui-action`
  - `flow-start`
  - `flow-stop`
  - `permission-error`
  - `unhandled-error`
- Vorhandene Spezialdiagnostik von `sheet-music-mic` wird nicht parallel
  isoliert weitergefuehrt, sondern an den globalen Debug-Pfad angeschlossen.
- Das Debug-Fenster soll nicht nur fuer Entwickler, sondern auch fuer
  Fehlermeldungen an Dritte nutzbar sein.

### Kann-Anforderungen

- `Debug-Modus AUS` direkt im Debug-Fenster
- `Log leeren`
- Download als Datei
- Filter nach Ereignistyp oder Zeit

## Annahmen und Default-Entscheidungen

Diese Punkte sollten vor Umsetzung bestaetigt oder bewusst anders entschieden
werden. Bis zur Rueckmeldung gelten folgende Defaults:

- Der Debug-Modus wird in `localStorage` gespeichert.
- Das Debug-Fenster ist kein echtes Browser-Popup, sondern ein In-App-Fenster
  als Bottom-Sheet oder Drawer.
- Der Debug-Zugang auf Unterseiten ist nur sichtbar, wenn der Debug-Modus
  aktiv ist.
- Das Log ist primaer seitenbezogen und lebt pro Browsertab im Speicher.
- Beim Seitenwechsel startet das Seitenlog neu, darf aber einen
  Navigationseintrag als Kontext enthalten.
- `Alles kopieren` kopiert:
  - URL
  - Zeitstempel
  - Seitenname oder Seitenschluessel
  - User-Agent
  - Debug-Modus-Status
  - sichtbare Log-Eintraege

## Fachliche Testfaelle

### Aktivierung und Persistenz

- Ein Nutzer aktiviert den Debug-Modus auf der Startseite.
  - Erwartung: Der Debug-Modus ist direkt aktiv.
- Ein Nutzer navigiert danach auf eine beliebige Unterseite.
  - Erwartung: Der Debug-Zugang ist dort verfuegbar.
- Ein Nutzer laedt die Unterseite neu.
  - Erwartung: Der Debug-Modus bleibt aktiv.

### Sichtbarkeit und Bedienung

- Ein Nutzer oeffnet auf einer Unterseite das Debug-Fenster.
  - Erwartung: Das Fenster ist sichtbar, ueberlagert die Seite kontrolliert und
    bleibt bedienbar.
- Ein Nutzer schliesst das Debug-Fenster.
  - Erwartung: Die normale Seite bleibt unveraendert nutzbar.
- Ein Nutzer verwendet das Debug-Fenster auf kleinem mobilen Viewport.
  - Erwartung: Inhalt bleibt scrollbar und Aktionen bleiben erreichbar.

### Logging

- Ein Nutzer startet eine Kernaktion auf einer Seite.
  - Erwartung: Die Aktion erscheint als strukturierter Eintrag im Debug-Log.
- Ein Fehlerfall tritt auf, z. B. ein Berechtigungsfehler.
  - Erwartung: Der Fehler erscheint strukturiert im Debug-Log.
- Auf `Noten spielen` werden Audio- oder Matcher-Daten erzeugt.
  - Erwartung: Diese koennen im gemeinsamen Debug-Fenster angezeigt werden.
- Eine Seite ohne Spezialdiagnostik wird geoeffnet und benutzt.
  - Erwartung: Mindestens Basisereignisse erscheinen im Log.

### Kopieren

- Ein Nutzer klickt `Alles kopieren`.
  - Erwartung: Der gesamte Debug-Inhalt wird mit Metadaten in die
    Zwischenablage kopiert.
- Der Clipboard-Zugriff scheitert.
  - Erwartung: Es gibt eine sichtbare Fehlerrueckmeldung.

## Technisches Vorgehen

### Zielarchitektur

Es soll eine gemeinsame Debug-Infrastruktur eingefuehrt werden, statt jede
Seite separat mit Einzellogik auszustatten.

Vorgeschlagene Bausteine:

- `js/shared/debug/`
  - Aktivzustand des Debug-Modus
  - In-Memory-Log-Puffer
  - API zum Schreiben strukturierter Events
  - Clipboard-Export und Serialisierung
- neuer globaler Debug-Host oder neue UI-Komponente
  - rendert den Debug-Zugang unten auf der Seite
  - oeffnet und schliesst das Debug-Fenster
  - zeigt den Log an
- Startseitenintegration
  - globaler Einstieg `Debug-Modus AN`
- Unterseitenintegration
  - gemeinsamer Bootstrap-Hook fuer `pages/*/bootstrap.js`
- fachspezifische Adapter
  - z. B. `sheetMusicMic` publiziert Ereignisse in den gemeinsamen Debug-Store

### Wahrscheinlich betroffene Dateien

- `index.html`
- `js/app.js`
- `style.css`
- `js/components/index.js`
- `js/components/gt-exercise-header.js`
- neue Dateien unter `js/shared/debug/`
- ggf. neue UI-Komponente unter `js/components/`
- `pages/*/bootstrap.js`
- bestehende Spezialinstrumentierung in:
  - `js/games/sheetMusicMic/sheetMusicMicExercise.js`

### Integrationsstrategie

- Nicht jede Seite einzeln per Copy-Paste anpassen.
- Stattdessen einen gemeinsamen Debug-Host etablieren, der ueber einen
  gemeinsamen Bootstrap-Pfad oder eine gemeinsame Komponente eingebunden wird.
- Bestehende Spezial-Debug-Daten in das neue gemeinsame Logging einspeisen.
- Erst garantierte generische Events auf allen Seiten, danach gezielte
  fachliche Instrumentierung.

## Phasen

### Phase 1: Debug-Lebenszyklus festlegen

Ziel:

- Aktivzustand, Logskope, Sichtbarkeit und Exportumfang final festlegen.

Validierung:

- Offene Produktentscheidungen sind beantwortet oder Defaults sind freigegeben.

### Phase 2: Gemeinsamen Debug-Kern bereitstellen

Ziel:

- Shared Debug-State, Event-API, In-Memory-Log und Serialisierung
  bereitstellen.

Validierung:

- Unit-Tests fuer Aktivzustand, Log-Puffer und Exportserialisierung.

### Phase 3: Startseite integrieren

Ziel:

- Startseiten-Einstieg `Debug-Modus AN` am unteren Seitenende einfuehren.

Validierung:

- Aktivierung wird gespeichert und ist nach Navigation verfuegbar.

### Phase 4: Globalen Unterseiten-Host anschliessen

Ziel:

- Einheitlichen Debug-Zugang auf Unterseiten ueber den Bootstrap-Pfad
  verfuegbar machen.

Validierung:

- Mehrere Unterseiten zeigen denselben Debug-Zugang ohne HTML-Copy-Paste.

### Phase 5: Debug-Fenster und Copy-Flow

Ziel:

- In-App-Debug-Fenster mit strukturiertem Log und `Alles kopieren`.

Validierung:

- Copy-Flow funktioniert und Fehlerfaelle sind sichtbar.

### Phase 6: Garantierte Basisinstrumentierung

Ziel:

- Generische Eintraege fuer Seitenstart, Navigation, zentrale Aktionen,
  Start-Stopp-Flows und Fehler.

Validierung:

- Auf Seiten ohne Speziallogik entstehen trotzdem nutzbare Eintraege.

### Phase 7: Fachspezifische Integration

Ziel:

- Bestehende `sheet-music-mic`-Debugdaten in die globale Infrastruktur
  einhaengen.

Validierung:

- Das Debug-Fenster zeigt Audio-, Matcher- oder Ablaufkontext innerhalb des
  gemeinsamen Logs.

### Phase 8: Regression und Politur

Ziel:

- Regressionssichere Tests und brauchbare UX auf Mobil und Desktop.

Validierung:

- Relevante Unit-, Smoke- und Playwright-Tests sind gruen.

## Risiken und offene Fragen

- Ein echter Browser-Popup-Ansatz waere unzuverlaessiger und mobilkritischer.
- Zu viele rohe Events machen das Debug-Log unbrauchbar.
- Zu wenig strukturierte Ereignisse machen das Debug-Log wertlos.
- Ein dauerhaft gespeichertes Log wuerde Datenschutz- und Speicherfragen
  vergroessern, ohne fuer V1 noetig zu sein.
- Wenn der Debug-Zugang im aktiven Modus zu dominant ist, stoert er die
  regulaere Nutzung.
- Wenn zu viele Seiten individuell angepasst werden muessen, steigt das
  Wartungsrisiko.
- Die aktuelle `sheet-music-mic`-Diagnostik nutzt direkte Globals; diese
  sollten mittelfristig durch eine offizielle Producer-Schnittstelle ersetzt
  werden.

## Rueckfragen zur Implementierung

### Blockierend

1. Soll das Log nur den aktuellen Seitenkontext zeigen oder einen
   seitenuebergreifenden Sitzungsverlauf enthalten?
   - Default: aktueller Seitenkontext plus Navigationseintrag.

2. Bedeutet `extra Fenster` ein echtes Browserfenster oder ein In-App-Fenster?
   - Default: In-App-Fenster.

3. Soll der Debug-Zugang auf Unterseiten immer sichtbar sein, sobald Debug
   aktiv ist, oder nur ueber ein dezentes Trigger-Element?
   - Default: sichtbar bei aktivem Debug-Modus, aber visuell zurueckhaltend.

### Wichtig

4. Welche Aktionen muessen seitenuebergreifend garantiert geloggt werden?
   - Vorschlag:
     - Seitenstart
     - Navigation
     - primäre CTA-Klicks
     - Start-Stopp
     - Fehler
     - Permission-Events
     - fachliche Kernereignisse je Tool

5. Soll `Alles kopieren` nur sichtbare Eintraege oder auch Metadaten wie URL,
   User-Agent und Zeitstempel kopieren?
   - Default: inklusive Metadaten.

6. Soll es im Debug-Fenster direkt auch `Debug AUS` und `Log leeren` geben?
   - Default: ja fuer `Debug AUS` und ja fuer `Log leeren`.

### Optional

7. Soll spaeter ein Export als Datei oder ein Filter nach Eventtyp vorgesehen
   werden?
   - Default: nein in der ersten Ausbaustufe.

## Umsetzungsreihenfolge

1. Debug-Lebenszyklus bestaetigen
2. Shared Debug-Kern und Event-API
3. Startseiten-Schalter
4. Globaler Debug-Host fuer Unterseiten
5. Debug-Fenster und Copy-Funktion
6. Basislogging
7. Integration bestehender Spezialdiagnostik
8. Tests und Politur

## Abnahmekriterien

- Der Debug-Modus ist auf der Startseite aktivierbar.
- Der Aktivzustand ist seitenuebergreifend stabil.
- Auf allen Unterseiten ist der Debug-Zugang bei aktivem Debug-Modus
  verfuegbar.
- Das Debug-Fenster zeigt ein nutzbares strukturiertes Log.
- `Alles kopieren` funktioniert inklusive Metadaten.
- `Noten spielen` kann seine Spezialdiagnostik in den globalen Debug-Modus
  einbringen.
- Die bestehende Fachfunktionalitaet wird nicht regressiv beeinflusst.
