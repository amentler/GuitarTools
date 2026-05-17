# Plan: WAV+JSON ZIP Bundle Format (`filesystem-rework`)

## Kontext

Aktuell werden WAV-Dateien und ihre JSON-Sidecars in den Export-ZIPs flat nebeneinander abgelegt (z. B. `recording1.wav` + `recording1.json` + `recording2.wav` + … direkt im ZIP). Beim Import lädt der Onset-Tagger WAV und JSON über zwei getrennte Datei-Eingaben; Audio-Analyse akzeptiert nur WAV.

**Ziel:** WAV und JSON gehören immer als Paar in eine gemeinsame ZIP-Datei.

- **Einzelne Aufnahme exportieren:** `basename.zip` enthält direkt `basename.wav` + `basename.json`
- **Mehrere Aufnahmen exportieren:** Container-ZIP mit je einem Inner-ZIP pro Aufnahme
- **Import:** Onset-Tagger und Audio-Analyse akzeptieren ZIP-Dateien und extrahieren WAV + JSON daraus

Betrifft Export in: Noten lesen, Akkord-Recorder, Onset-Tagger, Aufnahmen-Übersicht.
Betrifft Import in: Onset-Tagger, Audio-Analyse.

---

## Betroffene Dateien

### Neue Exports in `js/shared/zip.js`
- `buildRecordingZip(baseName, wavData, jsonData)` → Uint8Array  — `jsonData` immer Pflicht; Aufrufer liefern mindestens `enc.encode('{}')` wenn kein echter Sidecar vorhanden
- `buildCollectionZip(recordings: {baseName, wav, json}[])` → Uint8Array
- `readZip(data: Uint8Array)` → `{name, data}[]`

### Export-Änderungen
| Datei | Geänderte Funktion |
|---|---|
| `js/games/sheetMusicReading/sheetMusicReadingRecordingUI.js` | `downloadRecordings()` |
| `js/tools/chordRecorder/chordRecorderFiles.js` | `downloadAllAsZip()` |
| `js/tools/onsetTagger/onsetTagger.js` | `handleExport()` |
| `js/tools/recordingsOverview/recordingsOverviewStorage.js` | `getRecordingsForZip()` (Rückgabetyp), `downloadRecordingsAsZip()` |

### Import-Änderungen
| Datei | Geänderte Funktion | Was sich ändert |
|---|---|---|
| `js/tools/onsetTagger/onsetTagger.js` | neue `loadZip(file, ui)`, mount-Verdrahtung | ZIP-Lade-Button hinzufügen |
| `pages/onset-tagger/index.html` | Datei-Laden-Bereich | ZIP-Input + Button hinzufügen |
| `js/tools/audioAnalyse/audioAnalyse.js` | `handleFileInput()` | `.zip` erkennen, WAV+JSON extrahieren |
| `pages/audio-analyse/index.html` | `<input accept=...>` | `.zip,application/zip` ergänzen |

### Test-Dateien
| Datei | Aktion |
|---|---|
| `tests/unit/zip.test.js` | Neue Tests für `buildRecordingZip`, `buildCollectionZip`, `readZip` |
| `tests/unit/chordRecorderZip.test.js` | Anpassen an neues ZIP-Format (Inner-ZIP-Struktur) |
| `tests/unit/sheetMusicZip.test.js` | Anpassen an neues ZIP-Format |
| `tests/unit/sheetMusicReadingController.test.js` | Import-Mock ggf. anpassen |

---

## Neue Funktionen / Exports (`js/shared/zip.js`)

