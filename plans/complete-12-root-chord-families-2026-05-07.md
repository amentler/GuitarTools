# Plan: Vollstaendige 12-Grundton-Akkordfamilien

## Ziel

Die Anwendung soll in Akkorduebersicht und Akkord-Recorder alle 12 deutschen Grundtonfamilien vollstaendig anbieten. Der zentrale Akkordkatalog bleibt die Single Source of Truth. Vor der Erweiterung wird die bestehende inkonsistente Benennung `H7 (B7)` auf `H7` bereinigt.

## Fachliche Anforderungen

- Grundtonfamilien: `A`, `B`, `H`, `C`, `Cis`, `D`, `Dis`, `E`, `F`, `Fis`, `G`, `Gis`.
- Deutsche Akkordnamen werden verwendet; kurze Schreibweisen sind erlaubt.
- `H` bleibt der deutsche Ton H; `B` ist der deutsche Halbton zwischen `A` und `H`.
- Alle Akkordfamilien werden fuer alle 12 Grundtoene abgebildet:
  - `Dur`
  - `Moll`
  - `Dom7`
  - `Maj7`
  - `Min7`
  - `Dim`
  - `Halbvermindert`
  - `sus2`
  - `sus4`
  - `7sus4`
  - `add9`
- Halbverminderte Akkorde werden in kurzer, ASCII-kompatibler Schreibweise als `m7b5` gefuehrt, z. B. `Am7b5`, `Cism7b5`, `Gism7b5`.
- Pro Akkord wird genau ein Standardgriff hinterlegt.
- Griffauswahl: moeglichst voller Klang und niedrige Lage. Wenn ein voller offener Griff nicht sinnvoll ist, ist ein niedriger Barre-Griff akzeptabel.
- Bestehende Sonderformen wie 1-Finger-Akkorde, `F-Dur (klein)` und `G-Dur (Rock)` bleiben erhalten, zaehlen aber nicht als Standardgriff der vollstaendigen Matrix.

## Vorarbeit: H7/B7-Bereinigung

- `H7 (B7)` im zentralen Akkordkatalog zu `H7` umbenennen.
- `CHORD_CATEGORIES`, `CHORD_META`, Akkordfolgen-Mapping, Kommentare und relevante Tests auf `H7` anpassen.
- Fixture- und Frozen-Verweise pruefen. Nur anpassen, wenn sie durch die Umbenennung direkt brechen oder produktiv sichtbare Namen enthalten.
- Akzeptanz: Produktcode und relevante Tests verwenden `H7`; die UI zeigt kein `H7 (B7)` mehr.

## Technisches Vorgehen

- `js/data/akkordData.js` bleibt die zentrale Datenquelle fuer `CHORDS`, `CHORD_CATEGORIES` und `CHORD_META`.
- `CHORD_META` wird um den neuen Typ `Halbvermindert` oder einen eindeutig gemappten internen Typ erweitert.
- `TYPE_ORDER` in Akkorduebersicht und Recorder wird um den neuen Typ erweitert.
- `ROOT_ORDER` in Akkorduebersicht und Recorder wird auf alle 12 deutschen Grundtoene erweitert.
- Filterbuttons oder andere hardcodierte Root-/Typ-Auswahlen werden gesucht und auf dieselbe Matrix gebracht.
- Keine UI-spezifischen Akkordlisten hardcoden; Akkorduebersicht und Recorder sollen weiter aus `CHORDS` und `CHORD_META` ableiten.

## Fachliche Testfaelle

- `H7 (B7)` ist aus Produktdaten entfernt und `H7` existiert.
- Alle 12 Grundtonfamilien sind in `CHORD_META` vorhanden.
- Fuer jede Grundtonfamilie existieren alle Zieltypen inklusive `Halbvermindert`.
- Beispielhaft sind neue Akkorde wie `B-Dur`, `Cis-Moll`, `Dis7`, `Fismaj7`, `Gism7b5`, `Badd9` vorhanden.
- Akkorduebersicht zeigt und filtert `B`, `Cis`, `Dis`, `Fis`, `Gis`.
- Akkord-Recorder enthaelt dieselben neuen Grundtonfamilien und sortiert sie korrekt.
- Jeder neue Griff hat genau sechs Saiteneintraege mit gueltigen Fingerangaben.
- Keine Kategorie referenziert unbekannte Akkorde.
- Bestehende Akkorde bleiben vorhanden, ausser der bewusst umbenannte `H7 (B7)`.

## Phasen

1. H7/B7-Bereinigung umsetzen und gezielt testen.
2. Zielmatrix-Test ergaenzen: 12 Grundtoene x alle Akkordfamilien inklusive halbvermindert.
3. Akkorddaten fuer fehlende Kombinationen ergaenzen, mit niedrigen vollen Standardgriffen oder niedrigen Barre-Griffen.
4. UI-Sortierung und Filter fuer 12 Grundtoene und neuen Typ erweitern.
5. Relevante Unit- und Smoke-Tests ausfuehren.
6. Nach Codeaenderungen `graphify update .` ausfuehren.

## Risiken

- Die Griffauswahl ist fachlich sensibel: Voller Klang, niedrige Lage und einfache Spielbarkeit sind nicht immer gleichzeitig optimal.
- Frozen-Fixtures koennen `H7 (B7)` als historischen Namen enthalten. Diese duerfen nicht blind migriert werden, wenn dadurch Pfade oder Snapshot-Erwartungen unnoetig instabil werden.
- Die vollstaendige Matrix vergroessert die Akkordmenge deutlich; Akkorduebersicht und Recorder muessen weiterhin bedienbar bleiben.
