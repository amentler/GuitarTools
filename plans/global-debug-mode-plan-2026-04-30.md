# Globaler Debug-Modus auf Startseite und Unterseiten

## Ziel und Ergebnis

Die Anwendung soll einen globalen Debug-Modus erhalten, der von der Startseite
aus aktiviert werden kann und danach auf allen Unterseiten konsistent zur
Verfuegung steht.

Nach Abschluss der Umsetzung soll folgendes gelten:

- Auf der Startseite gibt es ganz unten einen klaren Einstieg `Debug-Modus AN`.
- Der Debug-Modus bleibt nach Navigation auf weitere Seiten aktiv.
- Auf jeder Unterseite ist unten ein Debug-Zugang verfuegbar.
- Dieser Zugang oeffnet ein eigenes Debug-Fenster innerhalb der Seite.
- Das Debug-Fenster zeigt ein laufendes Log der Aktionen auf der aktuellen
  Seite.
- Das Debug-Fenster besitzt einen Knopf `Alles kopieren`, der den kompletten
  Debug-Inhalt in die Zwischenablage legt.
- Fachspezifische Debug-Daten, wie aktuell bereits bei `Noten spielen`,
  sollen an die neue gemeinsame Infrastruktur anschliessbar sein.

## Fachliche Anforderungen

### Muss-Anforderungen

- Die Startseite bietet ganz unten einen Debug-Schalter oder Debug-Knopf zum
  Einschalten des globalen Debug-Modus.
- Der Aktivzustand des Debug-Modus ist seitenuebergreifend verfuegbar.
- Jede Unterseite bietet einen Debug-Einstieg am unteren Rand der Seite.
- Das Debug-Fenster ist auf Mobil und Desktop bedienbar.
- Das Debug-Fenster zeigt strukturierte Eintraege statt unlesbarer Rohlogs.
- Eintraege enthalten mindestens:
  - Zeitpunkt
  - Seitennamen oder Seitenkontext
  - Ereignistyp
  - relevante Nutzdaten oder Statuswerte
- Es gibt einen Knopf `Alles kopieren`.
- `Alles kopieren` kopiert den kompletten aktuellen Debug-Inhalt inklusive
  relevanter Metadaten.
- Fehlerfaelle beim Kopieren werden fuer den Nutzer sichtbar behandelt.
- Der Debug-Modus veraendert keine Fachlogik im Normalbetrieb.

### Soll-Anforderungen

- Das Debug-Fenster zeigt allgemeine Basisereignisse auf allen Seiten:
  - Seitenstart
  - Navigation
  - zentrale Button-Aktionen
  - Start/Stopp-Flows
  - Berechtigungsfehler
  - ungefangene Fehler
- Vorhandene Spezialdiagnostik von `sheet-music-mic` wird nicht parallel
  isoliert weitergefuehrt, sondern in den globalen Debug-Pfad integrierbar
  gemacht.
- Das Debug-Fenster soll nicht nur technisch, sondern auch fuer Fehlermeldungen
  an Dritte nutzbar sein.

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
- Der Debug-Zugang auf Unterseiten ist sichtbar, wenn der Debug-Modus aktiv
  ist.
- Das Log ist primaer seitenbezogen, darf aber Metadaten ueber Navigation
  enthalten.
- `Alles kopieren` kopiert:
  - URL
  - Zeitstempel
  - Seitenname
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

### Logging

- Ein Nutzer klickt zentrale Bedienknoepfe auf einer Seite.
  - Erwartung: Die Aktionen erscheinen als neue Debug-Eintraege.
- Ein Fehlerfall tritt auf, z. B. ein Berechtigungsfehler.
  - Erwartung: Der Fehler erscheint strukturiert im Debug-Log.
- Auf `Noten spielen` werden Audio- oder Matcher-Daten erzeugt.
  - Erwartung: Diese koennen im gemeinsamen Debug-Fenster angezeigt werden.

### Kopieren

- Ein Nutzer klickt `Alles kopieren`.
  - Erwartung: Der gesamte Debug-Inhalt wird in die Zwischenablage kopiert.
- Der Clipboard-Zugriff scheitert.
  - Erwartung: Es gibt eine sichtbare Fehlerrueckmeldung.

### Responsive Verhalten

- Das Debug-Fenster wird auf kleinem mobilen Viewport geoeffnet.
  - Erwartung: Inhalt bleibt scrollbar und Aktionen bleiben erreichbar.

## Technisches Vorgehen

### Zielarchitektur

Es sollte eine gemeinsame Debug-Infrastruktur eingefuehrt werden, statt jede
Seite separat mit Einzellogik auszustatten.

Vorgeschlagene Bausteine:

- `js/shared/debug/`
  - Debug-Store fuer Aktivzustand und Log-Puffer
  - API zum Schreiben strukturierter Events
  - Clipboard-Export
  - optionale Serialisierung fuer Copy/Download
- neue UI-Komponente oder globaler Debug-Host
  - rendert den Debug-Zugang unten auf der Seite
  - oeffnet/schliesst das Debug-Fenster
  - zeigt den Log an
- Startseitenintegration
  - globaler Einstieg `Debug-Modus AN`
- Seitenintegration
  - gemeinsamer Bootstrap-Hook oder Seiten-Host fuer Debug-UI
- fachspezifische Adapter
  - z. B. `sheetMusicMic` publiziert Events in den gemeinsamen Debug-Store

### Wahrscheinlich betroffene Dateien

- `index.html`
- `style.css`
- `js/components/index.js`
- `js/components/gt-exercise-header.js`
- neue Dateien unter `js/shared/debug/`
- ggf. neue UI-Komponente unter `js/components/`
- `pages/*/bootstrap.js`
- `pages/*/index.html`, falls der Debug-Host nicht rein zentral einhaengbar ist
- bestehende Spezialinstrumentierung in:
  - `js/games/sheetMusicMic/sheetMusicMicExercise.js`

