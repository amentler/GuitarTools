# Plan: Fretboard-Tone-Recognition E2E-Probleme

**Stand:** 2026-05-02  
**Status:** Offen / Analyse- und Reparaturplan

---

## Bezug

- `tests/e2e/fretboard-tone-recognition.spec.js`
- `pages/fretboard-tone-recognition/index.html`
- `pages/fretboard-tone-recognition/bootstrap.js`
- `js/...` rund um die aktuelle `<gt-fretboard>`-Integration der Griffbrett-Erkennung

---

## Ausgangslage

Der aktuelle Repo-Stand hat:

- `npm test` grün
- Chord-Fingerprint verbessert
- aber `npm run test:e2e` nicht vollständig grün

Offen sind genau drei Playwright-Fälle in:

- `tests/e2e/fretboard-tone-recognition.spec.js`

Alle drei Fehler betreffen die Darstellung bzw. Platzierung der Zielmarker im
Fretboard-Tone-Recognition-Screen.

---

## Reproduzierbarer Stand

Ausführen:

```bash
npm run test:e2e
```

Aktueller Befund:

- `55` E2E-Tests grün
- `3` E2E-Tests rot
- alle drei Fehler in `tests/e2e/fretboard-tone-recognition.spec.js`

Artefakte liegen unter `test-results/...` mit:

- Screenshot
- Video
- `error-context.md`
- Playwright-Trace (`trace.zip`)

---

## Offene Fehler

### 1. Open-String-Marker fehlt

Test:

- `shows an open-string target marker left of the fretboard when the mocked draw picks fret 0`

Fehlerbild:

- Locator `gt-fretboard circle[fill="none"][stroke="#ff6b35"]`
  liefert `0` statt `1`

Bedeutung:

- Der erwartete Open-String-Zielmarker wird gar nicht gerendert
  oder nicht mehr mit den bisherigen SVG-Attributen gerendert.

---

### 2. Fret-Marker sitzt nicht auf der erwarteten Placeholder-Position

Test:

- `shows a filled fret marker on the fretboard when the mocked draw picks a fretted note`

Fehlerbild:

- `circle[data-string="2"][data-fret="3"]` existiert
- aber `cx` des erwarteten Placeholder-Kreises passt nicht zum tatsächlichen
  Marker
- konkret: erwartet wurde die Placeholder-Position, erhalten wurde ein Marker
  an anderer X-Koordinate (`362` statt `123`)

Bedeutung:

- Entweder ist die Fret-/String-Zuordnung im Test überholt
- oder die neue Renderlogik positioniert Marker bewusst anders als der Test
  annimmt
- oder Placeholder und sichtbarer Marker folgen nicht mehr demselben
  Koordinatensystem

---

### 3. Bundnummer `1` wird im Open-String-Only-Modus nicht gerendert

Test:

- `keeps the first fret visible in open-string-only mode without rendering fret markers on the board`

Fehlerbild:

- Locator `gt-fretboard text` mit Inhalt `1` liefert `0` statt `1`

Bedeutung:

- Im Modus `frets="0"` wird die erste sichtbare Bundnummer nicht mehr
  eingeblendet
- oder das Fretboard rendert in diesem Modus andere Texte/Labels
- oder der Test hängt an einer älteren Darstellungskonvention

---

## Wahrscheinliche Ursachen

### A. Testannahmen passen nicht mehr exakt zur neuen `<gt-fretboard>`-Darstellung

Hinweise:

- Die übrigen Fretboard-E2Es (`tests/e2e/fretboard-unified.spec.js`) sind grün.
- Die Fehlbilder sprechen eher für geänderte Renderdetails als für einen
  kompletten Funktionsausfall.

Konkrete Verdachtsmomente:

- SVG-Attribute (`fill`, `stroke`) könnten sich geändert haben
- Open-String-Marker könnte mit anderem Elementtyp oder anderer Farbe gerendert
  werden
