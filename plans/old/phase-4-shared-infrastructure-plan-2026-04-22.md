# Phase 4: Shared Infrastructure Plan

Datum: 2026-04-22
Bezug: [plans/architektur-review-plan-2026-04-21.md](/home/azureuserhauptmann/privat/GuitarTools/plans/architektur-review-plan-2026-04-21.md)
Status: abgeschlossen am 2026-04-24

## Ziel

Phase 4 vereinheitlicht wiederkehrende Browser- und Infrastrukturzugriffe, die nach Phase 3 noch mehrfach in Features verteilt sind. Der Schwerpunkt liegt auf drei wiederverwendbaren Bausteinen:

- `storageService` fuer `localStorage`-Zugriffe
- `audioSession` bzw. `microphoneService` fuer Mikrofon- und `AudioContext`-Lifecycle
- zentralere Verwaltung fuer Precache-/Service-Worker-Eingaben

Die Phase ist explizit kein grosses Verhaltens-Redesign. Ziel ist, bestehende Funktionalitaet hinter stabilere, besser testbare Services zu ziehen.

## Warum jetzt

Phase 3 hat die groessten Controller bereits in kleinere Module zerlegt. Dadurch gibt es jetzt saubere Andockpunkte, um Infrastruktur nicht mehr pro Feature neu zu loesen.

Aktuelle Duplikate und Hotspots:

- `localStorage` noch direkt in `js/tools/metronome/metronome.js`
- eigene Audio-Session-Implementierungen in:
  - `js/tools/guitarTuner/guitarTunerAudioSession.js`
  - `js/games/sheetMusicMic/sheetMusicMicAudioSession.js`
  - `js/games/akkordfolgenTrainer/akkordfolgenAudioSession.js`
  - `js/games/notePlayingExercise/notePlayingAudioSession.js`
- separate direkte Mikrofon-/AudioContext-Nutzung in `js/games/chordExerciseEssentia/essentiaChordDetection.js`
- Audio-Context-Erzeugung ausserhalb eines gemeinsamen Services in:
  - `js/shared/audio/metronomeLogic.js`
  - `js/games/sheetMusicReading/playbackController.js`

## Leitlinien

1. TDD zuerst, soweit technisch sinnvoll.
2. Zuerst Verhalten mit Service-Tests absichern, dann extrahieren.
3. Erst neue Shared-Services einfuehren, danach Features schrittweise umstellen.
4. Oeffentliche Feature-APIs bleiben waehrend der Migration stabil.
5. Browser-APIs werden hinter kleine Adapter gezogen und per Dependency Injection testbar gemacht.

## TDD-Strategie

TDD ist in Phase 4 moeglich, aber nicht gleich foermig fuer alle Themen.

Gut TDD-geeignet:

- `storageService`
  - lesen, schreiben, parse fallback, key-namespacing, Default-Werte
- `microphoneService`
  - `getUserMedia`-Aufruf, Fehlerfaelle, mehrfaches `stop`, Cleanup
- `audioSession`
  - `AudioContext`-Erzeugung, `AnalyserNode`-Setup, `fftSize`, idempotentes `close`
- Precache-Manifest-Builder
  - Dateiliste sammeln, filtern, deterministische Ausgabe

Nur bedingt TDD-geeignet:

- Service-Worker-Integration selbst
  - hier eher Logik und Konfiguration testbar machen, nicht die komplette Browser-Runtime
- AudioContext-Autoplay-Randfaelle
  - ueber Mocks absichern, nicht ueber echte Browser-Audio-Ausfuehrung

Pflicht vor jedem Refactor:

1. Bestehende Feature-Tests identifizieren, die das aktuelle Verhalten indirekt absichern.
2. Fehlende Unit-Tests fuer den neuen Shared-Service schreiben.
3. Erst wenn die neuen Tests gruen sind, Call-Sites auf den Shared-Service migrieren.
4. Nach jeder Migration relevante Controller-/Integrationstests erneut laufen lassen.

## Zielstruktur