```js
/**
 * Builds a single-recording ZIP: baseName.wav + baseName.json.
 * @param {string} baseName  — ohne Erweiterung
 * @param {Uint8Array} wavData
 * @param {Uint8Array} jsonData
 * @returns {Uint8Array}
 */
export function buildRecordingZip(baseName, wavData, jsonData) {
  return buildZip([
    { name: `${baseName}.wav`,  data: wavData  },
    { name: `${baseName}.json`, data: jsonData },
  ]);
}

/**
 * Builds a container ZIP where each entry is an inner recording ZIP.
 * @param {Array<{ baseName: string, wav: Uint8Array, json: Uint8Array }>} recordings
 * @returns {Uint8Array}
 */
export function buildCollectionZip(recordings) {
  const files = recordings.map(({ baseName, wav, json }) => ({
    name: `${baseName}.zip`,
    data: buildRecordingZip(baseName, wav, json),
  }));
  return buildZip(files);
}

/**
 * Reads a Store-mode ZIP and returns all file entries.
 * Only handles Store (uncompressed, method 0) entries.
 * @param {Uint8Array} data
 * @returns {Array<{ name: string, data: Uint8Array }>}
 */
export function readZip(data) {
  const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
  const entries = [];
  let offset = 0;
  while (offset + 4 <= data.length) {
    if (view.getUint32(offset, true) !== 0x04034B50) break;
    const compressedSize = view.getUint32(offset + 18, true);
    const nameLen        = view.getUint16(offset + 26, true);
    const extraLen       = view.getUint16(offset + 28, true);
    const name           = new TextDecoder().decode(data.slice(offset + 30, offset + 30 + nameLen));
    const dataStart      = offset + 30 + nameLen + extraLen;
    entries.push({ name, data: data.slice(dataStart, dataStart + compressedSize) });
    offset = dataStart + compressedSize;
  }
  return entries;
}
```

---

## Implementierungsreihenfolge (TDD: Rot → Grün)

### Schritt 1 – Tests für neue ZIP-Funktionen (Rot)
**`tests/unit/zip.test.js`** — neue `describe`-Blöcke anhängen:

**`buildRecordingZip`:**
- Gibt Uint8Array zurück mit Local-Header-Signatur
- Hat genau 2 EOCD-Einträge
- Erste Entry heißt `${baseName}.wav`, zweite `${baseName}.json`
- WAV-Daten und JSON-Daten landen unverändert in den Entries

**`buildCollectionZip`:**
- Leere Liste → leeres ZIP (0 Einträge)
- N Aufnahmen → N Einträge im äußeren ZIP, jede Entry endet auf `.zip`
- Jede Inner-Entry ist selbst ein gültiges ZIP (beginnt mit `PK\x03\x04`)
- Round-trip: Inner-ZIP mit `readZip` lesen → `baseName.wav` + `baseName.json` vorhanden

**`readZip`:**
- Leeres ZIP → leeres Array
- Round-trip über `buildZip`: `readZip(buildZip([{name:'a.wav', data:X}]))` → `[{name:'a.wav', data:X}]`
- Liest `buildRecordingZip`-Output korrekt (2 Entries mit richtigen Namen)
- Ignoriert Central-Directory + EOCD (nur Local-Headers auswerten)

### Schritt 2 – Implementierung in `zip.js` (Grün)
Drei Funktionen gemäß Signaturen oben implementieren. Alle neuen Tests grün.

### Schritt 3 – Export-Tests anpassen (Rot)
**`tests/unit/chordRecorderZip.test.js`:**
- Einzelne Aufnahme → `buildRecordingZip` aufgerufen (nicht flat `buildZip` mit 2 Files)
- Mehrere Aufnahmen → `buildCollectionZip` aufgerufen; äußeres ZIP hat N Inner-ZIP-Entries

**`tests/unit/sheetMusicZip.test.js`:**
- Einzelne Aufnahme → direktes Recording-ZIP (2 Entries: WAV + JSON)
- Mehrere Aufnahmen → Container-ZIP mit Inner-ZIPs

### Schritt 4 – Export-Implementierung (Grün)

