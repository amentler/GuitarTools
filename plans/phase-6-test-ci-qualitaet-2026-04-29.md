# Plan: Phase 6 – Test- und CI-Qualitaet verbessern

Stand: 2026-04-29
Status: In Umsetzung
Quelle: [plans/architektur-review-plan-2026-04-21.md](/home/azureuserhauptmann/privat/GuitarTools/plans/architektur-review-plan-2026-04-21.md)

## Ziel

Phase 6 soll die Test- und CI-Pipeline so schneiden, dass:

- schnelle Rueckmeldung fuer normale Aenderungen existiert
- langsame oder fixturelastige Suites getrennt laufen
- der CI-Workflow diese Trennung explizit abbildet
- mindestens eine architekturkritische Regel automatisiert abgesichert ist

## Nicht Ziel

- keine grossen inhaltlichen Refactors an Feature-Code
- keine neuen Produktfeatures
- keine E2E-Ausweitung ueber die vorhandenen Playwright-Tests hinaus, sofern nicht fuer Phase 6 zwingend

## Aktueller Befund

- `package.json` hat nur `test` und `test:e2e`, aber keine klar getrennten Unit-/Audio-/CI-Skripte.
- `.github/workflows/ci.yml` fuehrt derzeit nur `npm run lint` und `npm test` aus.
- Smoke-Tests fuer Pages sind weitgehend vorhanden.
- Es gibt Hinweise auf Suite-Stabilitaetsprobleme im Volltestlauf, waehrend Einzel- oder Teilruns stabiler wirken.
- Architekturkritische Regeln sind bisher nur teilweise automatisiert, z. B. fuer Page-Struktur.

## Fachliche Anforderungen

### Muss

1. Es gibt getrennte Testskripte fuer:
   - schnelle Unit-/Smoke-Suites
   - langsamere Audio-/Fixture-Suites
   - den Standard-CI-Lauf
2. GitHub Actions verwendet diese Trennung sichtbar und nachvollziehbar.
3. Mindestens eine Architekturregel wird durch einen automatisierten Test abgesichert.
4. Der Plan wird waehrend der Umsetzung fortlaufend aktualisiert.
5. Nach jedem abgeschlossenen Umsetzungsschritt erfolgt ein eigener Commit.

### Soll

1. Die neue Struktur soll bestehende lokale Workflows nicht unnoetig erschweren.
2. Die Trennung soll primär ueber vorhandene Dateimuster und Suite-Struktur erfolgen, nicht ueber komplexe neue Infrastruktur.

### Kann

1. E2E kann spaeter als eigener CI-Job nachgezogen werden, ist aber nicht Muss fuer diesen Schritt.
2. Weitere Architekturregeln koennen spaeter auf Basis des ersten Guard-Tests folgen.

## Technischer Ansatz

### Test-Skripte

- `test:unit`: schneller Standardlauf ohne die klar langsamen Audio-/Fixture-Suites
- `test:audio`: gebuendelte Audio-/Fixture-/Sequence-Suites
- `test:ci`: der zulaessige CI-Standardlauf fuer Pull Requests und Pushes

### CI-Schnitt

- eigener `lint`-Job
- eigener `unit`-Job
- eigener `audio`-Job
- gleiche Node-Version und `npm ci`-Setup wie bisher

### Architektur-Guard

Ein neuer Test prueft mindestens:

- `js/components/**` darf nicht aus `js/games/**` oder `js/tools/**` importieren
- `js/tools/**` darf nicht aus `js/games/**` importieren

Die Regel wird nur dort eingefuehrt, wo der Ist-Zustand sie bereits plausibel erfuellt.

## Phasen und Commit-Schritte

### Schritt 1 – Plan anlegen

Ziel:
- dieses Dokument anlegen
- aktive Planlandschaft auf Phase 6 verlinken

Validierung:
- Plan liegt unter `plans/`
- Status und Commit-Schritte sind dokumentiert

Commit:
- `docs: add phase 6 execution plan`

Status: Abgeschlossen

### Schritt 2 – Testskripte splitten

Ziel:
- `package.json` um `test:unit`, `test:audio`, `test:ci` erweitern
- geeignete Zuordnung der bestehenden Tests festlegen

Validierung:
- neue Skripte laufen lokal
- `test:unit` bleibt spuerbar kleiner als der Volltestlauf

Commit:
- `test: split unit and audio test scripts`

Status: Abgeschlossen

Umgesetzt:

- `package.json` enthaelt jetzt `test:unit`, `test:audio` und `test:ci`.
- `test:unit` schliesst die klar schweren Signal-/Fixture-/Sequence-Suites explizit aus.
- `test:audio` buendelt die schweren Suites inklusive `pitchLogic.test.js`.
- `tests/unit/tunerAudio.test.js` erhielt eine groessere Timeout-Budgetierung fuer reale Low-String-Fixtures.

Validiert:

- `npm run test:unit` -> gruen
- `npm run test:audio` -> gruen

### Schritt 3 – CI auf die neue Struktur umstellen

Ziel:
- Workflow in getrennte Jobs oder klar getrennte Schritte ueberfuehren
- Roadmap-/Doku-Datei an den neuen Zustand anpassen

Validierung:
- Workflow-Datei referenziert die neuen Skripte
- Doku beschreibt den neuen Standardlauf korrekt

Commit:
- `ci: split lint unit and audio jobs`

Status: Offen

### Schritt 4 – Architektur-Guard automatisieren

Ziel:
- neuen Guard-Test fuer derzeit realistische Abhaengigkeitsgrenzen einfuehren

Validierung:
- Test ist gruen
- Guard ist in `test:unit` oder `test:ci` enthalten

Commit:
- `test: add architecture boundary guards`

Status: Offen

### Schritt 5 – Abschluss und Restpunkte

Ziel:
- Planstatus aktualisieren
- offene Restthemen explizit benennen

Validierung:
- Plan dokumentiert, was erledigt ist und was bewusst spaeter bleibt

Commit:
- `docs: update phase 6 progress`

Status: Offen

## Testfaelle

### Fuer Skript-Schnitt

- `npm run test:unit` laeuft ohne die ausgeschlossenen langsamen Audio-/Fixture-Suites.
- `npm run test:audio` enthaelt genau die ausgegliederten Suites.
- `npm run test:ci` bildet den gewollten Standardlauf ab.

### Fuer CI

- Workflow verwendet `npm run lint`, `npm run test:ci` und `npm run test:audio` explizit.
- Jobnamen machen sichtbar, welcher Teil fehlschlaegt.

### Fuer Architektur-Guard

- Ein absichtlich verbotener Importpfad aus `components` nach `games` wuerde den Test rot machen.
- Bestehende erlaubte Imports nach `domain`, `shared`, `data` oder lokale Nachbarn bleiben erlaubt.

## Risiken / Offene Punkte

- Die genaue Zuordnung langsamer Suites kann nach erstem Messwert nachgeschaerft werden.
- Ein Teil der Flaky-/Timing-Probleme wird durch die Trennung sichtbar gemacht, aber nicht automatisch fachlich geloest.
- E2E ist bewusst nicht Kern dieser Phase, weil sonst die Phase unnötig gross wird.
