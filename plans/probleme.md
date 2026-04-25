# Repo-Probleme

Fortlaufende Liste gefundener Probleme mit kurzer Einordnung und Beleg.

## 2026-04-24

### 1. README beschreibt eine Repo-Struktur, die so nicht mehr existiert
- Schwere: mittel
- Beleg: `README.md:93` referenziert `js/exerciseRegistry.js`, diese Datei existiert im Repo nicht.
- Beleg: Die aktuelle Struktur liegt stattdessen unter `js/games/**`, `js/tools/**`, `js/shared/**`, `js/domain/**`.
- Risiko: Neue Mitarbeitende oder spätere Refactorings arbeiten mit einer falschen mentalen Landkarte; dadurch werden Codepfade, Verantwortlichkeiten und Update-Stellen leicht falsch eingeschätzt.

### 2. Service-Worker-Cache-Version ist manuell entkoppelt von Releases
- Schwere: hoch
- Status: ✅ Gelöst (2026-04-25)
- Lösung: `scripts/auto-update-version.sh` synchronisiert jetzt `CACHE_VERSION` in `sw.js` automatisch mit `version.txt`.

### 3. Precache deckt die Mehrseiten-PWA nur unvollständig ab
- Schwere: hoch
- Status: ✅ Gelöst (2026-04-25)
- Lösung: Alle `bootstrap.js` Dateien wurden zu `PAGE_PRECACHED_URLS` in `js/shared/pwa/precacheManifest.js` hinzugefügt.

### 4. Service Worker wird nur im Hauptmenü registriert, nicht auf den Unterseiten
- Schwere: hoch
- Status: ✅ Gelöst (2026-04-25)
- Lösung: SW-Registrierung und Reload-Logik in `js/shared/pwa/sw-client.js` zentralisiert und in alle `bootstrap.js` sowie `js/app.js` integriert.