**`sheetMusicReadingRecordingUI.js`** — `downloadRecordings()`:
```js
function downloadRecordings() {
  const savedRecordings = getSaved();
  if (!savedRecordings.length) return;
  const enc = new TextEncoder();
  if (savedRecordings.length === 1) {
    const { baseName, wav, manifest } = savedRecordings[0];
    const zip = buildRecordingZip(baseName, wav, enc.encode(JSON.stringify(manifest, null, 2)));
    downloadBlob(zip, `${baseName}.zip`, 'application/zip');
  } else {
    const recs = savedRecordings.map(({ baseName, wav, manifest }) => ({
      baseName, wav, json: enc.encode(JSON.stringify(manifest, null, 2)),
    }));
    downloadBlob(buildCollectionZip(recs), `noten-lesen-aufnahmen-${Date.now()}.zip`, 'application/zip');
  }
  if (confirm('Gespeicherte Aufnahmen jetzt löschen?')) { setSaved([]); syncRecordingUI(); }
}
```
Import-Zeile anpassen: `buildZip` → `buildRecordingZip, buildCollectionZip`.

**`chordRecorderFiles.js`** — `downloadAllAsZip()`:
```js
export async function downloadAllAsZip(basename = 'chord-recordings') {
  const recordings = getAllRecordings();
  if (recordings.length === 0) return;
  const enc = new TextEncoder();
  if (recordings.length === 1) {
    const { baseName, wavBlob, sidecar } = recordings[0];
    const wav  = new Uint8Array(await wavBlob.arrayBuffer());
    const json = enc.encode(JSON.stringify(sidecar, null, 2));
    downloadBlobShared(buildRecordingZip(baseName, wav, json), `${baseName}.zip`, 'application/zip');
  } else {
    const recs = [];
    for (const { baseName, wavBlob, sidecar } of recordings) {
      recs.push({
        baseName,
        wav:  new Uint8Array(await wavBlob.arrayBuffer()),
        json: enc.encode(JSON.stringify(sidecar, null, 2)),
      });
    }
    downloadBlobShared(buildCollectionZip(recs), `${basename}.zip`, 'application/zip');
  }
}
```

**`onsetTagger.js`** — `handleExport()` (immer Einzelaufnahme → kein Container):
```js
function handleExport(ui) {
  if (!_wavArrayBuffer) return;
  const formValues = readMetaForm(ui);
  const sidecar    = buildSidecarWithOnsets(formValues, _onsetsMs);
  const jsonBytes  = new TextEncoder().encode(JSON.stringify(sidecar, null, 2));
  const wavName    = _wavFilename || 'recording.wav';
  const base       = wavName.replace(/\.wav$/i, '');
  downloadBlob(buildRecordingZip(base, new Uint8Array(_wavArrayBuffer), jsonBytes), `${base}-tagged.zip`, 'application/zip');
}
```
Import-Zeile ergänzen: `readZip` für Import hinzufügen.

**`recordingsOverviewStorage.js`** — Rückgabetyp ändern:

Vorher (flat): `{ name: string, wav: Uint8Array }[]` (ein Eintrag je WAV, ein Eintrag je JSON)  
Nachher (per-Recording): `{ baseName: string, wav: Uint8Array, json?: Uint8Array }[]`

```js
export async function getRecordingsForZip(recordings) {
  const enc = new TextEncoder();
  const results = [];
  // Sheet-Music-Takes:
  for (const take of matchingTakes) {
    results.push({
      baseName: take.baseName ?? take.id,
      wav:  take.wav,
      json: enc.encode(JSON.stringify(take.sidecar ?? {}, null, 2)),  // immer vorhanden, ggf. leeres Objekt
    });
  }
  // Chord-Recorder-Entries analog …
  return results;
}

export async function downloadRecordingsAsZip(recordings, zipName) {
  if (recordings.length === 0) return;
  const pairs = await getRecordingsForZip(recordings);
  if (pairs.length === 0) return;
  if (pairs.length === 1) {
    const { baseName, wav, json } = pairs[0];
    downloadBlob(
      buildRecordingZip(baseName, wav, json ?? new TextEncoder().encode('{}')),
      `${baseName}.zip`,
      'application/zip',
    );
  } else {
    downloadBlob(buildCollectionZip(pairs), zipName, 'application/zip');
  }
}
```

