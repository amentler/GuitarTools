# CI- und Qualitätspipeline – Roadmap

Stand: 2026-04-03 (Phase 2 abgeschlossen)

---

## 1. Ist-Zustand

### GitHub Pages

GuitarTools wird als statische App direkt aus dem Repository auf GitHub Pages veröffentlicht.
Es gibt keinen Build-Step: der Browser lädt `index.html` und die JS-Module unmittelbar.
Deployment und Hosting sind dadurch sehr einfach, aber auch ohne CI-Schutz – es gibt keine automatische
Prüfung vor einer Veröffentlichung.

### Vanilla JavaScript im Browser

Die gesamte Anwendungslogik ist in reinem JavaScript (ES Modules) geschrieben, ohne Framework und ohne
Transpilation. Logik und UI sind in den meisten Modulen bereits getrennt:

- **Reine Logikmodule** (gut testbar): `fretboardLogic.js`, `tunerLogic.js`
- **DOM-/SVG-nahe Module** (aufwändiger zu testen): `fretboardSVG.js`, `tunerSVG.js`, `fretboardExercise.js`, `guitarTuner.js`
- **Navigation/Routing**: `app.js`

Es gibt aktuell keine `package.json`, kein Build-Tooling und keine Testinfrastruktur.

### Spätere Testbarkeit

Die Logikmodule sind bereits weitgehend als reine Funktionen aufgebaut und bieten eine gute Basis
für Unit-Tests. Für CI-Ausführung würde ein minimales Node.js-Tooling (z. B. `package.json` + Test-Runner)
genügen, ohne die App selbst oder den Deployment-Prozess zu verändern.

Audio- und Mikrofon-abhängige Pfade (z. B. `guitarTuner.js`) sind in CI schwieriger abzudecken
und sollten zunächst durch Logik-/Mock-Tests behandelt werden.

### Spätere TypeScript-Einführung

TypeScript ist mittelfristig erwünscht, aber noch nicht eingeführt. Die aktuelle Modularisierung
ist ein guter Ausgangspunkt: Logikmodule können schrittweise migriert werden (`fretboardLogic.js` →
`fretboardLogic.ts`), ohne dass das Deployment oder die Browserausführung sofort angepasst werden muss.
Ein Transpilationsschritt wäre dafür notwendig, der sinnvollerweise erst nach einer funktionierenden
CI-Pipeline eingeführt wird.

---

## 2. Roadmap

| Phase | Inhalt | Voraussetzung |
|-------|--------|---------------|
| **Phase 0** | Dokumentation, Planung, Scope-Abgrenzung | – (abgeschlossen) |
| **Phase 1** | Minimale CI-Pipeline: `package.json` + Vitest + erste Unit-Tests für Logikmodule | Phase 0 (abgeschlossen) |
| **Phase 2** | Linting (ESLint) in der Pipeline | Phase 1 (abgeschlossen) |
| **Phase 3** | TypeScript-Prüfung (`tsc --noEmit`, `checkJs`) | Phase 2 |
| **Phase 4** | Schrittweise TS-Migration der Logikmodule | Phase 3 |
| **Phase 5** | Browsernahe Tests (Playwright Smoke Tests) | Phase 1 oder 3 |
| **Phase 6** | Branch Protection + Pflicht-Statusprüfungen | Phase 1 |

---

## 3. Phase 1 – Umgesetzt

### Umfang

- `package.json` mit Vitest als einzige Dev-Dependency angelegt
- `vitest.config.js` für ES-Module-kompatible Testkonfiguration
- **Unit-Tests** für `fretboardLogic.js`, `tunerLogic.js`, `tonFinderLogic.js`, `akkordLogic.js`, `sheetMusicLogic.js`
- **GitHub Actions Workflow** (`.github/workflows/ci.yml`) bei `push` und `pull_request`

### Neue Dateien

| Datei | Zweck |
|-------|-------|
| `package.json` | npm-Projektdatei mit `vitest` Dev-Dependency und `test`-Script |
| `vitest.config.js` | Vitest-Konfiguration (`tests/unit/**/*.test.js`) |
| `tests/unit/fretboardLogic.test.js` | Unit-Tests für Notenberechnung am Griffbrett |
| `tests/unit/tunerLogic.test.js` | Unit-Tests für Frequenz-/Notenberechnung im Tuner |
| `.github/workflows/ci.yml` | CI-Workflow: Checkout → Node setup → `npm ci` → `npm test` |
| `.gitignore` | Schließt `node_modules/` aus dem Repository aus |

### Minimaler sichtbarer Nutzen

- Jeder Push und jeder Pull Request löst automatisch die Unit-Tests aus (aktuell: 36)
- GitHub zeigt grün/rot direkt beim Pull Request
- Fehler in zentralen Logikfunktionen werden sofort erkannt

### Warum Vitest (nicht Jest)

Vitest unterstützt ES Modules nativ – passend zur bestehenden Modulstruktur ohne
CommonJS-Konversion. Lässt sich später mit `jsdom` für einfache DOM-Tests erweitern.

---

## 4. Bewusste Abgrenzung

Folgendes erfolgt **nicht** in Phase 1 und wird explizit auf spätere Phasen verschoben:

