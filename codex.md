# Codex – Ist-Zustand GuitarTools

Dieses Dokument beschreibt den technischen Ist-Zustand des Projekts.

> **Operational Mandates:** All AI agents MUST follow the rules in [AGENTS.md](AGENTS.md).

## 1) Projektüberblick

- **Stack:** Vanilla HTML/CSS/JS (ES Modules), SVG-Rendering, Web Audio API, PWA (Service Worker + Manifest).
- **Deployment:** Keine Build-Pipeline, statische GitHub Pages.
- **Hauptbereiche:**
  - `index.html`, `style.css`, `js/app.js` (Navigation/View-Wechsel).
  - Übungen unter `js/games/*`.
  - Tools unter `js/tools/*`.
  - Laufzeit-Registry unter `js/exerciseRegistry.js`.
  - Roadmap in `plans/*.md`.

## 2) Code- und Architekturstatus

- **Modularität:** Klare Trennung von Controller, Logik und View (SVG/Web Components).
- **PWA:** Service Worker (`sw.js`) nutzt gemischte Strategie (Cache-First für Essentia, Network-First für den Rest).
- **Qualitätssicherung:** CI-Workflow führt Linting und Tests (Vitest) aus.
- **Test-Umfang:** Fokus auf pure Logic in `*Logic.js`. Audio-Tests nutzen WAV-Fixtures.
