# Repo-Probleme

Fortlaufende Liste gefundener Probleme mit kurzer Einordnung und Beleg.

## 2026-04-24

### 1. README beschreibt eine Repo-Struktur, die so nicht mehr existiert
- Schwere: mittel
- Status: ✅ Gelöst (2026-04-29)
- Historischer Beleg: Die fruehere README referenzierte `js/exerciseRegistry.js`, obwohl diese Struktur nicht mehr dem aktuellen Repo entsprach.
- Beleg: Die aktuelle Struktur liegt stattdessen unter `js/games/**`, `js/tools/**`, `js/shared/**`, `js/domain/**`.
- Risiko: Neue Mitarbeitende oder spätere Refactorings arbeiten mit einer falschen mentalen Landkarte; dadurch werden Codepfade, Verantwortlichkeiten und Update-Stellen leicht falsch eingeschätzt.
- Lösung: `README.md` auf die aktuelle MPA-Struktur mit `pages/<seite>/index.html` + `bootstrap.js`, `js/shared/**` und `docs/architecture.md` umgestellt.

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

## 2026-04-25

### 5. Fretboard-Hintergrund in der Web-Komponente <gt-fretboard> zu niedrig
- Schwere: niedrig (visueller Bug)
- Status: ✅ Gelöst (2026-04-25)
- Beleg: Die Positions-Kreise (Radius 15) ragten über den braunen Hintergrund (Wood) hinaus.
- Lösung: Vertikales Padding des Fretboard-Hintergrunds von 10px auf 20px erhöht und Labels neu positioniert.
