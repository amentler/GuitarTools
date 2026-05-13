# Plan: Browser-Umgebungsmetadaten im Aufnahme-Sidecar

## Kontext

Beim Speichern einer Aufnahme in der Übung **Noten lesen** wird derzeit ein Manifest (Sidecar-JSON) gespeichert, das nur musikalische Metadaten enthält (Notes, BPM, Taktart, Zeitstempel). Zukünftige Anpassungen der Onset- und Pitch-Detection-Algorithmen werden möglicherweise browserspezifisch sein – verschiedene Browser kodieren das Audio intern unterschiedlich (webm/opus vs. ogg/opus vs. mp4), und Firefox auf Windows hat bereits einen bekannten Workaround. Um diese Browser-spezifischen Unterschiede nachvollziehen zu können, soll das Manifest künftig ein `browserEnv`-Feld enthalten.

**Geloggt werden soll:**
- Browser-Name + Version (Chrome, Firefox, Safari, Edge)
- OS-Name + Version (Windows, macOS, Linux, iOS, Android)
- Gerätemodell (z. B. "Pixel 7" auf Android) – wo verfügbar
- Tatsächlich verwendete MediaRecorder-MIME-Type (z. B. `audio/webm;codecs=opus`)
- Sprache des Browsers (`navigator.language`)
- Roher User-Agent-String (für manuelle Analyse)

**MediaRecorder-Eigenschaften:** Der `mediaRecorder.mimeType`-Getter gibt nach der Instanziierung den tatsächlich verwendeten MIME-Type zurück – zuverlässiger als der Kandidat aus `getSupportedMimeType()`. `audioBitsPerSecond` und `videoBitsPerSecond` sind vor dem Ende der Aufnahme nicht zuverlässig und die WAV-Ausgabe hat ohnehin eine deterministische PCM-Struktur – diese Felder werden daher nicht geloggt.

**Gerätemodell – technische Einschränkungen:**
- `navigator.userAgentData.getHighEntropyValues(['model', 'platformVersion'])` – async, nur Chromium (Chrome/Edge)
  - Liefert `model: "Pixel 7"` auf Android-Geräten
  - Liefert `model: ""` auf Desktop (bewusst leer gelassen)
  - Liefert `platformVersion` z. B. `"14.0.0"` (Android) oder `"10.0.0"` (Windows – genauer als UA-String)
- Fallback für Android-UA-String-Parsing: `(Linux; Android 14; Pixel 7)` enthält den Modellnamen
- iOS: Apple gibt kein Gerätemodell über Browser-APIs heraus → `model: ""` immer
- Desktop: kein Modell → `model: ""`

---

## Betroffene Dateien

| Datei | Änderung |
|---|---|
| **neu:** `js/shared/browserEnvironment.js` | Neue async Hilfsfunktion `collectBrowserEnvironment()` |
| `js/games/sheetMusicReading/sheetMusicRecorder.js` | Getter `mimeType` am Recorder-Objekt ergänzen |
| `js/games/sheetMusicReading/sheetMusicReading.js` | Stop-Handler: `browserEnv` async sammeln; `makeManifest()` bekommt `browserEnv`-Parameter |
| **neu:** `tests/unit/browserEnvironment.test.js` | Unit-Tests für `collectBrowserEnvironment()` |

**Keine Änderungen nötig:**
- `js/shared/audioAnalyseStorage.js` – speichert das Manifest-Objekt as-is
- IndexedDB-Schema – manifest ist ein generisches Objekt

---

## Neue Funktionen / Exports

### `js/shared/browserEnvironment.js`

```javascript
/**
 * Sammelt Browser/OS/Geräte-Metadaten für diagnostisches Logging.
 * Async wegen getHighEntropyValues() (Chromium), das Modell + präzise Plattform-Version liefert.
 * Auf Nicht-Chromium-Browsern fällt die Funktion auf UA-String-Parsing zurück.
 *
 * @param {string} [recorderMimeType='']
 * @param {Navigator} [nav=globalThis.navigator]  – injizierbar für Tests
 * @returns {Promise<{
 *   userAgent: string,
 *   browser: string,
 *   browserVersion: string,
 *   os: string,
 *   osVersion: string,
 *   model: string,
 *   language: string,
 *   recorderMimeType: string
 * }>}
 */
export async function collectBrowserEnvironment(recorderMimeType = '', nav = globalThis.navigator)
```

