# Plan: Akustische Prüfung von Notenzeilen beim Gitarrenspiel

**Status:** Geplant ⏳  
**Typ:** Übung / Audio-Erkennung  
**Stand:** 2026-04-11

---

## Ziel

Eine Übung soll prüfen, ob eine vorgegebene Notenzeile auf der Gitarre akustisch korrekt gespielt wird.
Dabei ist **nicht** die hohe Präzision eines Stimmgeräts das Hauptziel, sondern eine **möglichst schnelle und robuste Notenerkennung** für Gitarrentöne.

Die Übung soll dadurch musikalisch flüssiges Spielen unterstützen: richtige Töne sollen schnell akzeptiert werden, leichte Verstimmungen dürfen toleriert werden, und kurze Fehlframes durch Anschlag oder Nebengeräusche sollen nicht sofort zu Fehlauswertungen führen.

---

## Fachliche Anforderungen

- Die richtige **klingende Note** muss erkannt werden, nicht exakte Cent-Genauigkeit.
- Leichte Verstimmungen sollen weiterhin als korrekt gelten.
- Notenwechsel innerhalb einer Zeile müssen schnell erkannt werden.
- Anschlag-Transienten, kurzes Nachklingen und einzelne Fehlframes dürfen die Bewertung nicht sofort verfälschen.
- Eine falsche Oktave muss als falsch erkannt werden.
- Falls nur die Tonhöhe geprüft wird, soll dieselbe klingende Note auf anderer Saite oder anderer Lage ebenfalls als korrekt gelten.
- Rhythmusbewertung ist nicht Teil der ersten Ausbaustufe und sollte getrennt betrachtet werden.

---

## Ausgangslage im Projekt

Bereits vorhanden sind im Projekt:

- ein präziser Pitch-Detection-Pfad im Tuner (`detectPitch`, `frequencyToNote`, Vorfilterung, Median-Stabilisierung)
- Fixture-Tests mit echten Gitarrenaufnahmen
- Fixture-Tests mit synthetischen Sinuswellen
- bestehende Mikrofon-Übungen wie `notePlayingExercise` und `sheetMusicMic`

Für die neue Übung sollte **kein reiner Tuner-Ansatz 1:1 übernommen** werden, da der aktuelle Fokus dort auf Stabilität und Genauigkeit liegt. Für die Notenzeilen-Prüfung wird stattdessen ein eigener, auf Geschwindigkeit optimierter Prüfpfad benötigt.

---

## Empfohlene Erkennungsstrategie

### 1. Separater Schnell-Erkennungsmodus

Neben dem präzisen Tuner sollte ein eigener Erkennungsmodus für die Übung entstehen:

- optimiert auf schnelle Note+Oktave-Erkennung
- toleranter gegenüber leichter Verstimmung
- kürzere Stabilitätslogik als im Tuner
- keine UI-Anzeige in Cent notwendig

### 2. Zielgerichtete statt freie Vollsuche

Für die aktuelle Note in der Notenzeile sollte die Erkennung nicht den gesamten Gitarrenbereich gleich behandeln.
Stattdessen sollte die Analyse die **aktuelle Zielnote** berücksichtigen:

- aktuelle Zielnote
- optional vorherige / nächste Note der Sequenz
- optional benachbarte Halbtöne als Fehlkandidaten

Dadurch kann der Suchraum kleiner werden, was die Erkennung beschleunigt und Fehlklassifikationen reduziert.

### 3. Note-Klassifikation statt Tuner-Präzision

Die Übung soll nicht primär mit Cent-Abweichung entscheiden, sondern mit einer robusten Klassifikation auf:

- **richtige Note+Oktave**
- **falsche Note**
- **unsicher / noch nicht stabil**

---

## Technische Empfehlung zu Algorithmen

### Primär empfohlen

Ein schneller zeitdomänenbasierter Pitch-Ansatz ist für Gitarrentöne am sinnvollsten:

- **McLeod Pitch Method (MPM / NSDF)** oder
- **vereinfachtes YIN / CMNDF** mit eingeschränktem Suchbereich

Begründung:

- gut geeignet für monophone Gitarrensignale
- schnell genug für kurze Analysefenster
- robust gegen typische Obertonstruktur von Gitarrensaiten
- browserfreundlich ohne schwere Infrastruktur

### Unterstützende Maßnahmen

Zusätzlich sinnvoll:

