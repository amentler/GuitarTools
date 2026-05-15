# Plan: Split Oversized JS Modules (>800 lines)

## Kontext

`tests/unit/architectureBoundaryGuards.test.js` erzwingt eine 800-Zeilen-Grenze für alle
JS-Dateien unter `js/` (Ausnahme: `js/lib/`). Vier Dateien überschreiten dieses Limit:

| Datei | Zeilen | Überschuss |
|---|---|---|
| `js/games/sheetMusicReading/sheetMusicReading.js` | 1080 | +280 |
| `js/games/chordExerciseEssentia/essentiaChordLogic.js` | 996 | +196 |
| `js/tools/audioAnalyse/audioAnalyseSVG.js` | 840 | +40 |
| `js/tools/onsetTagger/onsetTagger.js` | 832 | +32 |

**Ziel:** Alle vier Dateien auf <800 Zeilen bringen ohne funktionale Änderungen.

---

## Betroffene Dateien & Änderungen

### 1. `essentiaChordLogic.js` (996 → ~726 Zeilen)

**Strategie: Daten und Parsing in Sub-Module auslagern**

**Neue Dateien:**

`js/games/chordExerciseEssentia/essentiaChordConstants.js` (~170 Zeilen)
- Exportiert: `NOTE_TO_BIN`, `GERMAN_TO_BIN`, `TYPE_INTERVALS`, `DEFAULT_PROFILE`,
  `CHORD_TYPE_PROFILES`, `BASS_VARIANT_COUNTERPART`, `SUS_IDENTITY_COUNTERPART`,
  alle Schwellenwert-Konstanten (lines 1–170 aus Original)
- Keine Imports aus dem eigenen Verzeichnis

`js/games/chordExerciseEssentia/essentiaChordDescriptors.js` (~105 Zeilen)
- Importiert: benötigte Konstanten aus `./essentiaChordConstants.js`
- Exportiert: `stripChordAnnotation`, `parseChordDescriptor`, `getChordDescriptor`,
  `getChordProfile`, `sharesRoot`, `isTriadModeSensitive`, `isAnnotatedVariant`
  (lines 172–293 aus Original)

**Geänderte Datei:**

`essentiaChordLogic.js` (~726 Zeilen nach Extraktion)
- Fügt imports hinzu: `import { ... } from './essentiaChordConstants.js'`
- Fügt imports hinzu: `import { ... } from './essentiaChordDescriptors.js'`
- Entfernt die extrahierten ~270 Zeilen
- Alle 6 public exports (`buildChordTemplates`, `cosineSimilarity`, `averageHpcps`,
  `computeHpcpPureJS`, `matchChordPath`, `matchHpcpToChord`) bleiben unverändert

**Keine Änderungen an:**
- 3 Consumer-Dateien (`essentiaChordDetection.js`, `pureJsChordMatcher.js`,
  `essentiaFingerprintChordMatcher.js`) – alle importieren aus `essentiaChordLogic.js`
- 8 Test-Dateien – alle importieren aus `essentiaChordLogic.js`

---

### 2. `audioAnalyseSVG.js` (840 → ~735 Zeilen)

**Strategie: Crosshair-System in Sub-Modul auslagern**

**Neue Datei:**

`js/tools/audioAnalyse/audioAnalyseSVGCrosshair.js` (~105 Zeilen)
- Enthält: `_crosshairLines[]`, `_cursorLabels[]` (crosshair-spezifischer State),
  `makeCrosshairLine()`, `_updateCrosshairAtFraction()`, `setCrosshairFromFraction()`,
  `initCrosshair()`
- Exportiert: `setCrosshairFromFraction`, `initCrosshair`, `resetCrosshairRegistry`
  (letzte Funktion wird von `renderAllCharts` beim Neuladen aufgerufen)

**Geänderte Datei:**

`audioAnalyseSVG.js` (~735 Zeilen)
- Importiert `setCrosshairFromFraction`, `initCrosshair`, `resetCrosshairRegistry`
  aus `./audioAnalyseSVGCrosshair.js`
- Entfernt lines 777–840 + crosshair-spezifische State-Variablen + `makeCrosshairLine`
- `renderAllCharts` ruft `resetCrosshairRegistry()` anstatt direkt den State zu löschen
- Re-exportiert `setCrosshairFromFraction` und `initCrosshair` für den Consumer
  `audioAnalyse.js` (der diese direkt importiert)

