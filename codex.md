# Codex – Ist-Zustand GuitarTools

Stand: 2026-04-03 (Phase 2 abgeschlossen)

## 1) Projektüberblick

- Stack: Vanilla HTML/CSS/JS (ES Modules), SVG-Rendering, Web Audio API, PWA (Service Worker + Manifest)
- Kein Build-Step, direkte Ausführung als statische GitHub-Pages-App
- Hauptbereiche:
  - `index.html`, `style.css`, `js/app.js` (Navigation/View-Wechsel)
  - Spiele unter `js/games/*`
  - Tools unter `js/tools/*`
  - Roadmap in `plans/*.md`

## 2) Code- und Architekturstatus

Status:
- Klare modulare Trennung pro Feature (Controller/Logik/SVG in separaten Dateien)
- Wiederverwendung von Logikmodulen (z. B. Fretboard-Logik)
- Navigation in `js/app.js` über View-Wechsel
- PWA-Basis vorhanden (`sw.js`, `manifest.json`)

Qualitätsmanagement (Ist):
- **Phase 0 abgeschlossen:** Roadmap und Scope-Abgrenzung dokumentiert in `docs/ci-quality-roadmap.md`
- **Phase 1 abgeschlossen/erweitert:** CI-Pipeline eingerichtet und Unit-Testabdeckung ausgebaut
  - `package.json` + Vitest als Dev-Dependency
  - `vitest.config.js`
  - 36 Unit-Tests für `fretboardLogic.js`, `tunerLogic.js`, `tonFinderLogic.js`, `akkordLogic.js`, `sheetMusicLogic.js` unter `tests/unit/`
  - GitHub Actions Workflow (`.github/workflows/ci.yml`) bei `push` und `pull_request`
- **Phase 2 abgeschlossen:** ESLint eingerichtet, Lint-Schritt in CI integriert
  - `eslint.config.js` mit minimalen Regeln (Browser + ES Modules)
  - `npm run lint` Script in `package.json`
  - CI-Workflow führt jetzt Lint vor Tests aus
  - 8 vorhandene Linting-Fehler in JS-Modulen korrigiert
  - 10 neue Unit-Tests für `metronomeLogic.js` hinzugefügt (gesamt: 46 Tests)
- Kein TypeScript (Phase 3–4)
- Service-Worker-Assetliste wird manuell versionsgeführt
- Service Worker nutzt **Network-First-Strategie**: Netzwerk bevorzugt, Cache als Fallback bei Offline

## 3) Dokumentations- und Agentenstatus

- Root-Policies in `CLAUDE.md` und `GEMINI.md` vorhanden (Vanilla + SVG, Doku-Updates gefordert)
- In `plans/metronom.md` ist der Metronom-Plan als abgeschlossen dokumentiert
- Feature-spezifische `CLAUDE.md`-Dateien in Untermodulen vorhanden