### Integrationsstrategie

- Nicht jede Seite einzeln per Copy-Paste anpassen.
- Stattdessen einen gemeinsamen Debug-Host etablieren, der im Bootstrap oder
  ueber eine gemeinsame Komponente eingebunden wird.
- Bestehende Spezial-Debug-Daten in das neue gemeinsame Logging einspeisen.
- Erst generische Events auf allen Seiten, danach gezielte fachliche
  Instrumentierung.

## Phasen

### Phase 1: Produktentscheidungen und UX-Rahmen

Ziel:

- Debug-Modus-Verhalten, Sichtbarkeit und Fensterart final festlegen.

Validierung:

- Antworten auf die blockierenden Fragen liegen vor oder Defaults werden
  freigegeben.

### Phase 2: Gemeinsame Debug-Infrastruktur

Ziel:

- Shared Debug-Store, Event-API und Copy-Export bereitstellen.

Validierung:

- Unit-Tests fuer Aktivzustand, Log-Puffer und Copy-Serialisierung.

### Phase 3: Startseite

Ziel:

- Startseiten-Knopf `Debug-Modus AN` ganz unten einfuehren.

Validierung:

- Aktivierung wird gespeichert und ist nach Navigation verfuegbar.

### Phase 4: Globaler Debug-Zugang auf Unterseiten

Ziel:

- Unten auf jeder Unterseite einen einheitlichen Debug-Einstieg verfuegbar
  machen.

Validierung:

- Smoke- und Playwright-Checks fuer mehrere Seiten.

### Phase 5: Debug-Fenster und Copy-Funktion

Ziel:

- In-App-Debug-Fenster mit laufendem Log und `Alles kopieren`.

Validierung:

- Copy-Flow laeuft, Fallback bei Fehlern ist sichtbar.

### Phase 6: Basisinstrumentierung aller Seiten

Ziel:

- Generische Eintraege fuer Seitenstart, Navigation, zentrale Aktionen und
  Fehler.

Validierung:

- Auf Seiten ohne Speziallogik entstehen trotzdem nutzbare Eintraege.

### Phase 7: Fachspezifische Integration

Ziel:

- Bestehende `sheet-music-mic`-Debugdaten in die globale Infrastruktur
  einhaengen.

Validierung:

- Das Debug-Fenster zeigt Audio-/Matcher-Kontext innerhalb des gemeinsamen
  Logs.

### Phase 8: Tests und Politur

Ziel:

- Regressionssichere Tests und brauchbare UX auf Mobil/Desktop.

Validierung:

- Relevante Unit-, Smoke- und Playwright-Tests sind gruen.

## Risiken und offene Fragen

- Ein echter Browser-Popup-Ansatz waere unzuverlaessiger und mobilkritischer.
- Zu viele rohe Events machen das Debug-Log unbrauchbar.
- Zu wenig strukturierte Ereignisse machen das Debug-Log wertlos.
- Wenn der Debug-Zugang immer sichtbar ist, braucht die UI eine sehr
  zurueckhaltende Gestaltung.
- Wenn nur die aktuelle Seite protokolliert wird, kann Navigation als
  Fehlerkontext verloren gehen.
- Wenn zu viele Seiten individuell angepasst werden muessen, steigt das
  Wartungsrisiko.

## Rueckfragen zur Implementierung

### Blockierend

1. Soll der Debug-Zugang auf Unterseiten immer sichtbar sein oder nur, wenn der
   Debug-Modus zuvor aktiviert wurde?
   - Default: nur sichtbar bei aktivem Debug-Modus.

2. Bedeutet `extra Fenster` ein echtes Browserfenster oder ein In-App-Fenster?
   - Default: In-App-Fenster.

3. Soll das Log nur die aktuelle Seite oder einen seitenuebergreifenden Verlauf
   enthalten?
   - Default: aktueller Seitenkontext plus relevante Navigationsmetadaten.

### Wichtig

4. Welche Aktionen muessen sicher in jedem Fall geloggt werden?
   - Vorschlag:
     - Seitenstart
     - zentrale Klicks
     - Start/Stopp
     - Fehler
     - Permission-Events
     - fachliche Kernereignisse je Tool

5. Soll `Alles kopieren` nur sichtbare Eintraege oder auch Metadaten wie URL,
   User-Agent und Zeitstempel kopieren?
   - Default: inklusive Metadaten.

6. Soll es im Debug-Fenster direkt auch `Debug AUS` und `Log leeren` geben?
   - Default: ja fuer `Debug AUS`, optional fuer `Log leeren`.

### Optional

7. Soll spaeter ein Export als Datei oder ein Filter nach Eventtyp vorgesehen
   werden?
   - Default: nein in der ersten Ausbaustufe.

## Umsetzungsreihenfolge

1. Produktentscheidungen bestaetigen
2. Shared Debug-Store und Event-API
3. Startseiten-Schalter
4. Globaler Debug-Host fuer Unterseiten
5. Debug-Fenster und Copy-Funktion
6. Basislogging
7. Integration bestehender Spezialdiagnostik
8. Tests und Politur

## Abnahmekriterien

- Der Debug-Modus ist auf der Startseite aktivierbar.
- Der Aktivzustand ist seitenuebergreifend stabil.
- Auf allen Unterseiten ist der Debug-Zugang unten verfuegbar.
- Das Debug-Fenster zeigt ein nutzbares Log.
- `Alles kopieren` funktioniert.
- `Noten spielen` kann seine Spezialdiagnostik in den globalen Debug-Modus
  einbringen.
- Die bestehende Fachfunktionalitaet wird nicht regressiv beeinflusst.
