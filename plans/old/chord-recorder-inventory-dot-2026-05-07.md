# Plan: Chord-Recorder Aufnahme-Statistik mit Dot-Indikator

## Kontext

Der Chord-Recorder sammelt Gitarren-Aufnahmen für ML-Training. Aktuell hat der Nutzer keine Übersicht, für welche Akkorde bereits genug Aufnahmen in den gewünschten Varianten vorliegen. Ziel ist ein farbiger Punkt pro Akkord-Button (rot/grün), der anzeigt ob ≥ 3 Aufnahmen für die aktuell gewählten Filter (Gitarren-Typ + Varianten) in `tests/fixtures/chords/` vorhanden sind.

Da die App auf GitHub Pages (statisch) läuft, wird die Statistik als JSON-Datei im Repo gespeichert und beim Seitenstart geladen. Legacy-Aufnahmen ohne Sidecar-JSON werden ignoriert.

---

## Betroffene Dateien

| Datei | Änderung |
|---|---|
| `js/tools/chordRecorder/chordInventoryLogic.js` | **neu** — pure Funktionen für Transformation + Filterung |
| `tests/unit/chordInventoryLogic.test.js` | **neu** — Unit-Tests |
| `scripts/generate-chord-inventory.mjs` | **neu** — Node.js-Skript, erzeugt `chord-inventory.json` |
| `tests/fixtures/chord-inventory.json` | **neu** — generierte Statistik-Datei (wird nicht von Hand editiert) |
| `scripts/import-drop-fixtures.mjs` | Aufruf des Generators am Ende hinzufügen |
| `js/tools/chordRecorder/chordRecorder.js` | `loadInventory()` + `updateDots()` + Verdrahtung |
| `style.css` | `.cr-chord-dot`-Klassen (roter/grüner Punkt) |
| `sw.js` | `tests/fixtures/chord-inventory.json` zur ASSETS-Liste hinzufügen |

---

## Neue Funktionen / Exports

### `js/tools/chordRecorder/chordInventoryLogic.js`

```js
/**
 * Extrahiert die für Filterung relevanten Felder aus einem Sidecar-JSON.
 * @param {object} sidecar — vollständiges Sidecar-Objekt aus buildSidecarJson()
 * @returns {{ chord, chordKey, guitarSize, guitarStrings, technique, strumMode, volume }}
 */
export function buildInventoryEntry(sidecar)

/**
 * Zählt Aufnahmen für einen Akkord, die alle gesetzten Filter erfüllen.
 * @param {object[]} recordings — Array von Inventory-Einträgen
 * @param {string}   chordKey   — z.B. "adur"
 * @param {object}   filter     — { guitarSize?, guitarStrings?, techniken?, strumModi? }
 *   guitarSize/guitarStrings: string — Aufnahme-Wert muss exakt übereinstimmen
 *   techniken: string[] — recording.technique muss Element sein
 *   strumModi: string[] — recording.strumMode muss Element sein
 *   Leere Arrays / fehlende Keys → keine Einschränkung auf dieser Dimension
 * @returns {number}
 */
export function countMatchingRecordings(recordings, chordKey, filter)

/**
 * @param {object[]} recordings
 * @param {string}   chordKey
 * @param {object}   filter     — wie oben
 * @param {number}   [target=3]
 * @returns {boolean}
 */
export function isChordSufficient(recordings, chordKey, filter, target = 3)
```

### `scripts/generate-chord-inventory.mjs`

Node.js-Script ohne Exports. Liest `tests/fixtures/chords/**/*.json`, transformiert via `buildInventoryEntry`, schreibt:

```json
{
  "generatedAt": "<ISO-Timestamp>",
  "recordings": [
    { "chord": "A-Dur", "chordKey": "adur", "guitarSize": "Vollgröße",
      "guitarStrings": "Nylon", "technique": "finger",
      "strumMode": "single", "volume": "laut" }
  ]
}
```

---

## Teststrategie

### Unit-Tests: `tests/unit/chordInventoryLogic.test.js`

Testet ausschließlich pure Funktionen aus `chordInventoryLogic.js`, kein I/O.

**`buildInventoryEntry`**
| Eingabe | Erwartet |
|---|---|
| vollständiges Sidecar-Objekt | nur relevante Felder, keine quality/repeatIndex |
| Sidecar mit `guitarStrings: 'Steel'` | `guitarStrings: 'Steel'` im Entry |