| Thema | Begründung |
|-------|------------|
| Linting (ESLint/Prettier) | Erhöht Scope und Konfigurationsaufwand, kein Muss für erste CI |
| TypeScript / `tsconfig.json` | Bewusst in Phase 3–4 verschoben |
| TypeScript-Migration | Erst nach funktionierender Basis (Phase 4) |
| Playwright / E2E-Tests | Schwergewichtiger, erst nach Phase 1 |
| Coverage-Konfiguration | Kein Selbstzweck in Phase 1 |
| Build-/Transpilationsschritt | Nicht nötig für Logik-Unit-Tests |
| Deployment-Änderungen | GitHub Pages bleibt unverändert |
| React / Vue / Angular | Nicht geplant |

---

## 4. Phase 2 – Umgesetzt

### Umfang

- **ESLint 9** (Flat Config) als Dev-Dependency hinzugefügt (`eslint`, `@eslint/js`, `globals`)
- `eslint.config.js` mit minimalen Regeln für Browser-ES-Module und Test-Dateien
- `lint`-Script in `package.json` hinzugefügt (`eslint .`)
- CI-Workflow um `npm run lint` vor `npm test` erweitert
- 8 vorhandene Linting-Fehler in bestehenden JS-Modulen korrigiert (keine Funktionsänderungen)
- **Unit-Tests** für `metronomeLogic.js` hinzugefügt (10 neue Tests → gesamt: 46)

### Neue / geänderte Dateien

| Datei | Änderung |
|-------|----------|
| `eslint.config.js` | Neu: ESLint Flat Config mit `recommended`-Regeln |
| `package.json` | `lint`-Script + neue Dev-Dependencies (`eslint`, `@eslint/js`, `globals`) |
| `.github/workflows/ci.yml` | `npm run lint` vor `npm test` |
| `tests/unit/metronomeLogic.test.js` | Neu: Unit-Tests für BPM-Clamping und Beat-Zählung |
| `js/components/fretboard/gt-fretboard-render.js` | Fix: `let stroke` ohne initialisierten Wert |
| `js/games/akkordTrainer/akkordSVG.js` | Fix: ungenutztes `stringNum` entfernt |
| `js/games/sheetMusicReading/sheetMusicSVG.js` | Fix: leere `catch`-Blöcke mit Kommentar versehen |
| `js/games/tonFinder/tonFinderSVG.js` | Fix: `let stroke` ohne initialisierten Wert |
| `js/tools/guitarTuner/guitarTuner.js` | Fix: ungenutzten `err`-Parameter im `catch` entfernt |

### Minimaler sichtbarer Nutzen

- Jeder Push und jeder Pull Request prüft jetzt: Lint (ESLint) **und** Unit-Tests (Vitest)
- Syntaxfehler, ungenutzte Variablen und offensichtliche JS-Fehler werden automatisch abgefangen
- Keine Änderungen am Funktionsverhalten der App

---

## 5. Bewusste Abgrenzung

Folgendes erfolgt **nicht** in Phase 1/2 und wird explizit auf spätere Phasen verschoben:

| Thema | Begründung |
|-------|------------|
| Prettier / Code-Formatierung | Kein Muss für Phase 2; separater Scope |
| TypeScript / `tsconfig.json` | Bewusst in Phase 3–4 verschoben |
| TypeScript-Migration | Erst nach funktionierender Basis (Phase 4) |
| Playwright / E2E-Tests | Schwergewichtiger, erst nach Phase 1 |
| Coverage-Konfiguration | Kein Selbstzweck in Phase 1/2 |
| Build-/Transpilationsschritt | Nicht nötig für Logik-Unit-Tests |
| Deployment-Änderungen | GitHub Pages bleibt unverändert |
| React / Vue / Angular | Nicht geplant |

---

## 6. Aufgabenteilung: Agent vs. manuell

### Was der Agent in Phase 1 umgesetzt hat

- `package.json` angelegt (mit `vitest` als Dev-Dependency)
- `vitest.config.js` angelegt
- Testdateien erstellt: `tests/unit/fretboardLogic.test.js`, `tests/unit/tunerLogic.test.js`
- `.github/workflows/ci.yml` erstellt (Trigger: `push`, `pull_request`)
- `.gitignore` angelegt
- Dokumentation aktualisiert

### Was der Agent in Phase 2 umgesetzt hat

- ESLint-Konfiguration (`eslint.config.js`) und `lint`-Script angelegt
- Bestehende Linting-Fehler in JS-Modulen korrigiert
- `npm run lint` im CI-Workflow ergänzt
- Unit-Tests für `metronomeLogic.js` hinzugefügt
- Dokumentation aktualisiert

### Was manuell in GitHub konfiguriert werden muss

| Schritt | Wo | Wann |
|---------|----|------|
| GitHub Pages – Deployment-Quelle prüfen | Repository → Settings → Pages | Einmalig, falls noch nicht auf „GitHub Actions" gestellt |
| Workflow-Berechtigungen prüfen | Repository → Settings → Actions → General | Einmalig, falls Actions nicht aktiv oder ohne Schreibrecht |
| Branch Protection einrichten | Repository → Settings → Branches | Nach Phase 1, wenn CI stabil läuft |
| Required Status Checks aktivieren | Branch Protection Rule | Nach Phase 1, als Qualitätsgatter |
| PR reviewen und mergen | GitHub Pull Request | Bei jedem Agent-PR |

**Hinweis:** GitHub Actions-Workflow-Dateien (`.github/workflows/*.yml`) kann der Agent direkt
anlegen. Die Ausführung startet automatisch nach dem Merge. Manuelle Eingriffe sind nur für
Repository-Settings nötig, die nicht per Datei konfigurierbar sind.
