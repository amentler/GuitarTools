# Plan: Recorder-interne Verwaltungsansicht fuer Chord-Recordings

**Erstellt:** 2026-05-05  
**Status:** Geplant; noch nicht implementiert.

---

## Ziel

Der Akkord-Recorder erhaelt eine interne Verwaltungsansicht fuer bereits
aufgenommene Takes. Diese Verwaltungsansicht ist kein eigenes Hauptseiten- oder
App-Menue, sondern fachlich Teil des bestehenden Recorder-Tools.

Nach Abschluss der Aufgabe soll gelten:

- Der Recorder hat eine Aufnahmeansicht und eine Verwaltungsansicht.
- In der Aufnahmeansicht gibt es `Alles herunterladen` und `Verwaltung`.
- Der bisherige globale Loesch-Button verschwindet aus der Aufnahmeansicht.
- Aufgenommene Takes sind nur in der Verwaltungsansicht sichtbar.
- Takes koennen dort angehoert, einzeln geloescht und gesammelt geloescht
  werden.
- Geloeschte Takes stehen auch nicht mehr fuer den ZIP-Download zur Verfuegung.
- Recorder-Konfiguration, Akkordauswahl und Session-Zustand bleiben beim
  Wechsel zwischen Aufnahme- und Verwaltungsansicht erhalten.

---

## Fachliche Anforderungen

### 1. Recorder-interne Ansichten

- Der Recorder modelliert intern mindestens zwei Views:
  - `record`
  - `manage`
- Der Nutzer bleibt immer innerhalb des Akkord-Recorders.
- Es gibt keinen Sprung in ein globales Verwaltungsmenue der Anwendung.

### 2. Aufnahmeansicht

- Die Aufnahmeansicht behaelt ihren bestehenden Aufnahme-Flow.
- Das obere Recorder-Menue in dieser Ansicht zeigt:
  - `Alles herunterladen`
  - `Verwaltung`
- Der bisherige Button `Aufnahmen loeschen` oder `Alle Aufnahmen loeschen`
  wird dort entfernt.
- Die Aufnahmeansicht zeigt keine Liste vorhandener Takes.

### 3. Verwaltungsansicht

- Die Verwaltungsansicht ist innerhalb des Recorders erreichbar.
- Dort werden alle aktuell in der Session vorhandenen Takes gelistet.
- Jeder Take ist mindestens ueber Metadaten wie Akkord, Variation und
  Aufnahmezeit identifizierbar.
- Pro Take gibt es:
  - `Anhoeren`
  - `Loeschen`
- Zusaetzlich gibt es in der Verwaltungsansicht:
  - `Alle Aufnahmen loeschen`
  - `Zurueck zur Aufnahme`

### 4. Sichtbarkeit und Lebensdauer der Takes

- Takes sind nur in der Verwaltungsansicht sichtbar.
- Die zugrunde liegenden Aufnahmen bleiben Session-basiert.
- Ein Reload der Seite darf die Session-Inhalte weiterhin verwerfen, solange
  keine andere Persistenz explizit eingefuehrt wird.

### 5. Download- und Loeschkonsistenz

- `Alles herunterladen` verwendet dieselbe Aufnahmeliste wie die
  Verwaltungsansicht.
- Einzelgeloeschte Takes fehlen im spaeteren ZIP-Download.
- `Alle Aufnahmen loeschen` leert die Verwaltungsansicht und den
  Download-Bestand konsistent.

### 6. Navigation und Zustandserhalt

- Der Wechsel von `record` nach `manage` darf keine Recorder-Konfiguration
  verlieren.
- Ausgewaehlter Akkord, Varianten-Setup und sonstiger Session-Zustand bleiben
  erhalten.
- Die Rueckkehr aus `manage` fuehrt direkt wieder in die Aufnahmeansicht.

---

## Fachliche Testfaelle

### Menue und Navigation

- Recorder startet wie bisher in der Aufnahmeansicht.
- In der Aufnahmeansicht sind `Alles herunterladen` und `Verwaltung` sichtbar.
- In der Aufnahmeansicht ist kein globaler Loesch-Button mehr sichtbar.
- Klick auf `Verwaltung` wechselt in die recorder-interne Verwaltungsansicht.
- Klick auf `Zurueck zur Aufnahme` kehrt in die Aufnahmeansicht zurueck.

### Sichtbarkeit der Takes

- In der Aufnahmeansicht ist keine Take-Liste sichtbar.
- In der Verwaltungsansicht werden vorhandene Session-Takes angezeigt.
- Ohne vorhandene Takes zeigt die Verwaltungsansicht einen klaren Leerzustand.

### Playback

- Ein Take laesst sich in der Verwaltungsansicht anhoeren.
- Beim Start eines zweiten Takes stoppt ein eventuell bereits laufender Take.
- Beim Verlassen der Verwaltungsansicht stoppt laufendes Playback sauber.

### Einzelloeschen

- Ein einzelner Take laesst sich loeschen.
- Nach dem Loeschen verschwindet der Take sofort aus der Liste.
- Nach dem Loeschen ist derselbe Take nicht mehr im ZIP-Download enthalten.