**Felder:**
- `userAgent` – roher UA-String (`nav.userAgent`)
- `browser` – `'Chrome'|'Firefox'|'Safari'|'Edge'|'Unknown'` (UA-Parsing; Edge vor Chrome prüfen)
- `browserVersion` – Versionsstring aus dem UA (z. B. `'124.0.0.0'`)
- `os` – `'Windows'|'macOS'|'Linux'|'iOS'|'Android'|'Unknown'`
- `osVersion` – präzise Version aus `getHighEntropyValues` wenn verfügbar, sonst UA-Parsing
- `model` – Gerätemodell (z. B. `'Pixel 7'` auf Android, `''` auf Desktop/iOS)
- `language` – `nav.language ?? ''`
- `recorderMimeType` – direkt durchgereicht

**Implementierungslogik:**

```javascript
export async function collectBrowserEnvironment(recorderMimeType = '', nav = globalThis.navigator) {
  const ua = nav?.userAgent ?? '';
  const base = parseUserAgent(ua, nav);  // sync, gibt { browser, browserVersion, os, osVersion, model }

  // High-Entropy-Values (Chromium only, kein User-Prompt nötig)
  if (nav?.userAgentData?.getHighEntropyValues) {
    try {
      const high = await nav.userAgentData.getHighEntropyValues(['model', 'platformVersion']);
      if (high.model)           base.model     = high.model;
      if (high.platformVersion) base.osVersion = high.platformVersion;
    } catch {
      // ignorieren – Fallback-Werte aus parseUserAgent bleiben
    }
  }

  return { ...base, language: nav?.language ?? '', recorderMimeType, userAgent: ua };
}
```

**Browser-Erkennung (UA-Parsing-Reihenfolge, Funktion `parseUserAgent`):**
1. `Edg/` → Edge (vor Chrome prüfen, da Edge UA auch `Chrome/` enthält)
2. `Firefox/` → Firefox
3. `Chrome/` → Chrome
4. `Safari/` + `Version/` → Safari (ohne Chrome → reines Safari)
5. Sonst → Unknown

**OS-Erkennung:**
1. `nav.userAgentData.platform` wenn verfügbar (synchron, low-entropy)
2. Fallback UA-Parsing: `Windows NT {x}` → Windows + Version, `Macintosh; Intel Mac OS X {x}` → macOS, `iPhone|iPad` → iOS, `Android {x}; {model}` → Android + Version + Modell, `Linux` → Linux

**Modell-Extraktion aus UA (Android-Fallback):**
```
(Linux; Android 14; Pixel 7)  →  model = 'Pixel 7'
Regex: /Android [^;]+; ([^)]+)\)/
```

### `js/games/sheetMusicReading/sheetMusicRecorder.js`

Neuer Getter im Return-Objekt von `createRecorder()`:
```javascript
get mimeType() { return mimeType; }
```

### `js/games/sheetMusicReading/sheetMusicReading.js`

```javascript
// Import ergänzen:
import { collectBrowserEnvironment } from '../../shared/browserEnvironment.js';

// makeManifest() bekommt fertiges browserEnv-Objekt (keine eigene async-Logik):
function makeManifest(bars, bpm, timeSig, browserEnv)
// → fügt browserEnv direkt ins Manifest ein

// Stop-Button-Handler (ca. Zeile 560):
const capturedMimeType = recorder.mimeType;          // vor stop(), da cleanup() es löscht
const [wav, browserEnv] = await Promise.all([
  recorder.stop(),
  collectBrowserEnvironment(capturedMimeType),
]);
// ...
const manifest = makeManifest(state.bars, state.bpm, state.timeSig, browserEnv);
```

---

## Teststrategie

### Was unit-testbar ist

`collectBrowserEnvironment()` nimmt `nav` als Parameter → vollständig testbar durch Mock-Navigator-Objekte ohne echten Browser. Async, also `await` in Tests nötig.

### Was NICHT unit-testbar ist

- Integration: das `browserEnv`-Feld im Download-ZIP oder in IndexedDB
- `recorder.mimeType`-Getter: MediaRecorder ist Browser-API, nicht in Vitest verfügbar

### Neue Test-Datei: `tests/unit/browserEnvironment.test.js`

**Testfälle:**

