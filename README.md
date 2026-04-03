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
  Generiert zufällige Noten/Takte zum Vom-Blatt-Spielen (Notendarstellung via VexFlow).

- **Akkord-Trainer**  
  Trainiert wichtige Akkorde mit Anzeige, Abfrage und Score.

### Werkzeuge
- **Gitarren-Stimmgerät**  
  Nutzt das Mikrofon des Geräts für chromatische Stimmung in Echtzeit.

- **Metronom**  
  Einstellbares Tempo (BPM) mit Unterstützung verschiedener Taktarten.

---

## Lokal starten

Da es sich um eine statische App ohne Build-Schritt handelt, empfiehlt sich ein lokaler Webserver (damit ES-Module und der Service Worker korrekt funktionieren):

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

---

## PWA & Offline-Funktion

Die App nutzt einen **Service Worker** mit **Network-First-Strategie**:
- Wenn das Netzwerk verfügbar ist, werden Ressourcen immer zuerst frisch vom Server geladen und dabei im Cache aktualisiert.
- Wenn das Netzwerk nicht erreichbar ist (offline), wird automatisch auf den lokal gespeicherten Cache zurückgegriffen.

Beim ersten Aufruf (oder nach einem Update-Knopf-Druck) werden folgende Ressourcen vorgeladen (Precache):
- `index.html`, `style.css`, `manifest.json`
- JavaScript-Module unter `js/`
- Icons unter `icons/`
- VexFlow (CDN) wird opportunistisch gecacht (sofern erreichbar)

### Installation als PWA
Im Browser öffnen und „Zum Startbildschirm hinzufügen" / „Installieren" wählen (je nach Browser und Betriebssystem).

### Update-Button
Bei neuen Versionen gibt es in der UI einen Button **„Neu laden"**, der den Service Worker und den Cache zurücksetzt und die Seite hart aktualisiert.  
Dadurch werden Updates **sofort** sichtbar – auch auf Firefox für Android.

---

## Projektstruktur

```
index.html          – UI / alle Views (Menü, Übungen, Werkzeuge)
style.css           – Globale Styles & CSS Custom Properties (Dark Theme)
manifest.json       – PWA-Manifest
sw.js               – Service Worker (Offline-Cache)
js/
├── app.js          – Navigation zwischen Views, Start/Stop der Module
├── games/          – Übungen (selbstständige Module)
│   ├── fretboardToneRecognition/   – Griffbrett: Töne erkennen
│   ├── sheetMusicReading/          – Noten lesen
│   └── akkordTrainer/              – Akkord-Trainer
└── tools/          – Werkzeuge (ohne Score)
    ├── guitarTuner/                – Gitarren-Stimmgerät
    └── metronome/                  – Metronom
icons/              – App-Icons (SVG)
docs/               – Dokumentation / Notizen
plans/              – Planungsdokumente
```

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
