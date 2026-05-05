# Plan: Endlosmodus in Noten lesen mit immer 3 Notenzeilen

**Erstellt:** 2026-05-05  
**Status:** Umgesetzt am 2026-05-05

---

## Ziel

Der Endlosmodus der Uebung **„Noten lesen“** in `sheetMusicReading` soll
kuenftig nicht mehr unbegrenzt viele Notenzeilen nachladen, sondern
fortlaufend mit **genau 3 Notenzeilen** arbeiten.

Beim Wechsel zur naechsten Zeile soll die Ansicht **weich und eher langsam
scrollen**. Die Loesung muss sowohl ohne Tabs als auch mit **optional
eingeblendeten Tabs** stabil funktionieren.

---

## Ergebnisbild

Nach Abschluss der Aufgabe soll gelten:

- Der Endlosmodus haelt dauerhaft genau 3 `score-row`-Zeilen.
- Beim Fortschritt in die naechste Zeile wird oben die aelteste Zeile entfernt
  und unten eine neue Zeile angefuegt.
- Der Zeilenwechsel erfolgt mit bewusst weichem Scroll-Verhalten statt
  sprunghaftem Umbruch.
- Wenn Tabs aktiviert sind, werden Notenzeile und zugehoerige Tab-Zeile als
  gemeinsame Einheit behandelt.
- Die normale Nicht-Endlos-Ansicht bleibt unveraendert.

---

## Fachliche Anforderungen

### 1. Sichtbares Fenster im Endlosmodus

- Im Endlosmodus sollen immer genau 3 Notenzeilen aktiv gehalten werden.
- Diese 3 Zeilen bilden ein gleitendes Fenster ueber den unendlichen Ablauf.
- Das Verhalten soll nicht nur beim Start gelten, sondern dauerhaft waehrend
  der Wiedergabe.

### 2. Verhalten beim Zeilenwechsel

- Beim Eintritt in die naechste Zeile scrollt die Ansicht langsam und weich.
- Nach dem Zeilenwechsel wird die oberste, nicht mehr benoetigte Zeile
  entfernt.
- Anschliessend wird unten eine neue Zeile ergaenzt, sodass wieder genau 3
  Zeilen vorhanden sind.

### 3. Tabs als optionale Zusatzdarstellung

- Wenn `Tabs anzeigen` aktiviert ist, gehoeren Noten- und Tab-Darstellung
  fachlich zusammen.
- Eine `score-row` mit Tabs muss als zusammenhaengender Block verschoben,
  gescrollt und entfernt werden.
- Die Implementierung darf nicht von einer festen Zeilenhoehe ausgehen, da
  sich diese mit Tabs aendert.

### 4. Bestehende Modi und Einstellungen

- Der Endlos-Toggle bleibt in `localStorage` gespeichert.
- Taktart, BPM, Bundeinstellung und Saitenfilter muessen auch im
  3-Zeilen-Endlosmodus konsistent weiter funktionieren.
- Das Verhalten ausserhalb des Endlosmodus bleibt unveraendert.

### 5. Abgrenzung

- Diese Aufgabe veraendert den Endlosmodus im heutigen Produktpfad
  `sheetMusicReading`.
- Legacy-Dateien unter `sheetMusicMic` sind nicht der primaere
  Implementierungsort.

---

## Fachliche Testfaelle

### Grundfaelle

- Nutzer aktiviert den Endlosmodus und sieht genau 3 `score-row`-Zeilen.
- Nutzer startet die Wiedergabe und der Playback-Fortschritt beginnt in der
  ersten sichtbaren Zeile.
- Beim Uebergang zur zweiten und dritten Zeile bleibt die Anzahl sichtbarer
  Zeilen bei genau 3.

### Gleitendes Fenster

- Nach mehreren Zeilenwechseln wurde die aelteste Zeile jeweils entfernt und
  unten eine neue Zeile angehaengt.
- Der Playback-Cursor ist immer nur auf der aktuell relevanten Zeile sichtbar.
- Bereits verlassene Zeilen bleiben nicht unkontrolliert im DOM erhalten.

### Scroll-Verhalten

- Beim Wechsel zur naechsten Zeile scrollt die Ansicht weich statt
  sprunghaft.
- Das Scrollen bleibt auch ueber mehrere Zeilenwechsel visuell stabil.
- Das Entfernen der obersten Zeile fuehrt nicht zu einem sichtbaren
  Scroll-Sprung.

### Tabs aktiviert

