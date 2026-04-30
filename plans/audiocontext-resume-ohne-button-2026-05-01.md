# Plan: AudioContext-Resume ohne User-Gesture-Button

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

## Lösung: Unsichtbarer Interaction-Listener

Wenn `resume()` liefert und der Kontext trotzdem noch `suspended` ist, wird ein
einmaliger `pointerdown`/`keydown`-Listener auf `document` registriert, der
`resume()` erneut auslöst. Der User muss lediglich irgendwo auf die Seite klicken
oder eine Taste drücken — keine sichtbare UI nötig.

### Implementierungsschritte

#### 1. `audioSessionService.js` — Resume-Retry nach erster Interaction

```js
// Nach dem bestehenden resume()-Aufruf:
if (audioCtx.state === 'suspended' && typeof audioCtx.resume === 'function') {
  await audioCtx.resume();
}

// Neu: falls immer noch suspended, einen einmaligen Interaction-Listener setzen
if (audioCtx.state === 'suspended') {
  await new Promise(resolve => {
    const resumeOnInteraction = async () => {
      document.removeEventListener('pointerdown', resumeOnInteraction);
      document.removeEventListener('keydown', resumeOnInteraction);
      if (audioCtx.state === 'suspended') {
        await audioCtx.resume().catch(() => {});
      }
      resolve();
    };
    document.addEventListener('pointerdown', resumeOnInteraction, { once: true });
    document.addEventListener('keydown', resumeOnInteraction, { once: true });
  });
}
```

Vorteil: kein sichtbarer UI-Element. Der User interagiert eh mit der Seite
(Slider, Toggles, Noten ansehen) — spätestens dann feuert der Listener.

#### 2. `sheetMusicMicExercise.js` — Optionaler Status-Hinweis

Wenn der Kontext nach `openAudioSession` noch `suspended` ist, kann kurz ein
dezenter Hinweis in `ui.permission` erscheinen:

```
„Bereit – spiele eine Note oder klicke, um zu starten."
```

Der Hinweis verschwindet, sobald der Listener feuert und `resume()` erfolgreich war.

Implementierung: `startListening()` prüft nach `openSheetMusicMicAudioSession`,
ob `audioSession.audioCtx?.state === 'suspended'` und zeigt ggf. den Hinweis an.
Er wird in `analyzeFrame()` ausgeblendet, sobald der erste valide Frame empfangen
wird (d.h. `audioCtx.state === 'running'`).

#### 3. E2E-Test

Ein neuer Playwright-Test in `sheet-music-mic-visual-feedback.spec.js`:

```
test('Noten spielen resumt den AudioContext nach erster Pointer-Interaction')
```

- Fake-AudioContext startet in `suspended` (wie im bestehenden suspended-Test)
- `resume()` wird im Mock absichtlich erst beim zweiten Aufruf wirksam
  (simuliert den Browser-Policy-Fall)
- Test triggert `page.click('#sheet-mic-score-container')` nach dem Laden
- Assert: `analyserFftSize === 4096` und Score steigt auf `4/4`

#### 4. Unit-Test

`audioSessionService.test.js` (neu oder ergänzend):
- Fall: `resume()` verändert `state` nicht (bleibt `'suspended'`)
- Erwartet: Listener wird registriert, nach simuliertem `pointerdown` wird erneut
  `resume()` aufgerufen

## Dateien

| Datei | Änderung |
|-------|---------|
| `js/shared/audio/audioSessionService.js` | Resume-Retry-Logik |
| `js/games/sheetMusicMic/sheetMusicMicExercise.js` | Optionaler Status-Hinweis |
| `tests/e2e/sheet-music-mic-visual-feedback.spec.js` | Neuer Playwright-Test |
| `tests/unit/audioSessionService.test.js` | Unit-Test Resume-Retry |

## Abgrenzung

- Kein sichtbarer Start-Knopf
- Kein Modal / Overlay
- Reine Hintergrundlogik — User merkt nichts, solange der Normalfall (Permission-Dialog
  oder vorhandene Aktivierung) greift
- Nur `sheetMusicMic` betroffen; `guitarTuner` hat eigenen Start-Knopf und ist
  nicht betroffen
