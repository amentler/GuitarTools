# Codex – Ist-Zustand GuitarTools

Stand: 2026-04-02

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
- Keine automatisierten Tests (Unit/Integration/E2E)
- Keine Linting-/Formatierungspipeline
- Keine CI-Workflows
- Service-Worker-Assetliste wird manuell versionsgeführt
- Qualitätssicherung aktuell primär manuell
- **Phase 0 abgeschlossen:** Roadmap und Scope-Abgrenzung dokumentiert in `docs/ci-quality-roadmap.md`

## 3) Dokumentations- und Agentenstatus

- Root-Policies in `CLAUDE.md` und `GEMINI.md` vorhanden (Vanilla + SVG, Doku-Updates gefordert)
- In `plans/metronom.md` ist der Metronom-Plan als abgeschlossen dokumentiert
- Feature-spezifische `CLAUDE.md`-Dateien in Untermodulen vorhanden