- Gitarren-Bandpass
- RMS-/Noise-Gate
- Attack-Dämpfung oder kurze Onset-Sperre direkt nach dem Anschlag
- optionale Zweitmeinung bei niedriger Konfidenz (z. B. HPS oder spektrale Plausibilitätsprüfung)

### Nicht als erste Wahl

Schwere Frameworks oder große Audio-ML-Lösungen sollten zunächst vermieden werden, solange ein leichter klassischer Ansatz ausreicht.

---

## Analyse-Ablauf

### 1. Audio-Erfassung

- Mikrofon über Web Audio API
- kontinuierliches Sampling mit überlappenden Analysefenstern
- Analyseintervall schneller als im Tuner, z. B. **20–30 ms**

### 2. Adaptive Fenstergröße

Je nach erwarteter Zielnote unterschiedliche Fenstergrößen:

- hohe Töne: eher kleine Fenster
- mittlere Töne: mittlere Fenster
- tiefe Gitarrentöne (E2/A2): größere Fenster

Richtwerte als Startpunkt:

- hohe Lage: ca. 2048 Samples
- mittlere Lage: ca. 3072–4096 Samples
- tiefe Lage: ca. 4096–6144 Samples

Ziel ist ein Kompromiss zwischen:

- genügend Perioden für tiefe Töne
- möglichst geringer Latenz bei höheren Tönen

### 3. Vorverarbeitung

Vor jeder Tonerkennung:

- RMS-Prüfung / Noise-Gate
- Gitarren-Bandpass
- leichte Attack-Dämpfung oder kurzes Ignorieren direkt nach Onset
- optional Pegelnormalisierung

### 4. Pitch-Schätzung

- Tonhöhenkandidat im erwarteten Frequenzraum bestimmen
- Ergebnis auf nächste Note+Oktave abbilden
- zusätzlich Konfidenz oder Qualitätsmaß erfassen

### 5. Entscheidungslogik

Statt langer Median-Ketten:

- kurze Stabilitätslogik, z. B. **2 aus 3 letzten Frames**
- richtige Zielnote wird schnell bestätigt
- unsichere Frames werden vorerst neutral behandelt
- falsche Einzel-Frames führen nicht sofort zum Fehler

### 6. Fortschalten in der Übung

Sobald die aktuelle Zielnote mit ausreichender Konfidenz bestätigt wurde:

- Note als korrekt markieren
- sofort oder mit sehr kurzer Pause zur nächsten Note wechseln
- Restschwingung der vorherigen Note kurz tolerieren

---

## Toleranzmodell

Da keine Tuner-Präzision gefordert ist, sollte intern ein bewusst gröberes Akzeptanzmodell verwendet werden.

Empfohlener Startbereich:

- Akzeptanzfenster etwa **±30 bis ±40 Cent**
- bei sehr tiefen Tönen ggf. leicht großzügiger

Wichtig ist dabei:

- richtige Note schnell akzeptieren
- leichte Verstimmung tolerieren
- Oktavfehler nicht akzeptieren
- Halbtonfehler zuverlässig abweisen

---

## Open-Source-Optionen

Falls eine bestehende Open-Source-Lösung genutzt werden soll, sind nur leichte browserfähige Bibliotheken sinnvoll.

Geeignete Kandidaten zur Evaluation:

- kleine Pitch-Detection-Bibliotheken mit MPM/YIN-Ansatz
- browserfreundliche Libraries ohne Build-Zwang oder mit einfacher Integration

Kriterien für die Auswahl:

- geringe Größe
- gute Performance im Browser
- Eignung für monophone Gitarrentöne
- einfache Integration in GitHub Pages / Vanilla-JS-Struktur

Schwere Lösungen wie umfassende Audio-Frameworks, WASM-Pipelines oder ML-Modelle sollten erst geprüft werden, wenn ein leichter Ansatz die Anforderungen nicht erfüllt.

---

## Empfohlene Architektur im Repository

### Neuer fachlicher Baustein

Für diese Übung sollte ein separater Logik-Baustein vorgesehen werden, statt die Tuner-Logik direkt umzuwidmen.

Vorgeschlagene Trennung:

- **präziser Tuner-Pfad** bleibt für Stimmung / Cents-Anzeige zuständig
- **schneller Notenzeilen-Prüfpfad** bewertet nur die gespielte Zielnote

### Wiederverwendbare Bausteine

Weiter nutzbar oder adaptierbar:

- Note↔Frequenz-Mapping
- Vorfilterung für Gitarrensignale
- Audio-Fixture-Teststruktur
- bestehende Mikrofon-Übungs-Controller als Integrationsvorbild

### Testbare Logik