**Keine Änderungen an:**
- `audioAnalyse.js` (Consumer) – importiert weiterhin aus `audioAnalyseSVG.js`
- Keine Test-Dateien betroffen (keine Tests für dieses Modul vorhanden)

---

### 3. `onsetTagger.js` (832 → ~632 Zeilen)

**Strategie: Metadata-Form-Builder + Konstanten auslagern**

**Neue Datei:**

`js/tools/onsetTagger/onsetTaggerMetaForm.js` (~200 Zeilen)
- Enthält: `DEFAULT_SIDECAR_FIELDS`, `DROPDOWN_OPTIONS`, `NUMERIC_DROPDOWN_KEYS`
- Exportiert: `renderMetaForm(container, data)`, `buildMetaRow(key, fieldDef, value)`,
  `buildMetaInput(key, fieldDef, value)`, `readInputValue(el, type)`,
  `readMetaForm(container)` (lines 33–90 Konstanten + lines 371–509 Form-Builder)
- Diese Funktionen sind DOM-basiert und nehmen den Container als Parameter
  (kein Zugriff auf closure-State von onsetTagger.js)

**Geänderte Datei:**

`onsetTagger.js` (~632 Zeilen)
- Importiert: `DEFAULT_SIDECAR_FIELDS`, `DROPDOWN_OPTIONS`, `NUMERIC_DROPDOWN_KEYS`,
  `renderMetaForm`, `readMetaForm` aus `./onsetTaggerMetaForm.js`
- Entfernt: Konstanten-Block + Form-Builder-Funktionen (~200 Zeilen)
- Referenzen im mount()-Handler bleiben bestehen (rufen jetzt importierte Funktionen auf)

**Keine Änderungen an:**
- `onsetTaggerLogic.test.js` – testet `onsetTaggerLogic.js`, nicht `onsetTagger.js`

---

### 4. `sheetMusicReading.js` (1080 → ~775 Zeilen)

**Strategie: Endless-Mode-Helpers + Recording-Helpers als Context-Factories auslagern**

Dies ist der komplexeste Split, da die Helferfunktionen aktuell Closure-Variablen der
Factory `createSheetMusicReadingFeature()` erfassen.

**Muster: Context-Factory-Extraktion**
```js
// sheetMusicReadingEndless.js
export function createEndlessHelpers(ctx) {
  const { getState, getRows, getContainer, renderRow, scrollTarget } = ctx;
  
  function buildEndlessRow(...) { ... }
  function appendEndlessRow(...) { ... }
  // ...
  
  return { buildEndlessRow, appendEndlessRow, disposePendingEndlessRowAsset,
           clearEndlessShiftTimeout, getEndlessScrollTarget, shiftEndlessWindowToRow,
           cleanupEndlessState };
}
```

**Neue Dateien:**

`js/games/sheetMusicReading/sheetMusicReadingEndless.js` (~120 Zeilen)
- Exportiert: `createEndlessHelpers(ctx)`
- `ctx` enthält: Referenzen auf State-Getter + Renderer-Callbacks
- Rückgabe: alle 7 Endless-Mode-Helferfunktionen (lines 684–781)

`js/games/sheetMusicReading/sheetMusicReadingRecordingUI.js` (~120 Zeilen)
- Exportiert: `createRecordingUI(ctx)`
- `ctx` enthält: `getState`, `getBars`, `getTimeSig`, `getBpm`, `getRecorder`,
  `getRecordingsTaken`, DOM-Query-Helpers
- Rückgabe: `syncRecordingUI`, `startRecording`, `stopRecording`, `cancelRecording`,
  `downloadRecordings`, `makeManifest` (lines 585–666)

**Geänderte Datei:**

`sheetMusicReading.js` (~775 Zeilen)
- Importiert: `createEndlessHelpers`, `createRecordingUI`
- In der Factory werden beide Contexts initialisiert:
  ```js
  const endlessHelpers = createEndlessHelpers({ getState: () => state, ... });
  const recordingUI = createRecordingUI({ getState: () => state, ... });
  ```
- Lokale Funktionsreferenzen werden durch die zurückgegebenen Objekte ersetzt
- Alle vorhandenen Aufrufer (mount(), startEndlessPlayback(), etc.) referenzieren weiterhin
  dieselben Funktionsnamen (jetzt aus den Helper-Objekten)

**Keine Änderungen an:**
- `sheetMusicReadingController.test.js` und `sheetMusicReadingPageSmoke.test.js` –
  testen über `createSheetMusicReadingFeature()` API

---

