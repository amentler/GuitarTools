# GuitarTools – Gitarren-Lerntools

**GuitarTools** ist eine kleine, vollständig clientseitige Web-App (Progressive Web App), die beim Gitarrenüben unterstützt – mit interaktiven Übungen und praktischen Werkzeugen.  
Die App läuft direkt im Browser (Desktop & Mobil) und kann dank Service Worker auch **offline** genutzt und auf dem Homescreen installiert werden.

---

## Features

### Übungen
- **Griffbrett: Töne erkennen**  
  Ein Ton wird auf dem Griffbrett markiert – du wählst den richtigen aus allen 12 Halbtönen.  
  Mit Score, begrenzten Versuchen und Einstellungen (Bundbereich, Saiten).

- **Noten lesen**  
  Vom-Blatt-Training mit Notendarstellung, Taktwahl, Metronom und Playback-Leiste.

- **Akkord-Trainer**  
  Trainiert wichtige Akkorde mit Anzeige, Abfrage und Score.

- **Ton-Finder**  
  Zielton vorgegeben, alle Positionen auf dem Griffbrett finden.

- **Ton spielen**  
  Zielton wird vorgegeben, Erkennung über Mikrofon.

- **Noten spielen**  
  Kombination aus Notenbild und Mikrofon-Erkennung.

- **Akkord spielen (Essentia, Beta)**  
  Akkorderkennung über Essentia/WebAssembly.

- **Akkordfolgen-Trainer**  
  Gehör-/Praxisübung für Akkordwechsel und -folgen.

### Werkzeuge
- **Gitarren-Stimmgerät**  
  Nutzt das Mikrofon des Geräts für chromatische Stimmung in Echtzeit.

- **Metronom**  
  Einstellbares Tempo (BPM) mit Unterstützung verschiedener Taktarten.

- **Akkord-Übersicht**  
  Schnellzugriff auf Akkordformen.

---

## Lokal starten

Da es sich um eine statische App ohne Build-Schritt handelt, empfiehlt sich ein lokaler Webserver, damit ES-Module, page-lokale `bootstrap.js`-Dateien und der Service Worker korrekt funktionieren:

**Option A – Python**
```bash
python -m http.server 8000
```
Dann im Browser öffnen: `http://localhost:8000`

**Option B – Node.js**
```bash
npx http-server -p 8000
```

> **Hinweis:** Das direkte Öffnen von `index.html` per Doppelklick kann je nach Browser Probleme mit ES-Modulen und dem Service Worker verursachen und wird daher nicht empfohlen.

### Checks

```bash
npm run lint
npm test
```

---

## PWA & Offline-Funktion

Die App nutzt einen **Service Worker** mit einer gemischten Strategie:
- **Cache-First nur für Essentia-Dateien** unter `js/lib/essentia/` (große WASM-Binaries).
- **Network-First für alle anderen GET-Requests**, bei Offline-Fall mit `caches.match(...)` als Fallback.
- Ein Precache beim Installieren enthält aktuell Essentia-Dateien sowie die Tool-/Übungsseiten unter `pages/`.

### Installation als PWA
Im Browser öffnen und „Zum Startbildschirm hinzufügen" / „Installieren" wählen (je nach Browser und Betriebssystem).

### Update-Button
Bei neuen Versionen gibt es in der UI einen Button **„Neu laden"**, der den Service Worker und den Cache zurücksetzt und die Seite hart aktualisiert.  
Dadurch werden Updates **sofort** sichtbar – auch auf Firefox für Android.

---

## Projektstruktur

Die App ist heute eine Multi-Page Application. Jede Seite lebt unter `pages/<seite>/`
mit eigenem `index.html` und `bootstrap.js`.

```text
index.html          – Startseite / Menü
style.css           – Globale Styles
version.txt         – Versionsanzeige
manifest.json       – PWA-Manifest
sw.js               – Service Worker
pages/
├── <seite>/
│   ├── index.html  – deklarative Seite
│   └── bootstrap.js – seitenlokaler Composition Root
js/
├── components/     – Wiederverwendbare Web Components
├── games/          – Übungen / interaktive Features
├── tools/          – Werkzeuge
├── shared/         – Audio, Storage, PWA, Rendering, geteilte Infrastruktur
├── domain/         – Fachlogik ohne DOM
└── utils/          – Hilfsfunktionen
tests/
├── unit/           – Vitest Unit- und Smoke-Tests
└── e2e/            – Playwright-End-to-End-Tests
docs/               – Architektur- und Fachdokumentation
plans/              – Aktive und archivierte Planungsdokumente
```

Eine genauere Beschreibung der Schichten und Konventionen steht in
[docs/architecture.md](docs/architecture.md).

---

## Berechtigungen & Datenschutz

Das **Gitarren-Stimmgerät** benötigt Zugriff auf das **Mikrofon** deines Geräts.  
- Audiodaten werden ausschließlich lokal im Browser verarbeitet.
- Es werden keine Daten an einen Server übertragen.
- Die App hat keinen Backend-Server; alles läuft clientseitig.

---

## Lizenz

Dieses Projekt steht unter der **PolyForm Noncommercial License 1.0.0** (siehe Datei [`LICENSE`](LICENSE)).

- Nutzung, Veränderung und Weitergabe sind für **nicht-kommerzielle Zwecke** erlaubt.
- **Kommerzielle Nutzung** (z. B. Verkauf, bezahlte Dienste, Monetarisierung) ist ohne schriftliche Genehmigung nicht erlaubt.

### Zusätzliche Einschränkung: App-Stores / Marktplätze

Zusätzlich zu den Lizenzbedingungen gilt:

> **Das Veröffentlichen dieser App oder abgeleiteter Werke in App-Marktplätzen (z. B. Google Play Store, Apple App Store, Microsoft Store, F-Droid o. ä.) ist ohne ausdrückliche schriftliche Erlaubnis untersagt.**

Weitere Details: siehe Datei [`NOTICE`](NOTICE).

### Kommerzielle Lizenz / Erlaubnis anfragen

Für kommerzielle Nutzung oder eine Veröffentlichung in App-Stores bitte anfragen unter:

guitartools.rocking928((at) - bitte ersetzen)slmails.com
