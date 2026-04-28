# CI- und Qualitätspipeline – Roadmap

Stand: 2026-04-21

## 1. Aktueller Zustand

GuitarTools ist eine statische Web-App ohne Build-Schritt. Die Qualitätssicherung läuft über Linting und Tests in GitHub Actions.

CI-Workflow (`.github/workflows/ci.yml`):
- Trigger: `push`, `pull_request`
- Runtime: Node.js 22
- Jobs:
  - `lint` -> `npm run lint`
  - `unit` -> `npm run test:ci`
  - `audio` -> `npm run test:audio`

Lokal verifiziert am 2026-04-29:
- `npm run test:unit`: erfolgreich
- `npm run test:audio`: erfolgreich

## 2. Scope der Teststrategie

Schwerpunkt:
- Reine Logikmodule und zentrale Controllerpfade
- Audio-/Fixture-basierte Tests für Tuner, Note-Matching und Akkorderkennung
- Rendering- und Integrationsnahe Unit-Tests in `jsdom`, wo sinnvoll

Bewusste Grenzen:
- Keine E2E-Browser-Tests (Playwright/Cypress) im aktuellen Setup
- Kein TypeScript-Compile-Check (`tsc --noEmit`), da Projekt auf Vanilla JS ausgelegt ist

## 3. Nächste sinnvolle Schritte

1. Branch Protection fuer die getrennten Pflichtstatus (`lint`, `unit`, `audio`) aktivieren, falls noch nicht gesetzt.
2. Flaky-Test-Monitoring fuer die Audio-Suite ergänzen, falls wiederkehrende Timing-Probleme sichtbar werden.
3. Optional: schlanke Smoke-E2E-Tests für Kernflows (Startseite, Navigation, Tuner-Start, eine Übung starten/beenden).
4. Optional: Coverage-Reporting nur für Kernlogik einführen, nicht als hartes Merge-Kriterium.

## 4. Pflegehinweis

Diese Datei ist ein aktueller Snapshot, kein Phasenprotokoll. Nach größeren CI- oder Teständerungen Datum und Kennzahlen aktualisieren.
