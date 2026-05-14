# Plan: Aufnahmen-Übersicht (Recordings Overview)

## Kontext

Derzeit gibt es keine zentrale Stelle, um alle gespeicherten Aufnahmen zu sehen und zu verwalten. Aufnahmen entstehen an zwei Stellen:

1. **Noten lesen** – speichert die letzte Aufnahme in IndexedDB (`gt-audio-analyse-db` / `recordings` / key `'last'`). Format: `{ wav: Uint8Array, manifest: object|null, savedAt: ISO }`.
2. **Akkord-Recorder** – speichert mehrere Aufnahmen in IndexedDB (`chord-recorder` / `recordings` / keyPath: `baseName`). Format: `{ baseName, wavBlob: Blob, sidecar: {...} }`.

Der Nutzer soll eine neue **Aufnahmen-Seite** öffnen können, alle Aufnahmen aus beiden Quellen in einer Liste sehen (Name, Größe, Datum) und eine davon auswählen. Über zwei Buttons kann er direkt in die **Audio-Analyse** oder den **Onset Tagger** springen – die Aufnahme wird dort automatisch geladen. Im Onset Tagger werden zusätzlich die Metadaten (Sidecar/Manifest) vorausgefüllt.

---

## Betroffene Dateien

### Neue Dateien

| Datei | Zweck |
|---|---|
| `pages/recordings/index.html` | Neue Toolseite „Aufnahmen" |
| `pages/recordings/bootstrap.js` | Mount-Script für die Seite |
| `js/tools/recordingsOverview/recordingsOverview.js` | UI-Feature (`createRecordingsOverviewFeature`) |
| `js/tools/recordingsOverview/recordingsOverviewStorage.js` | IndexedDB-Lesezugriffe auf beide DBs, liefert Metadaten-Liste |
| `js/tools/recordingsOverview/recordingsOverviewLogic.js` | Pure Hilfsfunktionen (unit-testbar) |
| `js/tools/recordingsOverview/CLAUDE.md` | Modul-Dokumentation |
| `js/shared/recordingLoader.js` | Shared: lädt WAV+Manifest aus beliebiger Quelle per `(source, id)` |
| `tests/unit/recordingsOverviewLogic.test.js` | Unit-Tests für Logic-Modul |

### Geänderte Dateien

| Datei | Änderung |
|---|---|
| `index.html` | Neuer `<gt-menu-card>` für Aufnahmen-Seite |
| `js/tools/audioAnalyse/audioAnalyse.js` | URL-Param-Handling in `mount()`: lädt Aufnahme per `source`+`id` |
| `js/tools/onsetTagger/onsetTagger.js` | URL-Param-Handling in `mount()`: lädt WAV + befüllt Sidecar-Formular |
| `sw.js` | Neue Seiten-Assets + JS-Module zur ASSETS-Liste |
| `js/shared/pwa/precacheManifest.js` | Neue Seite zu PAGE_URLS + neue JS-Dateien |

---

## Neue Funktionen / Exports

### `js/tools/recordingsOverview/recordingsOverviewLogic.js`

```js
// Dateigröße als lesbaren String
export function formatFileSize(bytes: number): string
// z.B. 0 → "0 B", 1500 → "1.5 KB", 2100000 → "2.0 MB"

// ISO-Datum als lokales DE-Datum-String
export function formatDate(isoString: string): string
// z.B. "2026-05-14T10:23:00.000Z" → "14.05.2026, 12:23"

// Anzeigename für eine Aufnahme
export function buildDisplayName(source: string, id: string, metadata: object|null): string
// source='sheet-music' → "Notenlesen-Aufnahme · {formatDate(metadata.savedAt)}"
// source='chord-recorder' → "{sidecar.chord} · {sidecar.technique} · {formatDate(sidecar.recordedAt)}"

// URL zum Öffnen in der Audio-Analyse (relativ zu pages/recordings/)
export function buildAudioAnalyseUrl(source: string, id: string): string
// → "../audio-analyse/index.html?source={source}&id={encodeURIComponent(id)}"

// URL zum Öffnen im Onset Tagger (relativ zu pages/recordings/)
export function buildOnsetTaggerUrl(source: string, id: string): string
// → "../onset-tagger/index.html?source={source}&id={encodeURIComponent(id)}"

// Sortiert RecordingEntry[] absteigend nach Datum (neueste zuerst)
export function sortByDate(recordings: RecordingEntry[]): RecordingEntry[]
```

