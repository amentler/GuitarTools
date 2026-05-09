# sheetMusicReading – Noten lesen Übung

Zeigt 4 zufällige Takte in C-Dur auf einer Notenzeile an.
Metronom (BPM-Slider), wählbare Taktart (2/4–6/8), bewegender Playback-Cursor.
Endlos-Modus: 3-zeiliges Sliding-Window, auto-scrollend.
Optional: Tabs unterhalb der Notenzeile.
Optionaler Aktiv-Modus: Mikrofon-basierte Tonprüfung.
`Aktiv` und `Metronom` sind getrennte Modi:
- `Aktiv` ohne Metronom: sequentielle Tonprüfung
- `Aktiv` mit Metronom: zeitgebundene Tonprüfung, nur die aktuelle Note zählt

## Dateien

### `sheetMusicLogic.js`
- `NOTES` – 24 Noten in C-Dur, Bünde 0–5, Saiten 1–6 (E2–A4 sounding, vfKey = written pitch); Bünde 4–5 enthalten Alternativ-Positionen (gleiche Tonhöhe, andere Saite/Bund)
- `generateBars(numBars, beatsPerBar, notesPool?)` → `Note[][]`
- `getFilteredNotes(maxFret, activeStrings)` → gefilterter Note-Pool
- `getTimeSignatureConfig(sig)` → `{ beatsPerBar, noteDuration, vfTimeSig }` für 2/4, 3/4, 4/4, 3/8, 6/8
- `validateTimeSignature(sig)` → boolean
- `EndlessBarGenerator(beatsPerBar, notesPool)` – stateful; `nextBatch(count=4)` → `Note[][]`; `reset()`; `setNotesPool()`; `setBeatsPerBar()`
- `calcScrollTarget(rowIndex, rowDisplayHeight, viewportHeight, targetFraction=0.33)` → scrollTop (pure)
- `calcFirstBarWidth(tsw, restBarW, marginW)` → `tsw + (restBarW - marginW)` – equalises note area of bar 0 with bars 1–N

### `sheetMusicSVG.js`
- `renderScore(container, bars, showTab, timeSig)` → `{ notationDiv, staveLayout, vw }` (normal mode; clears container)
- `appendRow(container, bars, showTab, timeSig)` → `{ notationDiv, staveLayout, rowDiv, vw }` (endless mode; appends row)
- Shared: `_renderNotation(bars, timeSig)` – VexFlow rendering into new `notation-wrapper` div
- `staveLayout`: `Array<{ noteStartX, noteEndX }>` – VexFlow-Koordinaten je Takt für `PlaybackBar`
- Noten- und Tab-Rendering respektiert optional `note.status`:
  - `current` → orange
  - `correct` → grün
  - `wrong` → rot
- Renderingbasis: VexFlow (CDN), viewBox `vw×240`; `vw` is dynamic via `calcFirstBarWidth(tsw, REST_BAR_W, marginW) + 3×REST_BAR_W`
- `REST_BAR_W=128`; `firstBarW≈208` computed to equalise bar-0 note area with bars 1–3 (no trailing gap)

### `playbackController.js`
- Klasse `PlaybackController` – wrапpt `MetronomeLogic`
- `start(bpm, beatsPerBar, totalBeats?)` – AudioContext lazy-init, Beat-Tracking
- `stop()`, `setBpm(bpm)`, `onBeat(callback)`, `getCurrentBeat()` → `{ barIndex, beatIndex }`
- `_globalBeat` zählt alle Beats; `_beatsPerBar` und `_totalBeats` steuern die Positionsberechnung

### `playbackBar.js`
- `calcBeatX(staveLayout, barIndex, beatIndex, beatsPerBar)` → x in VexFlow-Koordinaten (pure, testbar)
- Klasse `PlaybackBar`:
  - `render(container, staveLayout, vw?, vh?)` – erstellt SVG-Overlay (`<rect class="playback-rect">`)
  - `moveToBeat(barIndex, beatIndex, beatsPerBar, beatDurationSec?)` – CSS-Transition auf `x`-Attribut
  - `show()` / `hide()` / `destroy()`

### `sheetMusicReading.js`
- `startExercise()` / `stopExercise()`
- Passiver Endlosmodus verwendet ein 3-Zeilen-Fenster; beim Zeilenwechsel wird
  weich zur naechsten Zeile gescrollt und danach die aelteste Zeile entfernt
- Zustand enthält zusätzlich den optionalen Aktivmodus:
  - `active`, `currentBarIndex`, `currentBeatIndex`
  - `isListening`, `isLocked`
  - `matchState`, `onsetState`, `awaitingOnset`