Vorgeschlagene neue Module:

- `js/shared/storage/storageService.js`
- `js/shared/audio/microphoneService.js`
- `js/shared/audio/audioSessionService.js`
- `js/shared/audio/audioContextFactory.js`
- `js/shared/pwa/precacheManifest.js`

Optionale spaetere Aufteilung, falls noetig:

- `js/shared/storage/storageKeys.js`
- `js/shared/audio/audioSessionPresets.js`
- `js/shared/pwa/precacheSources.js`

## Phase-4-Abschnitte

### 4A: Storage vereinheitlichen

Ziel:
Direkte `localStorage`-Zugriffe aus Feature-Controllern und Tools schrittweise entfernen.

Erste Kandidaten:

- `js/tools/metronome/metronome.js`
- vorhandene spezialisierte Storage-Helfer wie `js/games/sheetMusicReading/sheetMusicReadingStorage.js`

Vorgehen:

1. Unit-Tests fuer generische Storage-Operationen schreiben.
2. `storageService` mit injizierbarem Backend einfuehren.
3. Bestehende spezialisierte Module auf den Shared-Service umstellen.
4. Direkte `localStorage`-Zugriffe in Features abbauen.

Tests vor Refactor:

- neuer Unit-Test fuer `storageService`
- bestehende `sheetMusicReadingController`-Tests pruefen
- bestehende Metronom-Tests ergaenzen, falls Persistenz dort noch nicht explizit abgesichert ist

Definition of Done:

- Neue Persistenzlogik liegt nicht mehr direkt in Controllern.
- Storage-Zugriffe sind ueber ein gemeinsames Interface testbar.
- Fallback-Verhalten bei ungueltigen Werten ist dokumentiert und getestet.

### 4B: Mikrofon- und Audio-Session vereinheitlichen

Ziel:
Die mehrfach fast identische Session-Initialisierung fuer Mikrofonfeatures auf einen Shared-Service reduzieren.

Erste Kandidaten:

- `guitarTuner`
- `sheetMusicMic`
- `notePlayingExercise`
- `akkordfolgenTrainer`

Moegliche Shared-API:

```js
const session = await openMicrophoneAudioSession({
  getUserMedia,
  AudioContextCtor,
  fftSize,
  constraints: { audio: true, video: false },
});

await closeMicrophoneAudioSession(session);
```

Vorgehen:

1. Unit-Tests fuer Shared-Audio-Session schreiben.
2. Gemeinsamen Session-Service mit injizierbaren Browser-Abhaengigkeiten einfuehren.
3. Bestehende feature-spezifische Session-Module intern auf den Shared-Service umstellen.
4. Falls stabil, doppelte Wrapper spaeter reduzieren.

Wichtige Testfaelle:

- erstellt `AudioContext`, `MediaStreamSource` und `AnalyserNode`
- uebernimmt `fftSize`, wenn gesetzt
- `close` stoppt Tracks und schliesst den Context
- mehrfaches `close` bleibt sicher
- Fehler bei `getUserMedia` oder `AudioContext` fuehren nicht zu halboffenem Zustand

Definition of Done:

- Mikrofon-Lifecycle ist nicht mehr viermal separat implementiert.
- Session-Aufbau und Teardown sind an einer gemeinsamen Stelle testbar.
- Bestehende Controller-Tests der betroffenen Features bleiben gruen.

### 4C: AudioContext-Nutzung fuer Playback vereinheitlichen

Ziel:
Nicht nur Mikrofonfaelle, sondern auch Playback-nahe AudioContext-Erzeugung konsistenter machen.

Kandidaten:

- `js/shared/audio/metronomeLogic.js`
- `js/games/sheetMusicReading/playbackController.js`

Vorgehen:

1. Ermitteln, welche Teile wirklich gemeinsam sind:
   - lazy init
   - resume/suspend
   - `window.AudioContext || window.webkitAudioContext`
