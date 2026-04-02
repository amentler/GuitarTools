# CI- und Qualitätspipeline – Roadmap

Stand: 2026-04-02

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
| **Phase 0** | Dokumentation, Planung, Scope-Abgrenzung | – (dieser PR) |
| **Phase 1** | Minimale CI-Pipeline: `package.json` + Testrunner + erste Unit-Tests für Logikmodule | Phase 0 |
| **Phase 2** | Linting (ESLint) in der Pipeline | Phase 1 |
| **Phase 3** | TypeScript-Prüfung (`tsc --noEmit`, `checkJs`) | Phase 2 |
| **Phase 4** | Schrittweise TS-Migration der Logikmodule | Phase 3 |
| **Phase 5** | Browsernahe Tests (Playwright Smoke Tests) | Phase 1 oder 3 |
| **Phase 6** | Branch Protection + Pflicht-Statusprüfungen | Phase 1 |

---

## 3. Phase 1 – Definition

### Scope

- `package.json` mit minimalem Dev-Tooling anlegen
- Test-Runner einrichten (bevorzugt **Vitest**, da gut mit ES Modules und ohne Transpilation)
- **Erste Unit-Tests** für `fretboardLogic.js` und `tunerLogic.js` (ca. 10–15 Tests)
- **GitHub Actions Workflow** für automatische Testausführung bei `push` und `pull_request`

### Minimaler sichtbarer Nutzen

- Jeder Push löst automatisch Tests aus
- GitHub zeigt grün/rot direkt beim Pull Request
- Fehler in zentralen Logikfunktionen werden sofort erkannt

### Was Phase 1 demonstriert

- Die Pipeline läuft und tut messbar etwas
- Der Workflow funktioniert mit dem Vanilla-JS/ES-Modules-Aufbau
- Tests für reine Logikfunktionen sind ohne Build-Umbau möglich
- Grundlage für alle weiteren Phasen ist gesetzt

### Bevorzugte Variante: Vitest (nicht Jest)

Vitest kommt ohne CommonJS-Konversion aus und unterstützt ES Modules nativ – passend zur
bestehenden Modulstruktur. Jest würde eine zusätzliche Transformation benötigen. Vitest lässt
sich später auch mit `jsdom` für einfache DOM-Tests erweitern.

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

## 5. Aufgabenteilung: Agent vs. manuell

### Was ein Agent automatisiert umsetzen kann

- `package.json` anlegen (mit `vitest` als Dev-Dependency)
- `vitest.config.js` anlegen
- Testdateien erstellen: `tests/unit/fretboardLogic.test.js`, `tests/unit/tunerLogic.test.js`
- `.github/workflows/test.yml` erstellen (Trigger: `push`, `pull_request`)
- Dokumentation aktualisieren

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