### Schritt 5 – Import-Implementierung

**`pages/onset-tagger/index.html`** — ZIP-Button nach dem JSON-Button:
```html
<div class="tagger-load-btn">
  <button id="tagger-zip-btn" class="btn-play-stop" type="button">ZIP laden</button>
  <input id="tagger-zip-input" type="file" accept=".zip,application/zip" class="u-hidden" />
  <span id="tagger-zip-label" class="tagger-file-label">keine Datei</span>
</div>
```

**`onsetTagger.js`** — `resolveUI()` erweitern + `loadZip()`:
```js
async function loadZip(file, ui) {
  const buf     = await file.arrayBuffer();
  const entries = readZip(new Uint8Array(buf));
  const wavEntry  = entries.find(e => e.name.toLowerCase().endsWith('.wav'));
  const jsonEntry = entries.find(e => e.name.toLowerCase().endsWith('.json'));
  if (!wavEntry) {
    if (ui.zipLabel) ui.zipLabel.textContent = 'Keine WAV-Datei in ZIP';
    return;
  }
  if (ui.zipLabel) ui.zipLabel.textContent = file.name + ' ✓';
  await applyWavBuffer(wavEntry.data.buffer, wavEntry.name, ui);
  if (jsonEntry) {
    try {
      applySidecarData(JSON.parse(new TextDecoder().decode(jsonEntry.data)), jsonEntry.name, ui);
    } catch (err) {
      if (ui.jsonLabel) ui.jsonLabel.textContent = `Fehler: ${err.message}`;
    }
  }
  // Kein JSON-Eintrag in ZIP → kein Problem: enableStep2 initialisiert das Formular
  // mit DEFAULT_SIDECAR_FIELDS; beim Export wird ein Sidecar aus dem Formular gebaut.
}
```
In `mount()`: ZIP-Button und ZIP-Input verdrahten (analog WAV/JSON-Buttons).

> **Wichtig – Import ohne Sidecar:** Aufnahmen können immer ohne JSON importiert werden (WAV-only oder ZIP ohne JSON-Entry). Das Formular wird dann mit `DEFAULT_SIDECAR_FIELDS` initialisiert. Beim nächsten Export enthält die ZIP *immer* ein JSON (aus dem aktuellen Formular-Stand), auch wenn es nur Leer-/Default-Werte enthält. Dieses Verhalten gilt analog für alle vier Import-Pfade (WAV-Datei, JSON-Datei, ZIP, Auto-Load via URL).

**`pages/audio-analyse/index.html`** — Accept-Attribut + Label:
```html
<input type="file" id="input-wav-file" accept=".wav,audio/wav,.zip,application/zip" />
<label for="input-wav-file">WAV- oder ZIP-Datei wählen</label>
```

**`audioAnalyse.js`** — `handleFileInput()` erweitern (ZIP-Zweig zuerst):
```js
async function handleFileInput(ui, file) {
  if (!file) return;
  if (file.name.toLowerCase().endsWith('.zip') || file.type === 'application/zip') {
    const buf       = await file.arrayBuffer();
    const entries   = readZip(new Uint8Array(buf));
    const wavEntry  = entries.find(e => e.name.toLowerCase().endsWith('.wav'));
    if (!wavEntry) { showStatus(ui, 'Keine WAV-Datei in der ZIP gefunden.', true); return; }
    const jsonEntry = entries.find(e => e.name.toLowerCase().endsWith('.json'));
    const sidecar   = jsonEntry
      ? (() => { try { return JSON.parse(new TextDecoder().decode(jsonEntry.data)); } catch { return undefined; } })()
      : undefined;
    showStatus(ui, `Lese ${wavEntry.name} aus ZIP…`);
    await runAnalysis(ui, wavEntry.data.buffer, wavEntry.name, sidecar);
    return;
  }
  if (!file.name.endsWith('.wav') && file.type !== 'audio/wav') {
    showStatus(ui, 'Bitte eine WAV- oder ZIP-Datei auswählen.', true);
    return;
  }
  showStatus(ui, `Lese ${file.name}…`);
  await runAnalysis(ui, await file.arrayBuffer(), file.name);
}
```
`readZip` in Import-Zeile ergänzen.

