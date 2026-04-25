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
- Beleg: `sw.js:8` setzt `const CACHE_VERSION = 'v7';` hart im Code.
- Beleg: Gleichzeitig wird `version.txt` separat gepflegt und im UI angezeigt (`js/app.js:7`, `js/shared/pwa/precacheManifest.js:9`).
- Risiko: Wenn Assets oder HTML geändert werden, aber `CACHE_VERSION` nicht mitgezogen wird, bleiben alte Caches aktiv. Das ist besonders kritisch für eine Offline-PWA, weil Nutzer dann trotz neuer `version.txt` oder neuem Deploy alte Dateien sehen können.

### 3. Precache deckt die Mehrseiten-PWA nur unvollständig ab
- Schwere: hoch
- Beleg: `js/shared/pwa/precacheManifest.js` enthält die `pages/**/index.html`, aber keine `pages/**/bootstrap.js`.
- Beleg: Jede Unterseite lädt ihr Feature erst über `<script type="module" src="./bootstrap.js">`, z. B. `pages/guitar-tuner/index.html:55`.
- Risiko: Eine Seite kann als HTML offline vorhanden sein, aber beim ersten Offline-Aufruf trotzdem scheitern, weil das zugehörige Bootstrap-Modul nie vorab gecacht wurde.

### 4. Service Worker wird nur im Hauptmenü registriert, nicht auf den Unterseiten
- Schwere: hoch
- Beleg: `index.html` enthält die komplette `navigator.serviceWorker.register('./sw.js', ...)`-Logik.
- Beleg: Die einzelnen Seiten unter `pages/*/index.html` enthalten nur ihr lokales `bootstrap.js`, aber keine SW-Registrierung.
- Risiko: Wer direkt auf einer Übungs-/Werkzeugseite landet, bekommt keine SW-Registrierung, keine Update-Logik und damit ein anderes Laufzeitverhalten als über das Hauptmenü. Für eine PWA mit Deep Links ist das inkonsistent und fehleranfällig.