- Audio im Aktivmodus:
  - `requestMicrophoneStream`
  - `openAudioSession` / `closeAudioSession`
  - `classifyFrame` + `updateMatchState`
  - `getRecommendedFftSize` pro Zielnote
  - `guitarOnsetDetector.js` erkennt frische Anschlaege pitch-unabhaengig
    per breitbandigem Spektralfluss; nach einem Anschlag bleibt der
    Erkennungsversuch offen, bis die Zielnote akzeptiert oder ein neuer
    Anschlag als neuer Versuch erkannt wird.
  - `sheetMusicRecognition.js` legt eine bewusst weichere Uebungs-Akzeptanz
    ueber den strengen Shared-Matcher: groessere Cent-Toleranz, direkte
    Annahme eines verwertbaren Treffers und eine eng begrenzte Subharmonik-
    Toleranz nur fuer den bekannten D3-als-D2-Fall, weil die Uebung kein
    Tuner ist und andere Oktavverwechslungen nicht akzeptieren darf.
- Test-/Legacy-Hooks:
  - `?active=1` aktiviert den Aktivmodus direkt beim Laden
  - `window.__GT_SHEET_MUSIC_READING_BARS__` injiziert deterministische Notenfolgen
- localStorage-Persistenz: `sheetMusic_active`, `sheetMusic_bpm`, `sheetMusic_timeSig`, `sheetMusic_showTab`, `sheetMusic_endless`
- Buttons: `#btn-sheet-active-mode`, `#btn-sheet-play` (Play/Stop), `#btn-new-bars`, `#btn-show-tab`, `#btn-endless-mode`, `#btn-record`, `#btn-record-stop`, `#btn-record-cancel`, `#btn-download-recordings`
- Slider: `#sheet-music-bpm-slider` (40–240), `#sheet-music-fret-range-slider`
- Select: `#sheet-music-time-sig` (2/4|3/4|4/4|3/8|6/8)
- `wired`-Flag verhindert doppeltes Event-Listener-Wiring

### `sheetMusicRecorder.js`
- `createRecorder()` → `{ start(), stop(), cancel(), isRecording }`
- `start()`: öffnet eigenen Mic-Stream + ScriptProcessorNode (unabhängig vom Aktiv-Modus)
- `stop()`: gibt 16-bit-mono-WAV als `Uint8Array` zurück, räumt auf; gibt `null` zurück falls keine Daten
- `cancel()`: räumt auf, kein Rückgabewert

### `sheetMusicZip.js`
- `buildZip(files)` → `Uint8Array` – Store-ZIP ohne externe Deps, mit CRC-32
- `downloadBlob(data, filename, mimeType)` – ObjectURL-Download-Helper

## Implementierter Stand (laut backlog.md)

| Phase | Schritt | Status |
|-------|---------|--------|
| Phase 1 | Metronome Integration (`playbackController.js`) | ✅ |
| Phase 1 | Separater Aktiv-Schalter + Mic-on-demand | ✅ |
| Phase 1 | UI Controls (BPM, Taktart, Play/Stop) | ✅ |
| Phase 1 | `getTimeSignatureConfig` / `validateTimeSignature` | ✅ |
| Phase 2 | `playbackBar.js` (Overlay + Positionsberechnung) | ✅ |
| Phase 2 | Playback bar mit Exercise verdrahtet | ✅ |
| Phase 2 | Aktiver Modus ohne Metronom (sequentielle Tonprüfung) | ✅ |
| Phase 2 | Note-Highlighting (aktuell gespielte Note) | ✅ |
| Phase 3 | Aktiver Modus mit Metronom (zeitgebunden) | ✅ |
| Phase 3 | Multiple Time Signatures in VexFlow-Rendering | ✅ |
| Phase 4 | Endless Mode + Auto-Scrolling | ✅ |
| Phase 5 | Polish (Keyboard-Shortcuts, Fehlerbehandlung) | ✅ |

Aktueller Detailplan:
`plans/sheet-music-reading-active-mode-plan-2026-05-05.md`

## AI Collaboration & Documentation

**IMPORTANT FOR ALL AGENTS (Claude, Gemini, Codex):**
- **Update .md files:** Nach jeder Implementierung MÜSSEN alle relevanten `.md`-Dateien aktualisiert werden.
- **Keep Plans Current:** `plans/backlog.md` aktuell halten.
- **Architecture:** Vanilla JS, VexFlow für Notation, kein Framework.
