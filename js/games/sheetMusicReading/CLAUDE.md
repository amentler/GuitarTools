# sheetMusicReading – Noten lesen Übung

Zeigt 4 zufällige Takte in C-Dur auf einer Notenzeile an.
Metronom (BPM-Slider), wählbare Taktart (2/4–6/8), bewegender Playback-Cursor.
Optional: Tabs unterhalb der Notenzeile.

## Dateien

### `sheetMusicLogic.js`
- `NOTES` – 17 Noten in C-Dur, Bünde 0–3, Saiten 1–6 (E2–G4 sounding, vfKey = written pitch)
- `generateBars(numBars, beatsPerBar, notesPool?)` → `Note[][]`
- `getFilteredNotes(maxFret, activeStrings)` → gefilterter Note-Pool
- `getTimeSignatureConfig(sig)` → `{ beatsPerBar, noteDuration, vfTimeSig }` für 2/4, 3/4, 4/4, 3/8, 6/8
- `validateTimeSignature(sig)` → boolean

### `sheetMusicSVG.js`
- `renderScore(container, bars, showTab)` → `{ notationDiv, staveLayout }`
  - `staveLayout`: `Array<{ noteStartX, noteEndX }>` – VexFlow-Koordinaten je Takt für `PlaybackBar`
  - `notationDiv` hat `position: relative` für die Overlay-SVG
- Renderingbasis: VexFlow (CDN), viewBox 640×240, FIRST_BAR_W=256, REST_BAR_W=128

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
- Zustand: `{ bars, showTab, bpm, timeSig, settings }`
- localStorage-Persistenz: `sheetMusic_bpm`, `sheetMusic_timeSig`, `sheetMusic_showTab`
- Buttons: `#btn-sheet-play` (Play/Stop), `#btn-new-bars`, `#btn-show-tab`
- Slider: `#sheet-music-bpm-slider` (40–240), `#sheet-music-fret-range-slider`
- Select: `#sheet-music-time-sig` (2/4|3/4|4/4|3/8|6/8)
- `wired`-Flag verhindert doppeltes Event-Listener-Wiring

## Implementierter Stand (laut backlog.md)

| Phase | Schritt | Status |
|-------|---------|--------|
| Phase 1 | Metronome Integration (`playbackController.js`) | ✅ |
| Phase 1 | UI Controls (BPM, Taktart, Play/Stop) | ✅ |
| Phase 1 | `getTimeSignatureConfig` / `validateTimeSignature` | ✅ |
| Phase 2 | `playbackBar.js` (Overlay + Positionsberechnung) | ✅ |
| Phase 2 | Playback bar mit Exercise verdrahtet | ✅ |
| Phase 2 | Note-Highlighting (aktuell gespielte Note) | ⬜ |
| Phase 3 | Multiple Time Signatures in VexFlow-Rendering | ⬜ |
| Phase 4 | Endless Mode + Auto-Scrolling | ⬜ |
| Phase 5 | Polish (Keyboard-Shortcuts, Fehlerbehandlung) | ⬜ |

Detailplan: `plans/backlog.md` → "Plan: Enhanced Noten lesen"

## AI Collaboration & Documentation

**IMPORTANT FOR ALL AGENTS (Claude, Gemini, Codex):**
- **Update .md files:** Nach jeder Implementierung MÜSSEN alle relevanten `.md`-Dateien aktualisiert werden.
- **Keep Plans Current:** `plans/backlog.md` aktuell halten.
- **Architecture:** Vanilla JS, VexFlow für Notation, kein Framework.
