# tonFinder – Inverses Griffbrett-Quiz

Der Ton-Finder zeigt einen Zielton (z. B. `G`) an. Die Aufgabe ist, alle Positionen dieses Tons auf den aktiven Saiten im eingestellten Bundbereich anzutippen.

## Dateien

- `tonFinder.js` – State, Rundenfluss, Auswertung, DOM-Wiring; nutzt `<gt-fretboard>`
- `tonFinderLogic.js` – Pure Funktionen für Ton-Pool, Positionssuche und Auswertung
- `tonFinderSVG.js` – Alter SVG-Renderer (Legacy, nicht mehr aktiv genutzt)

## Griffbrett-Integration (Phase 1)

`tonFinder.js` nutzt die `<gt-fretboard>` Web Component (registriert via `js/components/index.js`).

In `index.html`:
```html
<gt-fretboard id="ton-finder-svg" class="fretboard-container" interactive></gt-fretboard>
```

In `tonFinder.js`:
```js
// Fretboard konfigurieren
ui.fretboard.frets = state.settings.maxFret;
ui.fretboard.activeStrings = state.settings.activeStrings;
ui.fretboard.positions = positions; // Array<{stringIndex, fret, state?}>

// User-Interaktion empfangen
ui.fretboard.addEventListener('fret-select', event => {
  onPositionToggle(event.detail.stringIndex, event.detail.fret);
});
```

## Ablauf

1. Runde startet mit Zufallston aus Schwierigkeits-Pool
2. Nutzer markiert Positionen (Toggle per erneutem Klick)
3. `Fertig` wertet aus:
   - korrekt getippt = grün
   - verpasst = orange
   - falsch getippt = rot
4. Score-Logik: `max(0, korrekt - falsch)`
5. `Nächste Runde` startet neue Zielton-Runde

## AI Collaboration & Documentation

**IMPORTANT FOR ALL AGENTS (Claude, Gemini, Codex):**
- **Update .md files:** After completing a task or implementing a feature, you MUST update all relevant `.md` files (root `CLAUDE.md`, root `GEMINI.md`, this `CLAUDE.md`, and any plans in `plans/`).
- **Keep Plans Current:** If a feature from `plans/` is implemented, update the file to reflect the new state and next steps.
- **Architecture:** Maintain the project's "Vanilla JS", Web Component, and SVG-focused architecture.