**RecordingEntry-Typ** (intern, kein Export nötig):
```js
{
  id: string,              // 'last' | baseName
  source: 'sheet-music' | 'chord-recorder',
  name: string,            // via buildDisplayName
  sizeBytes: number,
  date: Date,
  metadata: object|null    // manifest oder sidecar
}
```

---

### `js/tools/recordingsOverview/recordingsOverviewStorage.js`

```js
// Liest Metadaten der Notenlesen-Aufnahme (ohne WAV-Bytes zu laden – nur Größe + Datum)
export async function getSheetMusicRecordingMeta(): Promise<RecordingEntry|null>

// Liest alle Chord-Recorder-Aufnahmen als Metadaten
// wavBlob.size für die Größe, sidecar.recordedAt für das Datum
export async function getChordRecordingsMeta(): Promise<RecordingEntry[]>

// Kombiniert beide Quellen, sortiert nach Datum absteigend
export async function getAllRecordingsMeta(): Promise<RecordingEntry[]>
```

**Nicht unit-testbar** (roher IndexedDB-Zugriff, zwei unterschiedliche Datenbanken).

---

### `js/shared/recordingLoader.js`

```js
// Lädt WAV-Bytes + Manifest aus beliebiger Aufnahme-Quelle
export async function loadRecordingFromSource(
  source: 'sheet-music' | 'chord-recorder',
  id: string
): Promise<{ wav: Uint8Array, manifest: object|null } | null>
```

Intern:
- `source='sheet-music'`: delegiert an `loadLastRecording()` aus `audioAnalyseStorage.js`
- `source='chord-recorder'`: liest Eintrag by `baseName` aus `chord-recorder`-DB, konvertiert `wavBlob` → `Uint8Array`, gibt `{ wav, manifest: sidecar }` zurück

**Nicht unit-testbar** (IndexedDB).

---

### `js/tools/audioAnalyse/audioAnalyse.js` – Ergänzung in `mount()`

```js
// Am Ende von mount(), nach wireDropzone(ui):
const params = new URLSearchParams(window.location.search);
const source = params.get('source');
const id     = params.get('id') ?? 'last';
if (source) void handleLoadFromSource(ui, source, id);

// Neue interne Funktion:
async function handleLoadFromSource(ui, source, id) {
  showStatus(ui, 'Lade Aufnahme…');
  const entry = await loadRecordingFromSource(source, id);
  if (!entry) { showStatus(ui, 'Aufnahme nicht gefunden.', true); return; }
  const name = source === 'sheet-music'
    ? `Notenlesen · ${new Date(entry.manifest?.savedAt ?? '').toLocaleString('de-DE')}`
    : (id ?? 'Aufnahme');
  await runAnalysis(ui, entry.wav.buffer, name, entry.manifest);
}
```

Import hinzufügen: `import { loadRecordingFromSource } from '../../shared/recordingLoader.js';`

---

### `js/tools/onsetTagger/onsetTagger.js` – Ergänzungen

**Neue interne Funktionen** (extrahiert aus `loadWav`/`loadJson`):

```js
// Extrahiert den core aus loadWav (ab reader.onload-Body)
async function applyWavBuffer(arrayBuffer, filename, ui)

// Extrahiert den core aus loadJson (ab Parsing)
function applySidecarData(sidecarObj, filename, ui)
```

`loadWav(file, ui)` delegiert dann an `applyWavBuffer(buffer, file.name, ui)`.
`loadJson(file, ui)` delegiert dann an `applySidecarData(parsed, file.name, ui)`.

**URL-Param-Handling** am Ende von `mount()`:

```js
import { loadRecordingFromSource } from '../../shared/recordingLoader.js';

// Am Ende von mount():
const params = new URLSearchParams(window.location.search);
const source = params.get('source');
const id     = params.get('id') ?? 'last';
if (source) {
  loadRecordingFromSource(source, id).then(entry => {
    if (!entry) return;
    const filename = source === 'chord-recorder' ? `${id}.wav` : 'notenlesen.wav';
    const sidecarFilename = source === 'chord-recorder' ? `${id}.json` : 'manifest.json';
    applyWavBuffer(entry.wav.buffer, filename, ui);
    if (entry.manifest) applySidecarData(entry.manifest, sidecarFilename, ui);
  });
}
```