| # | Eingabe | Erwartung |
|---|---|---|
| 1 | Chrome 124 / Windows 10 UA | `{ browser: 'Chrome', browserVersion: '124.0.0.0', os: 'Windows', osVersion: '10.0' }` |
| 2 | Firefox 126 / Windows 10 UA | `{ browser: 'Firefox', browserVersion: '126.0', os: 'Windows', osVersion: '10.0' }` |
| 3 | Safari 17 / macOS 14 UA | `{ browser: 'Safari', browserVersion: '17.4.1', os: 'macOS', osVersion: '14_4_1' }` |
| 4 | Edge 124 / Windows 10 UA | `{ browser: 'Edge', browserVersion: '124.0.0.0', os: 'Windows' }` |
| 5 | Chrome / Android 14 / Pixel 7 UA | `{ browser: 'Chrome', os: 'Android', model: 'Pixel 7', osVersion: '14' }` |
| 6 | Mit `userAgentData.platform = 'Windows'` (sync) | `os: 'Windows'` aus userAgentData |
| 7 | Mit `getHighEntropyValues` mock → `model: 'Pixel 7', platformVersion: '14.0.0'` | `model: 'Pixel 7'`, `osVersion: '14.0.0'` |
| 8 | `getHighEntropyValues` wirft → Fallback-Werte aus UA | kein Crash, UA-basierte Werte |
| 9 | `recorderMimeType: 'audio/webm;codecs=opus'` | `recorderMimeType: 'audio/webm;codecs=opus'` |
| 10 | `language: 'de-DE'` | `language: 'de-DE'` |
| 11 | Leerer UA-String | `{ browser: 'Unknown', os: 'Unknown', browserVersion: '', osVersion: '', model: '' }` |
| 12 | `nav = null` | kein Crash, Fallback-Objekt mit Leer-Strings |

**Beispiel-UA-Strings:**
```
Chrome/Windows:  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36'
Firefox/Windows: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:126.0) Gecko/20100101 Firefox/126.0'
Safari/macOS:    'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_4_1) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4.1 Safari/605.1.15'
Edge/Windows:    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36 Edg/124.0.0.0'
Chrome/Android:  'Mozilla/5.0 (Linux; Android 14; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.6367.82 Mobile Safari/537.36'
```

---

## TDD-Reihenfolge

1. **Rot:** `tests/unit/browserEnvironment.test.js` schreiben → schlägt fehl (Modul fehlt)
2. **Grün:** `js/shared/browserEnvironment.js` implementieren → Tests grün
3. Getter `get mimeType()` in `sheetMusicRecorder.js` ergänzen
4. `makeManifest()` + Stop-Handler in `sheetMusicReading.js` anpassen
5. `npm test` – alle 379 + neue Tests grün
6. `npm run lint` – keine Fehler

---

## Implementierungsreihenfolge

1. `tests/unit/browserEnvironment.test.js` anlegen (TDD – rot)
2. `js/shared/browserEnvironment.js` anlegen + implementieren (grün)
3. `js/games/sheetMusicReading/sheetMusicRecorder.js`: Getter `mimeType` ergänzen
4. `js/games/sheetMusicReading/sheetMusicReading.js`:
   - Import `collectBrowserEnvironment`
   - Stop-Handler: `Promise.all` für `recorder.stop()` + `collectBrowserEnvironment()`
   - `makeManifest()` Signatur anpassen (`browserEnv` statt `recorderMimeType`)
5. `npm test` + `npm run lint`

---

## Ergebnis-Manifest (Beispiel – Android/Chrome)

```json
{
  "notes": ["C4", "E4", "G4", "C5"],
  "bpm": 120,
  "timeSig": "4/4",
  "notesPerBeat": 1,
  "description": "Noten lesen",
  "category": "sheet-music-reading",
  "recordedAt": "2026-05-13T10:00:00.000Z",
  "browserEnv": {
    "userAgent": "Mozilla/5.0 (Linux; Android 14; Pixel 7) ...",
    "browser": "Chrome",
    "browserVersion": "124.0.6367.82",
    "os": "Android",
    "osVersion": "14.0.0",
    "model": "Pixel 7",
    "language": "de-DE",
    "recorderMimeType": "audio/webm;codecs=opus"
  }
}
```

## Ergebnis-Manifest (Desktop/Firefox)

```json
{
  "browserEnv": {
    "userAgent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:126.0) ...",
    "browser": "Firefox",
    "browserVersion": "126.0",
    "os": "Windows",
    "osVersion": "10.0",
    "model": "",
    "language": "de-DE",
    "recorderMimeType": "audio/webm;codecs=opus"
  }
}
```