- Fret-Placeholder-Kreise könnten nicht mehr der richtigen Ordnungslogik aus
  der alten Spec entsprechen

### B. Der Exercise-Screen mappt Zielnoten anders auf das Fretboard

Hinweise:

- Der zweite Fehler deutet auf eine Diskrepanz zwischen erwartetem
  `data-string`/`data-fret` und tatsächlicher Marker-Position.

Konkrete Verdachtsmomente:

- die Random-Mock-Sequenz trifft heute andere Noten als beim Schreiben des Tests
- die Auswahl-/Mapping-Logik für Zieltöne wurde geändert
- die Komponente bevorzugt inzwischen andere Saiten-/Lagenrepräsentationen

### C. Open-String-/Zero-Fret-Sonderfall wird visuell anders behandelt

Hinweise:

- Fehler 1 und 3 betreffen beide `fret 0`
- möglich ist eine gezielte Sonderlogik für offene Saiten, die von der Spec
  nicht mehr korrekt beobachtet wird

---

## Analyseplan

### Phase 1: Ist-Renderzustand sichtbar machen

Ziel:

- Verstehen, was die Seite tatsächlich rendert, bevor an Produktionscode
  geschraubt wird.

Maßnahmen:

- Playwright-Trace der drei Fälle öffnen
- Screenshot/DOM/SVG-Struktur prüfen
- prüfen, ob die erwarteten Marker existieren, aber mit anderen Attributen

Validierung:

- Für jeden der drei Fehler ist klar, ob der Test oder die UI-Annahme veraltet
  ist

### Phase 2: Zielnoten-Mapping prüfen

Ziel:

- Klären, welche Zielnote aus der Random-Folge tatsächlich gezogen wird und auf
  welche Fretboard-Position sie gemappt wird.

Maßnahmen:

- Logik für Zufallsauswahl im Tone-Recognition-Screen lesen
- prüfen, welche Note bei den Mock-Sequenzen `[0.01, 0.01]` und
  `[0.34, 0.65]` gezogen wird
- DOM-/Debug-Zustand gegen Testannahmen vergleichen

Validierung:

- Für den roten Fretted-Case ist eindeutig, ob
  `data-string="2"[data-fret="3"]` fachlich noch die richtige Erwartung ist

### Phase 3: Entscheidung Test-Fix vs. Code-Fix

Ziel:

- Nur echte Regressionen im Produktionscode reparieren, nicht veraltete Tests
  künstlich erzwingen.

Entscheidungsregeln:

- Wenn die UI fachlich korrekt ist und nur andere SVG-Details nutzt:
  Test anpassen
- Wenn die Zielnote falsch positioniert oder gar nicht sichtbar ist:
  Produktionscode reparieren
- Wenn Open-String-/Zero-Fret-Handling unklar ist:
  gewünschte UX explizit festlegen und danach implementieren

---

## Offene Fragen

- Soll der Test an exakten SVG-Attributen (`fill`, `stroke`, `cx`, `cy`)
  hängen, oder brauchen wir robustere Debug-Hooks / `data-*`-Marker?
- Ist die aktuelle Notenauswahl absichtlich auf andere Saiten-/Lagen
  umgestellt worden?
- Soll im `frets="0"`-Modus die Bundnummer `1` zwingend sichtbar bleiben,
  oder ist die neue Darstellung ohne sichtbare `1` fachlich akzeptabel?

---

## Empfehlung

Nicht blind den Produktionscode auf die alten Playwright-Selektoren zurückbiegen.

Zuerst sollte entschieden werden:

1. Ist die aktuelle UI fachlich korrekt und nur die Spec veraltet?
2. Oder liegt tatsächlich eine Regression im Tone-Recognition-Screen vor?

Erst danach:

- entweder Tests robuster machen
- oder die Fretboard-Rendering-/Mapping-Logik gezielt reparieren