---

## Teststrategie

### Unit-testbar: `recordingsOverviewLogic.js`

Datei: `tests/unit/recordingsOverviewLogic.test.js`

| Funktion | Eingabe | Erwartung |
|---|---|---|
| `formatFileSize` | `0` | `'0 B'` |
| `formatFileSize` | `1023` | `'1023 B'` |
| `formatFileSize` | `1024` | `'1.0 KB'` |
| `formatFileSize` | `1536` | `'1.5 KB'` |
| `formatFileSize` | `1048576` | `'1.0 MB'` |
| `formatFileSize` | `2100000` | `'2.0 MB'` |
| `formatDate` | `'2026-05-14T10:23:00.000Z'` | enthält `'2026'` und `'14'` |
| `formatDate` | `''` | `'–'` (Fallback für leeren String) |
| `formatDate` | `null` | `'–'` |
| `buildDisplayName` | `'sheet-music', 'last', { savedAt: '2026-05-14T10:00:00Z' }` | beginnt mit `'Notenlesen'`, enthält formatiertes Datum |
| `buildDisplayName` | `'chord-recorder', 'cmaj_finger_laut_single_abc12', { chord: 'C-Dur', technique: 'finger', recordedAt: '2026-05-14T10:00:00Z' }` | enthält `'C-Dur'` und `'finger'` |
| `buildDisplayName` | `'chord-recorder', 'cmaj_...', null` | gibt `'cmaj_...'` (baseName als Fallback) |
| `buildAudioAnalyseUrl` | `'sheet-music', 'last'` | `'../audio-analyse/index.html?source=sheet-music&id=last'` |
| `buildAudioAnalyseUrl` | `'chord-recorder', 'cmaj_finger_laut_single_abc12'` | URL enthält `source=chord-recorder` und encodierten id-Wert |
| `buildOnsetTaggerUrl` | `'sheet-music', 'last'` | `'../onset-tagger/index.html?source=sheet-music&id=last'` |
| `sortByDate` | Array mit drei Einträgen mit unterschiedlichen `date`-Werten | absteigend nach `date` sortiert |
| `sortByDate` | leeres Array | leeres Array |

### Nicht unit-testbar (DOM/IndexedDB)

- `recordingsOverviewStorage.js` – direkter IndexedDB-Zugriff auf zwei verschiedene Datenbanken
- `recordingLoader.js` – IndexedDB + Blob-Konvertierung
- `recordingsOverview.js` – DOM-Rendering, Event-Handler
- URL-Param-Handling in `audioAnalyse.js` und `onsetTagger.js` – `window.location`, `mount()`-Lifecycle

---

## TDD-Reihenfolge

1. **Rot:** `tests/unit/recordingsOverviewLogic.test.js` schreiben (alle Testfälle oben)
2. **Grün:** `js/tools/recordingsOverview/recordingsOverviewLogic.js` implementieren
3. `npm test` → alle Tests grün
4. Rest der Implementierung ohne weitere Unit-Tests (DOM/IndexedDB nicht unit-testbar)

---

## Implementierungsreihenfolge

### Schritt 1 – Pure Logic + Tests (TDD)
- `tests/unit/recordingsOverviewLogic.test.js` (rot)
- `js/tools/recordingsOverview/recordingsOverviewLogic.js` (grün)
- `npm test` bestätigt

### Schritt 2 – Shared Recording Loader
- `js/shared/recordingLoader.js`
  - `source='sheet-music'`: delegiert an bestehende `loadLastRecording()` aus `../../shared/audioAnalyseStorage.js`
  - `source='chord-recorder'`: öffnet `chord-recorder`-DB, lädt Eintrag per `baseName`, konvertiert `wavBlob.arrayBuffer()` → `Uint8Array`

