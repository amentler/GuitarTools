# Plan: Globale Einstellungen

**Stand:** 2026-05-01  
**Status:** ✅ Basis umgesetzt (globalSettings.js, index.html, app.js, style.css)

---

## Ziel

Eine zentrale Stelle auf der Startseite, über die feature-übergreifende Einstellungen
aktiviert oder deaktiviert werden können. Features wie adaptive Item-Selektion sollen
hier ein- und ausschaltbar sein, ohne dass jede Übung einen eigenen Schalter bekommt.

---

## Erstes Setting: Adaptive Item-Selektion

Das einzige geplante Setting zum Start:

| Setting | Schlüssel | Default | Beschreibung |
|---------|-----------|---------|--------------|
| Adaptives Lernen | `srs_enabled` | `false` | Schwierige Items häufiger abfragen (Spaced Repetition) |

`false` als Default, weil das Verhalten für neue Nutzer unerwartet wäre und das
Feature zuerst erprobt werden soll.

Weitere Settings können bei Bedarf ergänzt werden. Kandidaten für später:

| Setting | Schlüssel | Notiz |
|---------|-----------|-------|
| Debug-Modus | `debug_enabled` | Wird aktuell separat geplant; könnte hierher wandern |
| Sounds / Feedback-Töne | `sounds_enabled` | Falls Töne eingebaut werden |

---

## UI

### Einstieg: Einstellungen-Abschnitt auf der Startseite

Ein eigener Abschnitt am Ende der Startseite (unterhalb der Übungskarten,
oberhalb von „Neu laden" / Version), mit einer Überschrift „Einstellungen".

Kein separates Modal, kein eigenes Seiten-HTML — der Abschnitt ist direkt in
`index.html` eingebettet und standardmäßig zugeklappt (Details-/Summary-Element
oder eine einfache Toggle-Klasse).

### Beispiel-Layout (aufgeklappt)

```
▼ Einstellungen

  [✓] Adaptives Lernen
      Schwierige Aufgaben werden häufiger abgefragt.
      Gespeicherte Lernstände: [Zurücksetzen]
```

### Verhalten

- Jede Änderung wird sofort in `localStorage` gespeichert.
- Kein Speichern-Knopf notwendig.
- Der Zustand (auf-/zugeklappt) wird nicht gespeichert — startet immer zugeklappt.

---

## Architektur

### Neues Modul: `js/shared/globalSettings.js`

Reines Lese-/Schreib-Modul, kein DOM. Exportiert:

```js
export function getSetting(key)
// Gibt den gespeicherten Wert zurück, oder den Default falls nicht gesetzt.

export function setSetting(key, value)
// Speichert in localStorage.

export function resetSetting(key)
// Entfernt den Eintrag; Lesen gibt danach wieder den Default.

export const SETTINGS_DEFAULTS = {
  srs_enabled: false,
  // debug_enabled: false,  // optional, wenn Debug-Modus hier eingebunden wird
}
```

Storage-Key: `gt_global_settings` (ein JSON-Objekt).

### Integration in Übungen

Jede Übung, die ein globales Setting berücksichtigt, liest beim `mount()`:

```js
import { getSetting } from '../../shared/globalSettings.js';

const srsEnabled = getSetting('srs_enabled');
if (srsEnabled) {
  store = createSrsStore('tonFinder', allItems);
}
```

Das Setting wird einmalig beim Start der Übung gelesen. Ein Live-Update während
einer laufenden Übung ist nicht vorgesehen — der Nutzer muss die Seite neu laden
oder zur Startseite zurückkehren.

### Beziehung zum Debug-Modus

Der aktuelle Debug-Modus-Plan (`global-debug-mode-plan-2026-04-30.md`) sieht den
Schalter am unteren Seitenende von `index.html` vor. Langfristig könnte er in den
Einstellungen-Abschnitt wandern. Das ist eine spätere Entscheidung — zunächst
bleiben beide getrennt, damit der Debug-Plan nicht blockiert wird.

---

## Testplan

### Unit-Tests (`tests/unit/globalSettings.test.js`)

- `getSetting` gibt Default zurück wenn kein Wert gesetzt.
- `setSetting` + `getSetting` liest denselben Wert zurück.
- `resetSetting` stellt Default wieder her.
- Unbekannte Keys geben `undefined` zurück (kein Crash).
- Alle Tests mit gemocktem `localStorage`.

### E2E (optional, später)

- Adaptives Lernen einschalten → Übung öffnen → prüfen dass `srsEnabled` aktiv ist
  (z.B. über `window.__GT_SRS_ENABLED__`-Hook analog zu bestehenden Test-Hooks).

---

## Betroffene Dateien

| Datei | Änderung |
|-------|---------|
| `index.html` | Einstellungen-Abschnitt |
| `style.css` | Styles für den Abschnitt |
| `js/app.js` | Wiring der Checkboxen |
| `js/shared/globalSettings.js` | Neu |
| `js/games/*/…Exercise.js` | Lesen von `srs_enabled` beim mount (nach SRS-Umsetzung) |
| `sw.js` | `globalSettings.js` in Asset-Liste aufnehmen |

---

## Umsetzungsreihenfolge

1. `globalSettings.js` mit Unit-Tests anlegen.
2. Einstellungen-Abschnitt in `index.html` + `app.js` einbauen (nur die Checkbox,
   noch ohne SRS-Effekt).
3. SRS-Logik (`srsLogic.js`) umsetzen und mit `getSetting('srs_enabled')` verbinden.
4. Optional: Debug-Modus-Schalter in den Abschnitt integrieren.

---

## Offene Entscheidungen

| Frage | Vorschlag |
|-------|-----------|
| Zugeklappt oder direkt sichtbar? | Zugeklappt — die meisten Nutzer brauchen es nicht |
| `<details>`/`<summary>` oder eigenes Toggle? | `<details>`/`<summary>` — kein JS nötig |
| Soll „Lernstände zurücksetzen" sofort wirken oder einen Bestätigungsdialog haben? | Sofort wirken, aber mit kurzem Feedback-Text „Zurückgesetzt." |
| Sollen Einstellungen auch auf Unterseiten lesbar und änderbar sein? | Lesbar ja (über `globalSettings.js`); ändern nur auf Startseite |