**`countMatchingRecordings`**
| Eingabe | Erwartet |
|---|---|
| leere Liste, beliebiger Filter | 0 |
| 3 Einträge, falscher chordKey | 0 |
| 3 Einträge passend zu chordKey + filter | 3 |
| leerer Filter `{}` zählt alle Einträge für chordKey | n |
| filter.techniken = ['finger'], Eintrag hat technique='plektrum' | 0 |
| filter.strumModi = ['single'], Eintrag hat strumMode='multi1' | 0 |
| filter.guitarSize = 'Vollgröße', Eintrag hat '3/4' | 0 |
| filter.guitarStrings = 'Nylon', Eintrag hat 'Steel' | 0 |
| filter.techniken = [] → keine Einschränkung auf Technik | zählt alle |
| 2 Techniken im filter, Einträge mit je 1 Technik | beide zählen |

**`isChordSufficient`**
| Eingabe | Erwartet |
|---|---|
| 0 Treffer, target=3 | false |
| 2 Treffer, target=3 | false |
| 3 Treffer, target=3 | true |
| 5 Treffer, target=3 | true |

### Nicht unit-testbar
- `generate-chord-inventory.mjs`: Datei-I/O — kein Unit-Test, manuell via `node scripts/generate-chord-inventory.mjs` prüfbar
- `loadInventory()` in `chordRecorder.js`: fetch-Aufruf — kein Unit-Test
- `updateDots()`/CSS-Rendering: DOM-abhängig — kein Unit-Test

---

## TDD-Reihenfolge (Tests vor Implementierung)

1. `tests/unit/chordInventoryLogic.test.js` schreiben (alle Fälle, rot)
2. `js/tools/chordRecorder/chordInventoryLogic.js` implementieren (grün)
3. `scripts/generate-chord-inventory.mjs` implementieren, einmalig ausführen, `tests/fixtures/chord-inventory.json` commiten
4. `scripts/import-drop-fixtures.mjs` — am Ende Generator aufrufen
5. `chordRecorder.js` — `loadInventory()` + `updateDots()` einbauen, Filter-Events verdrahten
6. `style.css` — `.cr-chord-dot`-Klassen ergänzen
7. `sw.js` — `chord-inventory.json` in ASSETS-Liste

---

## Implementierungsdetails

### Filter-Mapping in `chordRecorder.js`

`getConfig()` liefert bereits `{ guitarSize, guitarStrings, techniken, strumModi }` — direkt als `filter` übergeben.

```js
async function loadInventory() {
  const url = '../../tests/fixtures/chord-inventory.json';
  try {
    const res = await fetch(url, { cache: 'no-store' });
    if (res.ok) return res.json();
  } catch {}
  try {
    const res = await fetch(url);
    if (res.ok) return res.json();
  } catch {}
  return { recordings: [] };
}

function updateDots(inventory) {
  const config = getConfig();
  root?.querySelectorAll('.cr-chord-card').forEach(card => {
    const chordKey = toChordKey(card.dataset.chord);
    const ok = isChordSufficient(inventory.recordings, chordKey, config);
    const dot = card.querySelector('.cr-chord-dot');
    if (dot) dot.className = `cr-chord-dot ${ok ? 'cr-chord-dot--ok' : 'cr-chord-dot--missing'}`;
  });
}
```

`loadInventory()` wird in `mount()` aufgerufen (parallel zu `initStore()`). Das Result wird in einer Closure-Variable `inventory` gehalten. `updateDots(inventory)` wird aufgerufen:
- nach `loadInventory()` resolve
- in `bindInstrumentControls` bei jedem `change`-Event
- in `bindVariantControls` bei jedem `change`-Event

### Dot-Span in `renderChordGrid()`

```js
const dot = document.createElement('span');
dot.className = 'cr-chord-dot';  // neutral bis Inventory geladen
card.appendChild(dot);
```

### CSS in `style.css`

```css
.cr-chord-dot {
  display: block;
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: transparent;  /* unsichtbar wenn kein Inventory */
}
.cr-chord-dot--ok      { background: var(--color-success, #22c55e); }
.cr-chord-dot--missing { background: var(--color-error,   #ef4444); }
```

### `import-drop-fixtures.mjs` Integration

Am Ende von `main()`, nach der Fertig-Meldung:

```js
execFileSync('node', [new URL('./generate-chord-inventory.mjs', import.meta.url).pathname],
  { stdio: 'inherit' });
```

(`execFileSync` ist bereits am Anfang der Datei importiert — nur den weiteren Aufruf hinzufügen.)

---

## Verifikation

1. `npm test` — alle bestehenden Tests + neue `chordInventoryLogic.test.js` grün
2. `node scripts/generate-chord-inventory.mjs` — `chord-inventory.json` korrekt erzeugt
3. App im Browser öffnen: Punkte erscheinen auf Akkord-Cards
4. Filter ändern: Punkte aktualisieren sich sofort
5. `npm run lint` — keine Fehler