## Neue Funktions-Signaturen / Exports

| Datei | Export | Signatur |
|---|---|---|
| `essentiaChordConstants.js` | Konstanten | `export const NOTE_TO_BIN = {...}` etc. |
| `essentiaChordDescriptors.js` | Parsing | `export function parseChordDescriptor(name)` etc. |
| `audioAnalyseSVGCrosshair.js` | `setCrosshairFromFraction` | `(fraction: number) → void` |
| `audioAnalyseSVGCrosshair.js` | `initCrosshair` | `(wrapper: HTMLElement) → void` |
| `audioAnalyseSVGCrosshair.js` | `resetCrosshairRegistry` | `() → void` |
| `onsetTaggerMetaForm.js` | `renderMetaForm` | `(container: HTMLElement, data: object) → void` |
| `onsetTaggerMetaForm.js` | `readMetaForm` | `(container: HTMLElement) → object` |
| `sheetMusicReadingEndless.js` | `createEndlessHelpers` | `(ctx: object) → object` |
| `sheetMusicReadingRecordingUI.js` | `createRecordingUI` | `(ctx: object) → object` |

---

## Teststrategie

### Was bereits getestet ist (bleibt grün)
- Alle 75 Tests für `essentiaChordLogic.js` – Importpfade unverändert
- Alle 22 Tests für `sheetMusicReading.js` – testen über public API
- Die 46 Tests für `onsetTaggerLogic.js` – betroffen von keiner Änderung

### Neue Unit-Tests (rot → grün, TDD)

**`tests/unit/essentiaChordConstants.test.js`** (vor der Extraktion schreiben):
```
Eingabe: import { NOTE_TO_BIN, TYPE_INTERVALS } from essentiaChordConstants.js
Erwartung: NOTE_TO_BIN hat 12 Einträge; TYPE_INTERVALS enthält 'maj', 'min', '7', 'maj7'
```

**`tests/unit/essentiaChordDescriptors.test.js`** (vor der Extraktion schreiben):
```
Eingabe: parseChordDescriptor('Am7')
Erwartung: { root: 'A', type: 'min7' } oder äquivalent
Eingabe: parseChordDescriptor('C')
Erwartung: { root: 'C', type: 'maj' }
```

**`tests/unit/onsetTaggerMetaForm.test.js`** (JSDOM, vor Extraktion schreiben):
```
Eingabe: readMetaForm(container) nach renderMetaForm(container, sampleData)
Erwartung: Rückgabe entspricht sampleData (round-trip)
```

### Was nicht unit-testbar ist
- `audioAnalyseSVGCrosshair.js`: Browser-Event-Listener (`pointermove`) brauchen echtes DOM; Smoke-Test reicht
- `sheetMusicReadingEndless.js` / `sheetMusicReadingRecordingUI.js`: Context-Factories mit komplexen State-Abhängigkeiten; bestehende Controller-Tests decken sie indirekt ab

---

## TDD-Reihenfolge

```
1. npm run test:unit  → baseline (1 FAIL erwartet: boundary guard)
2. Tests schreiben für essentiaChordConstants  → rot
3. essentiaChordConstants.js erstellen        → grün
4. Tests schreiben für essentiaChordDescriptors → rot
5. essentiaChordDescriptors.js erstellen + essentiaChordLogic.js anpassen → grün
6. audioAnalyseSVGCrosshair.js erstellen + audioAnalyseSVG.js anpassen
7. Tests schreiben für onsetTaggerMetaForm    → rot
8. onsetTaggerMetaForm.js erstellen + onsetTagger.js anpassen → grün
9. sheetMusicReadingEndless.js + sheetMusicReadingRecordingUI.js erstellen
   + sheetMusicReading.js anpassen
10. npm run test:unit → alle grün, boundary guard PASS
```

---

## Implementierungsreihenfolge

1. **essentiaChordLogic.js** – sauberste Grenzen, umfangreichste Testabdeckung, kein Risiko
2. **audioAnalyseSVG.js** – keine Tests, minimales Risiko, kleiner Überschuss
3. **onsetTagger.js** – Konstanten + DOM-Builder gut isoliert
4. **sheetMusicReading.js** – komplexeste Closure-Extraktion, zuletzt

---

## Verifikation

```bash
npm run test:unit  # alle 85+ Dateien grün, inkl. architectureBoundaryGuards
```

Manuell prüfen: `wc -l js/games/sheetMusicReading/sheetMusicReading.js` etc. < 800.
