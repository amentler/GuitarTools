# Plan: AudioContext-Resume ohne User-Gesture-Button

**Status:** ✅ Umgesetzt – `audioSessionService.js` wirft nach `resume()`, beide Controller zeigen Reload-Meldung.

## Problem

`AudioContext` startet in Chrome im Zustand `suspended`, wenn kein expliziter
User-Gesture vorliegt. Seit dem Auto-Listening-Umbau (`mount()` → `startListening()`)
wird `resume()` direkt beim Seitenaufruf aufgerufen — ohne dass der User zuvor
geklickt hat.

Wenn die Mikrofon-Permission schon gespeichert ist (`getUserMedia` liefert sofort),
gibt es keinen Permission-Dialog und damit keinen User-Gesture. Chrome kann `resume()`
in diesem Fall still ignorieren; der `AudioContext` bleibt `suspended`. Folge:
`analyzeFrame()` liest Nullen, das Onset-Gate öffnet nie, keine Töne werden erkannt.

Ein expliziter „Start"-Knopf ist nicht gewünscht (war vorhanden und hat genervt).

## Gewählte Lösung: Fehlermeldung mit Reload-Aufforderung

Der ursprüngliche Plan (unsichtbarer Interaction-Listener) wurde verworfen.
Begründung: zu komplex, schwer testbar, Edge Case wenn der Nutzer nie klickt.

**Stattdessen:** Nach `resume()` prüfen, ob `audioCtx.state` noch `suspended` ist.
Falls ja: Listening **nicht starten**, direkt `ui.permission` mit einer klaren
Meldung befüllen.

### Implementierung (ca. 5 Zeilen in `audioSessionService.js`)

Nach dem bestehenden `resume()`-Aufruf:

```js
if (audioCtx.state === 'suspended') {
  throw new Error('AudioContext bleibt suspended – User-Gesture fehlt');
}
```

Der Fehler wird in `startListening()` (in `sheetMusicMicExercise.js`) wie andere
Fehler behandelt: Anzeige in `ui.permission`.

### Meldungstext

```
Mikrofon konnte nicht gestartet werden. Bitte Seite neu laden.
```

Optional: ein `[Neu laden]`-Button, der `location.reload()` aufruft.

## Betroffene Dateien

| Datei | Änderung |
|-------|---------|
| `js/shared/audio/audioSessionService.js` | Prüfung nach `resume()`, Fehler bei `suspended` |
| `js/games/sheetMusicMic/sheetMusicMicExercise.js` | Fehler wird wie Permission-Fehler angezeigt |

## Abgrenzung

- Kein sichtbarer Start-Knopf
- Kein Interaction-Listener im Hintergrund
- Nur `sheetMusicMic` betroffen; `guitarTuner` hat eigenen Start-Knopf
- Kein Unit-Test zwingend notwendig (der Pfad ist nur im echten Browser reproducierbar)
