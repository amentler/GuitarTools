# GuitarTools – Gitarren-Lerntools

Eine statische Web-App zum Gitarrenlernen, die direkt auf GitHub Pages ohne Build-Schritt läuft.

## Technologie

- **Vanilla HTML + CSS + JavaScript** (ES Modules, kein Framework)
- **SVG** für Griffbrettdarstellung
- **Dark Theme** via CSS Custom Properties

## Projektstruktur

```
index.html          – Haupt-HTML, enthält alle Views (#view-menu, #view-fretboard)
style.css           – Globale Styles und CSS Custom Properties
js/
├── app.js          – Navigation zwischen Views (Menü ↔ Übungen)
├── tools/          – Wiederverwendbare Hilfsfunktionen (Logik + SVG-Rendering)
└── spiele/         – Interaktive Übungen und Spiele
```

## Architektur

Die App besteht aus zwei Schichten:

1. **Navigation** (`js/app.js`): Steuert welcher View sichtbar ist und ruft `startExercise()`/`stopExercise()` auf.
2. **Übungen** (`js/spiele/`): Jede Übung verwaltet ihren eigenen State und DOM-Interaktion. Importiert Hilfsfunktionen aus `js/tools/`.

Views werden per CSS-Klasse `.active` ein- und ausgeblendet. Kein Router nötig.

## Einstellungen (zur Laufzeit)

- **Bünde:** Schieberegler 0–12 (Standard: bis Bund 4)
- **Saiten:** Toggle-Buttons E2–E4, mindestens 1 muss aktiv sein
- **Versuche:** 3 Chancen pro Note

## GitHub Pages

Branch `claude/guitar-learning-app-i9WM3`, Root `/` — keine Build-Pipeline nötig.

## Entwicklungshinweise

- Neue Übungen in `js/spiele/` anlegen, View-HTML in `index.html` ergänzen, Navigation in `js/app.js` verdrahten.
- Neue Hilfsfunktionen (Logik, Rendering) in `js/tools/` ablegen.
- Alle UI-Texte auf Deutsch.
