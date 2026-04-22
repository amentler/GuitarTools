# Architekturstandard

Stand: 2026-04-22

## Zielbild

`GuitarTools` ist eine Multi-Page-App. Jede Seite besitzt einen lokalen Einstiegspunkt unter `pages/<seite>/`.

Mindeststruktur pro Seite:

```text
pages/<seite>/
  index.html
  bootstrap.js
```

## Begriffe

- Seite: ein eigenstaendig aufrufbarer HTML-Einstieg unter `pages/<seite>/index.html`
- Bootstrap: das seitenlokale Startmodul unter `pages/<seite>/bootstrap.js`
- Feature: fachliche Uebung unter `js/games/`
- Tool: fachliches Werkzeug unter `js/tools/`
- Root-Element: das DOM-Element, in das eine Seite ihr Feature mountet
- Lifecycle: die oeffentliche Start-/Stop-Schnittstelle eines Features oder Tools

## Regeln

- `pages/` enthaelt nur seitenbezogene Dateien und Startlogik.
- `bootstrap.js` importiert benoetigte UI-Komponenten und genau ein Feature oder Tool.
- Gemeinsame Implementierung liegt ausserhalb von `pages/`, zum Beispiel unter `js/games/`, `js/tools/` oder spaeter `js/shared/`.
- HTML-Seiten enthalten keine Inline-Bootstrap-Logik.
- Die oeffentliche Einstiegsschnittstelle fuer Seitenfeatures ist:

```js
{
  mount(root, deps?),
  unmount(),
  resume?(),
  suspend?()
}
```

## Verantwortlichkeiten

- `index.html` beschreibt die Seitenstruktur.
- `bootstrap.js` loest das Root-Element auf und ruft `mount(root)` auf.
- Feature- und Tool-Module kapseln ihre interne Logik und stellen Lifecycle-Methoden bereit.
- `js/app.js` bleibt auf die Startseite begrenzt und orchestriert keine einzelnen Uebungen.
