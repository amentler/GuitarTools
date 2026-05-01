# Plan: Adaptive Item-Selektion (Spaced Repetition)

**Stand:** 2026-05-01  
**Status:** Entwurf – noch nicht umgesetzt

---

## Ziel

Übungen, in denen etwas auswendig gelernt werden muss, sollen Aufgaben nicht mehr
gleichverteilt zufällig auswählen, sondern adaptiv: Inhalte, bei denen der Nutzer
Schwierigkeiten hat (Fehler, lange Antwortzeit), werden häufiger abgefragt. Inhalte,
die sicher beherrscht werden, kommen seltener.

---

## Fachlicher Begriff

Das Verfahren heißt **Spaced Repetition** (Intervall-Wiederholung). Der bekannteste
Algorithmus ist **SM-2** (SuperMemo 2, Grundlage von Anki). SM-2 ist auf
Tage-/Wochen-Abstände ausgelegt und damit für eine In-Session-App überdimensioniert.

Die hier vorgeschlagene Variante ist eine **gewichtete adaptive Selektion**:

- Jedes Item bekommt ein numerisches **Gewicht** (höher = wird häufiger gezogen).
- Gewicht steigt bei Fehler oder langsamer Antwort, sinkt bei schneller richtiger Antwort.
- Auswahl erfolgt per **gewichtetem Zufallsziehen** (Roulette-Wheel-Selection).
- Gewichte werden in `localStorage` gespeichert und über Sessions hinweg gehalten.

Das entspricht einem vereinfachten **Leitner-System** ohne feste Boxen, aber mit
kontinuierlicher Skala.

---

## Betroffene Übungen

| Übung | Items | Kriterium |
|-------|-------|-----------|
| Griffbrett-Ton-Erkennung (`fretboardToneRecognition`) | Note×Saite×Bund | korrekt + Antwortzeit |
| Ton-Finder (`tonFinder`) | Note | korrekt + Antwortzeit |
| Akkord-Trainer (`akkordTrainer`) | Akkordname | korrekt + Antwortzeit |
| Noten lesen (`sheetMusicReading`) | Note+Oktave | korrekt |

`sheetMusicMic` und `notePlayingExercise` sind ausgenommen: dort ist der nächste Ton
durch die Partitur vorgegeben, nicht frei wählbar.

---

## Datenmodell

### Item-Key

Jede Übung definiert einen String-Key pro abfragbarem Item, z.B.:

- `tonFinder`: `"G#3"`, `"E2"`, …
- `fretboardToneRecognition`: `"s2-f3"` (Saite 2, Bund 3)
- `akkordTrainer`: `"Am"`, `"Cmaj"`, …

### Weight-Objekt

```js
{
  weight: number,     // >= 1.0, Default 1.0
  attempts: number,   // Gesamtanzahl Abfragen
  lastSeen: number,   // Timestamp (für Decay-Logik, optional)
}
```

### Storage-Key

Pro Übung ein eigener `localStorage`-Key:

```
gt_srs_tonFinder
gt_srs_fretboardToneRecognition
gt_srs_akkordTrainer
gt_srs_sheetMusicReading
```

---

## Algorithmus

### Gewichtsanpassung nach Antwort

```
richtig + schnell  (< Schwelle):  weight = max(1.0, weight * 0.7)
richtig + langsam  (> Schwelle):  weight = weight * 0.9
falsch:                           weight = weight * 1.5  (max: z.B. 8.0)
```

Schwelle für „schnell" ist übungsabhängig, z.B. 3 Sekunden für Ton-Finder.

Die Multiplikatoren und Schwellen sind Konstanten in einem neuen Logik-Modul und
damit leicht justierbar (keine Magic Numbers im Controller).

### Gewichtetes Zufallsziehen (Roulette-Wheel)

```js
function weightedPick(items, weights) {
  const total = weights.reduce((a, b) => a + b, 0);
  let r = Math.random() * total;
  for (let i = 0; i < items.length; i++) {
    r -= weights[i];
    if (r <= 0) return items[i];
  }
  return items[items.length - 1];
}
```

