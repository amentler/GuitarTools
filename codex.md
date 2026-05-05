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
- Hinweis vom 2026-04-23: Die vollständige Vitest-Suite (`npm test`) kann lokal mehrere Minuten laufen, vor allem wegen Audio-/Fixture-Tests. Bei längerer Pause ohne Ausgabe nicht vorschnell als Hänger abbrechen; für schnelle Iteration gezielte `npx vitest run <testdatei>`-Aufrufe verwenden.

## 3) Dokumentations- und Agentenstatus

- Root-Policies in `CLAUDE.md` und `GEMINI.md` vorhanden (Vanilla + SVG, Doku-Updates gefordert)
- Feature-spezifische `CLAUDE.md`-Dateien in Untermodulen vorhanden

## 4) Commit-Checkliste (verbindlich)

Vor jedem Commit:
- `version.txt` **nicht** manuell bearbeiten
- `version.txt` und `sw.js` werden durch `.husky/prepare-commit-msg` via
  `scripts/auto-update-version.sh` automatisch aktualisiert und gestaged
- Commit-Titel sauber formulieren, da er in `version.txt` landet
- Danach `git status` prüfen, weil der Hook nach dem Commit bereits die naechste
  Version/CACHE-Metadatenaenderung vorbereiten kann
- Dann erst `npm run lint`/`npm test` und Commit bzw. Folge-Commit sauber
  abschliessen
