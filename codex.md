# Codex – Ist-Zustand GuitarTools

Stand: 2026-04-21

## 1) Projektüberblick

- Stack: Vanilla HTML/CSS/JS (ES Modules), SVG-Rendering, Web Audio API, PWA (Service Worker + Manifest)
- Kein Build-Step, direkte Ausführung als statische GitHub-Pages-App
- Hauptbereiche:
  - `index.html`, `style.css`, `js/app.js` (Navigation/View-Wechsel)
  - Übungen unter `js/games/*`
  - Tools unter `js/tools/*`
  - Laufzeit-Registry unter `js/exerciseRegistry.js`
  - Roadmap in `plans/*.md`

## 2) Code- und Architekturstatus

Status:
- Klare modulare Trennung pro Feature (Controller/Logik/SVG in separaten Dateien)
- Wiederverwendung von Logikmodulen (z. B. Fretboard-Logik)
- Navigation über `js/app.js` + `exerciseRegistry.js` (keine harte if/else-Verkettung pro Übung)
- PWA-Basis vorhanden (`sw.js`, `manifest.json`)
- Service Worker mit gemischter Strategie:
  - `js/lib/essentia/*`: Cache-First
  - übrige GET-Requests: Network-First mit Cache-Fallback bei Offline

Qualitätsmanagement (Ist):
- CI-Workflow (`.github/workflows/ci.yml`) führt bei `push` und `pull_request` aus:
  - `npm ci`
  - `npm run lint`
  - `npm test`
- Lokal verifiziert am 2026-04-21:
  - `npm run lint` erfolgreich
  - `npm test` erfolgreich: 31 Testdateien, 677 Tests grün, 1 Test übersprungen

## 3) Dokumentations- und Agentenstatus

- Root-Policies in `CLAUDE.md` und `GEMINI.md` vorhanden (Vanilla + SVG, Doku-Updates gefordert)
- Feature-spezifische `CLAUDE.md`-Dateien in Untermodulen vorhanden

## 4) Commit-Checkliste (verbindlich)

Vor jedem Commit:
- `version.txt` aktualisieren
- Format strikt einhalten: `Version YYYY-MM-DD HH:MM | label`
- Label muss den Change benennen (z. B. `ton spielen layout update 3`)
- Danach erst `npm run lint`/`npm test` und Commit erstellen