2. Tests fuer die gemeinsame Factory oder Hilfslogik schreiben.
3. `audioContextFactory` einfuehren.
4. Metronom und Playback darauf umstellen, ohne ihre Fachlogik zu vermischen.

Definition of Done:

- AudioContext-Erzeugung folgt einem konsistenten Pfad.
- Browser-Kompatibilitaetslogik liegt nicht mehrfach im Projekt.
- Bestehende Playback- und Metronom-Tests bleiben stabil.

### 4D: Precache- und PWA-Eingaben zentralisieren

Ziel:
Die Service-Worker-Eingaben sollen an einer Stelle beschrieben und moeglichst deterministisch erzeugt werden.

Hinweis:
Hier ist TDD nur fuer die Listenlogik und den Builder gut geeignet, nicht fuer den gesamten Browser-Lifecycle.

Vorgehen:

1. Aktuelle Quelle der Precache-Liste identifizieren.
2. Reine Builder-Logik in ein testbares Modul ziehen.
3. Tests fuer Sortierung, Ausschluesse und Pflichtdateien schreiben.
4. Service-Worker oder Build-Eingang auf die zentrale Quelle umstellen.

Definition of Done:

- Precache-Eintraege werden nicht mehr nur manuell an verstreuten Stellen gepflegt.
- Die zugrunde liegende Listenlogik ist ueber Unit-Tests abgesichert.

## Empfohlene Reihenfolge

1. `4A` Storage
2. `4B` Mikrofon- und Audio-Session
3. `4C` AudioContext-Factory fuer Playback
4. `4D` Precache-/PWA-Zentralisierung

Die Reihenfolge ist bewusst so gewaehlt, dass erst die risikoarmen, gut unit-testbaren Services kommen und der PWA-Teil zuletzt folgt.

## Verifikation pro Abschnitt

Nach jedem Teilabschnitt:

- neue Service-Unit-Tests muessen gruen sein
- relevante bestehende Controller- oder Integrationstests muessen gruen bleiben
- `npm run lint`

Empfohlene Mindest-Checks:

- nach `4A`: Storage-bezogene Controller-Tests plus Metronom-bezogene Tests
- nach `4B`: `guitarTuner`, `sheetMusicMic`, `akkordfolgenTrainer`, `notePlaying` Controller-Tests
- nach `4C`: `playbackController`- und Metronom-Tests
- nach `4D`: neue Unit-Tests fuer den Builder plus vorhandene Build-/Smoke-Pruefungen, falls vorhanden

## Risiken

- Zu fruehes Vereinheitlichen kann echte fachliche Unterschiede zwischen Features verdecken.
- Audio-Fehlerpfade sind leicht regressionsanfaellig, wenn Cleanup nicht strikt idempotent bleibt.
- Precache-Aenderungen koennen erst spaet sichtbar brechen; hier ist deterministische Listenlogik wichtiger als schnelle Umstellung.
- Die Akkorderkennung bleibt ein gesonderter Risikobereich und sollte in Phase 4 nicht nebenbei mit umgebaut werden.

## Akzeptanzkriterien fuer Phase 4

- Gemeinsame Browser-Infrastruktur liegt in `js/shared/*` statt verteilt in mehreren Features.
- Neue Infrastrukturbausteine besitzen eigene Unit-Tests.
- Die betroffenen Features nutzen die Shared-Services, ohne ihre oeffentliche API zu aendern.
- Relevante bestehende Controller-, Integration- und Smoke-Tests bleiben gruen.
- Jede Migration folgt dem Muster: Test zuerst, dann Refactor, dann Regression-Checks.

## Konkreter Startpunkt

Der sinnvollste Einstieg ist `4A`.

Warum:

- niedrigstes Refactor-Risiko
- am einfachsten per TDD abzusichern
- schafft ein Muster fuer die restlichen Shared-Services

Erster umsetzbarer Schritt:

1. neue Tests fuer `js/shared/storage/storageService.js` anlegen
2. Shared-Service implementieren
3. `sheetMusicReadingStorage` und `metronome` auf Nutzung pruefen und schrittweise umstellen