### Gesamtes Loeschen

- `Alle Aufnahmen loeschen` entfernt alle Takes aus der Verwaltungsansicht.
- Nach Gesamtes-Loeschen ist auch der Download-Bestand leer.

### Zustandserhalt

- Nach Rueckkehr in die Aufnahmeansicht bleiben Akkordauswahl und
  Setup-Einstellungen erhalten.
- Der Nutzer kann nach Rueckkehr ohne Neukonfiguration weiter aufnehmen.

---

## Technischer Zuschnitt

### Im Scope

- `js/tools/chordRecorder/chordRecorder.js`
- `js/tools/chordRecorder/chordRecorderUI.js`
- ein bestehender oder neuer Recording-Store-/Files-Baustein fuer
  Session-Aufnahmen
- zugehoerige Unit-, Smoke- oder DOM-nahe Tests fuer Recorder-Menue,
  Verwaltungsansicht und Loesch-/Playback-Logik

### Technische Leitidee

- `chordRecorder.js` wird zentraler View-Controller fuer `record` und `manage`.
- Die Aufnahmeansicht und die Verwaltungsansicht werden innerhalb desselben
  Tools gerendert.
- Die Aufnahmeliste wird als einzige Quelle fuer:
  - Verwaltungsanzeige
  - Einzel- und Gesamtes-Loeschen
  - ZIP-Download
  verwendet.
- Playback wird getrennt vom Aufnahme-Flow gekapselt, damit immer nur ein Take
  gleichzeitig aktiv sein kann.

### Voraussichtliche Struktur

- View-State im Recorder:
  - `currentView = 'record' | 'manage'`
- Session-Store pro Take mit mindestens:
  - `id`
  - `blob` oder abspielbare Referenz
  - Metadaten
  - Zeitstempel
- Verwaltungs-UI mit Listenrendering, Leerzustand und Aktionsbuttons

---

## Phasen

### Phase 1: View-State und Zustandsmodell

**Ziel**

- Recorder-internes Umschalten zwischen `record` und `manage` einfuehren.
- Bestehenden Recorder-Zustand gegen unbeabsichtigten Reset absichern.

**Validierung**

- View-Wechsel funktioniert ohne Verlust von Auswahl- und Setup-Zustand.

### Phase 2: Menueumbau in der Aufnahmeansicht

**Ziel**

- `Verwaltung` im oberen Recorder-Menue ergaenzen.
- Globalen Loesch-Button aus der Aufnahmeansicht entfernen.

**Validierung**

- Aufnahmeansicht zeigt nur noch die gewuenschten Recorder-Aktionen.

### Phase 3: Recording-Store konsolidieren

**Ziel**

- Session-Aufnahmen als konsistente, verwaltbare Datensaetze bereitstellen.
- Sicherstellen, dass Download und Verwaltungsansicht dieselbe Datenquelle
  nutzen.

**Validierung**

- Neue Aufnahmen erscheinen im Store und sind fuer Download und Verwaltung
  identisch verfuegbar.

### Phase 4: Verwaltungsansicht implementieren

**Ziel**

- Recorder-interne Verwaltungsansicht mit Liste, Leerzustand, `Anhoeren`,
  `Loeschen`, `Alle Aufnahmen loeschen` und `Zurueck zur Aufnahme` bauen.

**Validierung**

- Takes sind nur in `manage` sichtbar und dort vollstaendig bedienbar.

### Phase 5: Playback-Steuerung absichern

**Ziel**

- Abspielen, Stoppen, Umschalten und Aufraeumen sauber kapseln.

**Validierung**

- Kein Parallel-Playback, kein haengender Zustand bei Loeschen oder View-Wechsel.

### Phase 6: Regressionen und Tests

**Ziel**

- Bestehenden Recorder-Flow gegen Seiteneffekte absichern.
- Navigation, Loeschung, Download-Konsistenz und Zustandserhalt pruefen.

**Validierung**

- Aufnahmefluss, Verwaltungsfluss und Download funktionieren gemeinsam stabil.

---

## Risiken / Offene Fragen

- Falls Aufnahmen aktuell noch nicht als sauberer Session-Datensatz modelliert
  sind, muss der Store vor der UI nachgezogen werden.
- Falls fuer Playback `ObjectURL`s verwendet werden, muessen diese bei
  Einzelloeschen, Gesamtes-Loeschen und View-Abbau freigegeben werden.
- Falls waehrend einer laufenden Aufnahme in die Verwaltung gewechselt werden
  koennte, braucht es eine klare Sperre oder einen definierten Abbruch.
- Die Verwaltungsansicht sollte keine zweite parallele Wahrheit neben dem
  Download-Store aufbauen.

---

## Implementierungsdefaults

- Die Verwaltungsansicht wird als zweiter interner Screen im bestehenden
  `chordRecorder` umgesetzt.
- Es gibt einen expliziten Button `Zurueck zur Aufnahme`.
- Takes bleiben Session-basiert und werden nicht ueber Reload hinaus persistiert.
- Navigation in die Verwaltung ist nur sinnvoll, wenn keine aktive Aufnahme
  laeuft; falls noetig wird das technisch abgesichert.