- Bei aktivierten Tabs existieren ebenfalls dauerhaft genau 3 `score-row`.
- Jede Zeile enthaelt weiterhin ihre zugehoerige Noten- und Tab-Darstellung.
- Das Scroll-Verhalten bleibt auch bei groesserer Zeilenhoehe stabil.

### Regressionen

- Das Umschalten von Tabs regeneriert die Endlosansicht konsistent.
- Das Aendern von Taktart, BPM, Bunden oder Saiten funktioniert weiterhin im
  Endlosmodus.
- Der normale Nicht-Endlosmodus rendert weiterhin die bestehende 4-Takt-Ansicht.

---

## Technischer Zuschnitt

### Voraussichtlich betroffene Dateien

- `js/games/sheetMusicReading/sheetMusicReading.js`
- optional `style.css`
- Tests in `tests/unit/sheetMusicReadingController.test.js`
- optional weitere Tests fuer Scroll-/Endlosverhalten

### Bestehender Stand

- Der Endlosmodus rendert heute initial `1 + LOOKAHEAD_ROWS`, aktuell also 3
  Zeilen.
- Danach werden bei fortschreitender Wiedergabe unbegrenzt weitere Zeilen
  angehaengt.
- Die Scroll-Logik orientiert sich derzeit an einer vereinfachten
  Zeilenhoehen-Annahme.

### Technische Leitidee

- Das aktuelle unbounded-Append-Verhalten wird durch ein echtes
  **Sliding-Window mit fester Groesse 3** ersetzt.
- Globaler Wiedergabe-Fortschritt und lokal sichtbare Zeilenposition muessen
  voneinander getrennt modelliert werden.
- Die Scroll-Logik soll auf **realen DOM-Hoehen bzw. DOM-Positionen** basieren,
  damit der Fall mit Tabs korrekt abgedeckt ist.

---

## Phasen

### Phase 1: Endlosfenster fachlich und technisch festziehen

**Ziel**

- Das Endlosmodell wird von „immer weiter anhaengen“ auf „genau 3 Zeilen im
  gleitenden Fenster“ umgestellt.

**Validierung**

- Klarer Lebenszyklus fuer Hinzufuegen, Anzeigen und Entfernen von Zeilen.
- Kein unkontrolliertes Anwachsen von `allRowDivs` / `allPlaybackBars`.

### Phase 2: Zeilenwechsel mit weichem Scrollen

**Ziel**

- Beim Wechsel zur naechsten Zeile entsteht ein bewusst weicher,
  langsamer Scroll-Uebergang.

**Validierung**

- Kein harter Sprung beim Fortschritt in die naechste Zeile.
- Kein sichtbarer Versatz durch das Entfernen der obersten Zeile.

### Phase 3: Tabs und variable Hoehen absichern

**Ziel**

- Die Loesung funktioniert identisch mit und ohne Tabs.

**Validierung**

- Scroll-Berechnung verlaesst sich nicht auf eine fixe Referenzhoehe.
- Eine `score-row` mit Tab bleibt als geschlossene Einheit intakt.

### Phase 4: Regressionen und Controller-Tests

**Ziel**

- Das neue Verhalten wird durch gezielte Tests abgesichert.

**Validierung**

- Tests decken Initialzustand, mehrere Zeilenwechsel, Tabs und Reset ab.

---

## Risiken und offene Fragen

- Hoechstes Risiko ist ein sichtbarer Scroll-Sprung, wenn die oberste Zeile zu
  frueh aus dem DOM entfernt wird.
- Zweites Risiko ist ein Mapping-Fehler zwischen globalem `barIndex` und der
  lokal sichtbaren Zeile nach mehreren Fenster-Verschiebungen.
- Bei aktivierten Tabs koennen groessere oder variable Zeilenhoehen fruehere
  Annahmen ueber `offsetHeight` unbrauchbar machen.
- Falls der aktive Modus denselben Endlospfad nutzt, muss sichergestellt
  werden, dass Statusmarkierungen und Cursor nicht auf bereits entfernte Zeilen
  referenzieren.

---

## Umsetzungs-Default

Falls waehrend der Implementierung keine weitere Produktentscheidung noetig
wird, gilt als Default:

- exakt 3 `score-row` im Endlosmodus
- weicher, langsamer Scroll-Uebergang beim Zeilenwechsel
- Scroll-Berechnung auf Basis realer DOM-Geometrie
- Tabs werden als Teil derselben Zeile mitgefuehrt

---

## Naechster Schritt

Die Umsetzung ist im aktiven Produktpfad `sheetMusicReading` erfolgt; relevante
Controller-Tests wurden fuer das 3-Zeilen-Fenster mit optionalen Tabs
ergaenzt.