### Schritt 3 – Storage-Modul
- `js/tools/recordingsOverview/recordingsOverviewStorage.js`
  - `getSheetMusicRecordingMeta()`: öffnet `gt-audio-analyse-db`, liest key `'last'`, gibt `RecordingEntry` zurück (sizeBytes = `wav.byteLength`, date = `savedAt`)
  - `getChordRecordingsMeta()`: öffnet `chord-recorder`-DB, `getAll()`, mappt je `{ baseName, wavBlob.size, sidecar.recordedAt }`
  - `getAllRecordingsMeta()`: kombiniert beide, sortiert mit `sortByDate`

### Schritt 4 – UI-Feature
- `js/tools/recordingsOverview/recordingsOverview.js`
  - `createRecordingsOverviewFeature()` → `{ mount(root), unmount() }`
  - `mount()`: lädt `getAllRecordingsMeta()`, rendert Liste, bindet Events
  - Auswahl-Logik: Klick auf Item → Item hervorheben, zwei Buttons einblenden
  - Button „Audio-Analyse öffnen" → `window.location.href = buildAudioAnalyseUrl(...)`
  - Button „Onset Tagger öffnen" → `window.location.href = buildOnsetTaggerUrl(...)`
  - Leer-Zustand: "Keine Aufnahmen vorhanden." wenn beide Quellen leer

### Schritt 5 – Seiten-HTML + Bootstrap
- `pages/recordings/index.html`
  - Standard-Struktur mit `<gt-exercise-header title="Aufnahmen" score-type="">` (kein Score)
  - Root-Element: `<section id="view-recordings">`
  - Liste: `<ul id="recordings-list">`, Aktions-Container: `<div id="recordings-actions">`
- `pages/recordings/bootstrap.js`
  - Standard-Pattern: registerServiceWorker, import components, mount feature

### Schritt 6 – Hauptmenü
- `index.html`: `<gt-menu-card icon="🎙️" title="Aufnahmen" subtitle="Alle gespeicherten Aufnahmen" href="pages/recordings/index.html">` im Werkzeuge-Bereich

### Schritt 7 – Audio Analyse: URL-Param-Handling
- `js/tools/audioAnalyse/audioAnalyse.js`
  - Import `loadRecordingFromSource` aus `../../shared/recordingLoader.js`
  - Neue Funktion `handleLoadFromSource(ui, source, id)` (analog zu `handleLoadLast`)
  - Ende von `mount()`: URL-Param-Check + automatisches Laden

### Schritt 8 – Onset Tagger: URL-Param-Handling + Sidecar-Befüllung
- `js/tools/onsetTagger/onsetTagger.js`
  - `applyWavBuffer(arrayBuffer, filename, ui)` aus `loadWav` extrahieren
  - `applySidecarData(sidecarObj, filename, ui)` aus `loadJson` extrahieren
  - Import `loadRecordingFromSource`
  - Ende von `mount()`: URL-Param-Check + automatisches Laden + Sidecar-Befüllung

### Schritt 9 – Service Worker + Precache
- `sw.js` ASSETS-Liste: neue Seite (`pages/recordings/index.html`, `pages/recordings/bootstrap.js`) und neue JS-Module ergänzen
- `js/shared/pwa/precacheManifest.js`: `pages/recordings/index.html` + `pages/recordings/bootstrap.js` zu PAGE_URLS

### Schritt 10 – Dokumentation
- `js/tools/recordingsOverview/CLAUDE.md`

---

## Verifikation

1. `npm test` → alle bestehenden 379 Tests + neue Logic-Tests grün
2. `npm run lint` → keine Fehler
3. Manuell im Browser:
   - In „Noten lesen" eine Aufnahme erstellen → Seite „Aufnahmen" öffnen → Notenlesen-Aufnahme erscheint mit Größe und Datum
   - Im „Akkord-Recorder" Aufnahmen erstellen → erscheinen ebenfalls in der Liste
   - Aufnahme auswählen → Buttons erscheinen
   - „Audio-Analyse öffnen" → Audio-Analyse lädt die Aufnahme direkt, ohne dass der Nutzer etwas auswählen muss
   - „Onset Tagger öffnen" → Onset Tagger lädt WAV + befüllt Metadaten-Formular automatisch
   - Leerer Zustand (keine Aufnahmen): Meldung erscheint