### Decay (optional, Phase 2)

Wenn ein Item lange nicht gesehen wurde, kann sein Gewicht leicht steigen
(`weight += 0.1 pro vergangene Woche`). Verhindert, dass früh gelernte Items
dauerhaft verschwinden. Zunächst nicht zwingend.

---

## Architektur

### Neues Modul: `js/shared/learning/srsLogic.js`

Reine Logik, kein DOM, kein Audio. Exportiert:

```js
export function createSrsStore(exerciseKey, allItemKeys)
// Lädt aus localStorage, initialisiert fehlende Keys mit weight 1.0

export function pickNextItem(store)
// Gewichtetes Zufallsziehen; gibt Item-Key zurück

export function recordResult(store, itemKey, { correct, responseTimeMs })
// Passt Gewicht an, speichert in localStorage

export function getWeights(store)
// Gibt { [itemKey]: weight } zurück (für Debug-Anzeige)

export const SRS_WEIGHT_ON_CORRECT_FAST = 0.7
export const SRS_WEIGHT_ON_CORRECT_SLOW = 0.9
export const SRS_WEIGHT_ON_WRONG        = 1.5
export const SRS_WEIGHT_MIN             = 1.0
export const SRS_WEIGHT_MAX             = 8.0
export const SRS_FAST_THRESHOLD_MS      = 3000  // überschreibbar per Option
```

### Integration in Controller

Jeder betroffene Controller:

1. Erzeugt beim `mount()` einen Store via `createSrsStore(key, allItems)`.
2. Ersetzt den bisherigen Zufallsaufruf durch `pickNextItem(store)`.
3. Ruft nach jeder Antwort `recordResult(store, key, { correct, responseTimeMs })` auf.

Der bestehende Zufalls-Pool wird nicht entfernt, sondern durch `pickNextItem` ersetzt.
Damit bleibt die Fallback-Logik (z.B. gefilterter Notenpool) erhalten.

---

## Testplan

### Unit-Tests (`tests/unit/srsLogic.test.js`)

- Initialisierung: alle Items starten mit `weight === 1.0`.
- Falsches Antworten erhöht Gewicht des betroffenen Items.
- Schnelle richtige Antwort senkt Gewicht.
- Gewicht bleibt >= `SRS_WEIGHT_MIN` und <= `SRS_WEIGHT_MAX`.
- `pickNextItem` zieht über viele Iterationen Items mit höherem Gewicht häufiger
  (statistischer Test: 1000 Züge, schwerstes Item mindestens doppelt so oft wie leichtestes).
- `recordResult` persistiert in `localStorage` (gemockt in Tests).
- Store-Initialisierung lädt bestehende Weights aus `localStorage` korrekt.

---

## Umsetzungsreihenfolge

1. `srsLogic.js` als reines Logik-Modul mit Unit-Tests anlegen.
2. Einen Controller integrieren (Empfehlung: `tonFinder`, weil klein und klar).
3. Nach Validierung die anderen Übungen nachziehen.
4. Optional: Decay-Logik in Phase 2 ergänzen.
5. Optional: Debug-Anzeige der aktuellen Gewichte (einblendbar über den globalen Debug-Modus).

---

## Offene Entscheidungen

| Frage | Vorschlag |
|-------|-----------|
| Gewichte beim Übungs-Reset (`Neue Takte`, Seitenwechsel) zurücksetzen? | Nein – Weights sind Session-übergreifend, kein Reset |
| Was passiert, wenn sich der Item-Pool durch Settings ändert (andere Bünde/Saiten)? | Neue Items starten mit `weight 1.0`; alte Items bleiben im Store, werden aber nicht gezogen wenn nicht im Pool |
| Soll der Nutzer sehen können, welche Items schwer sind? | Optional: über Debug-Modus einblendbar (Phase 2) |
| Sollen Weights je Gerät lokal bleiben oder synchronisierbar sein? | Nur lokal (`localStorage`), kein Backend |