Die Kernerkennung sollte möglichst als reine Logik kapselbar sein, damit sie mit:

- synthetischen Sinuswellen
- echten Gitarrenaufnahmen
- Übergangs- und Fehlerszenarien

automatisiert geprüft werden kann.

---

## Fachliche Testfälle mit echten Gitarrenaufnahmen

Der Nutzer kann Aufnahmen im Repository ablegen. Dafür sollten gezielt fachliche Testfälle gesammelt werden:

### Einzelton-Fälle

- korrekt gespielte Einzeltöne über den gesamten Gitarrenbereich
- besonders wichtig: E2, A2, D3, G3, B3, E4
- gleiche Zielnote auf anderer Saite / anderer Lage
- leicht verstimmte, aber musikalisch noch erkennbare Töne

### Fehlerszenarien

- Halbton daneben
- falsche Oktave
- kurzer Fehlanschlag vor dem richtigen Ton
- angerissene Nebensaite
- starkes Nachklingen der vorherigen Note
- sehr kurzer Ton vs. lang gehaltener Ton

### Sequenz-Fälle

- langsame Notenzeile mit klar getrennten Tönen
- mittlere Geschwindigkeit
- schnelle Tonfolge mit kurzen Übergängen
- gleiche Note mehrfach hintereinander
- Schrittbewegung aufwärts / abwärts
- Sprünge über mehrere Töne
- Legato-artige Übergänge (Hammer-on / Pull-off)

### Umgebungsbedingungen

- ruhige Umgebung
- normale Wohnumgebung
- leichte Hintergrundgeräusche
- kräftiger Anschlag tiefer Saiten
- leiser gespielte hohe Saiten

---

## Testfälle mit perfekten Sinus-Schwingungen

Zusätzlich sollten synthetische Referenztests gepflegt werden.

### Standardfälle

- ein Sinus pro Zielnote im relevanten Bereich
- Prüfung auf korrekte Note+Oktave
- Messung der Erkennungszeit
- Messung der Stabilität bei kurzen Fenstern

### Erweiterte synthetische Fälle

- abrupt startender Ton
- Ton mit kurzer Pause
- schneller Übergang zwischen zwei Tönen
- Ton knapp oberhalb des Noise-Gates
- leicht verstimmter Sinus innerhalb der Akzeptanz
- leicht verstimmter Sinus außerhalb der Akzeptanz

### Gitarrennähere Synthetik

Zusätzlich zu perfekten Sinuswellen sinnvoll:

- Grundton mit stärkeren Obertönen
- kurze Attack-Phase mit stärkerem Anfangsimpuls
- ausklingende Amplitude

So lässt sich besser prüfen, wie sich der Algorithmus zwischen idealem Testsignal und realer Gitarrensaite verhält.

---

## Fachliche Akzeptanzkriterien

Die Lösung ist fachlich geeignet, wenn sie folgende Ziele erfüllt:

- richtige Gitarrentöne werden spürbar schneller erkannt als im präzisen Tuner-Pfad
- leichte Verstimmung verhindert die Anerkennung nicht unnötig
- falsche Halbtöne werden zuverlässig abgelehnt
- falsche Oktaven werden zuverlässig abgelehnt
- kurze Anschlagartefakte führen nicht zu voreiligen Fehlentscheidungen
- Notenwechsel in einer Notenzeile werden schnell genug erkannt, um flüssiges Spielen zu ermöglichen

---

## Empfohlene Umsetzungsreihenfolge

1. Fachliche Akzeptanzgrenzen und Ziel-Toleranzen festlegen.
2. Schnell-Erkennungslogik als separaten Prototypen definieren.
3. Prototyp zuerst gegen Sinus-Fixtures prüfen.
4. Danach mit echten Gitarrenaufnahmen kalibrieren.
5. Erst anschließend in die Notenzeilen-Übung integrieren.
6. Abschließend Sequenztests und fachliche Regressionstests ergänzen.

---

## Offene Entscheidungen

Vor einer späteren Implementierung sollten noch diese Punkte festgelegt werden:

- Soll ausschließlich die richtige Tonhöhe geprüft werden oder später auch der Rhythmus?
- Reicht Note+Oktave als Erfolgskriterium oder soll eine Lagebindung möglich sein?
- Wie tolerant darf die Erkennung bei leicht verstimmten Aufnahmen sein?
- Wie schnell darf die Übung weiterschalten, ohne musikalisch hektisch zu wirken?
- Soll es getrennte Modi geben, z. B. „locker“ und „streng“?