---

## Teststrategie

### Unit-testbar
| Was | Eingabe | Erwartung |
|---|---|---|
| `buildRecordingZip('foo', wav, json)` | 3 Argumente | ZIP mit 2 Entries `foo.wav` + `foo.json`, Daten korrekt |
| `buildCollectionZip([{baseName:'a',wav,json}, {baseName:'b',wav,json}])` | 2 Paare | äußeres ZIP mit 2 Entries `a.zip` + `b.zip`, je als gültiges ZIP |
| `readZip(buildZip([{name:'x.wav',data:X}]))` | Store-ZIP | `[{name:'x.wav', data:X}]` Round-trip |
| `readZip(buildRecordingZip('r', wav, json))` | Recording-ZIP | 2 Entries mit Namen `r.wav` + `r.json` |
| `readZip` auf leerem ZIP | 22-Byte EOCD | `[]` |
| Einzelaufnahme-Export (alle 4 Tools) | 1 Recording | `buildRecordingZip` aufgerufen, kein Container |
| Multi-Aufnahmen-Export | N Recordings | `buildCollectionZip` aufgerufen |
| `getRecordingsForZip` Rückgabetyp | gemockte DB | `{baseName, wav, json}[]` (nicht flat) |

### Nicht unit-testbar (nur E2E)
- HTML-File-Input-Wiring im Onset-Tagger
- Drag & Drop ZIP in Audio-Analyse
- `downloadBlob` (bereits gemockt in bestehenden Tests)
- `AudioContext.decodeAudioData` im WAV-Lade-Pfad

### Bestehende Tests, die angepasst werden müssen
- `chordRecorderZip.test.js` — flat-ZIP-Erwartungen durch Inner-ZIP-Prüfungen ersetzen
- `sheetMusicZip.test.js` — flat-ZIP-Erwartungen durch neue Struktur ersetzen
- `sheetMusicReadingController.test.js` — `buildZip`-Mock ggf. auf `buildRecordingZip` anpassen

---

## Hinweise

- `import-onset-zip.mjs` muss **nicht** geändert werden: Onset-Tagger exportiert immer Einzelaufnahmen → bleibt flaches ZIP (WAV + JSON direkt).
- `import-drop-fixtures.mjs` muss **nicht** geändert werden: Chord-Recorder-Einzelexporte bleiben flach.
- IndexedDB-Schema bleibt unverändert (WAV als Uint8Array, JSON als Object); ZIP-Konvertierung nur beim Export.
- `sw.js` / Asset-Liste: keine neuen Dateien → kein Update nötig.
- Nach Implementierung: `graphify update .` ausführen und CLAUDE.md der betroffenen Module aktualisieren.

---

## Status

- [ ] Schritt 1: Tests zip.js (buildRecordingZip, buildCollectionZip, readZip) — ROT
- [ ] Schritt 2: Implementierung zip.js — GRÜN
- [ ] Schritt 3: Export-Tests anpassen (chordRecorderZip, sheetMusicZip) — ROT
- [ ] Schritt 4: Export-Implementierung (alle 4 Tools) — GRÜN
- [ ] Schritt 5: Import-Implementierung (onsetTagger, audioAnalyse) — GRÜN
- [ ] Schritt 6: `npm run test:precommit` grün
- [ ] Schritt 7: `graphify update .`
