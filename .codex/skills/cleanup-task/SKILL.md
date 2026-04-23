---
name: cleanup-task
description: Raeumt nach einer Implementierung erledigte Plan- oder Task-Arbeit auf, indem vollstaendig erledigte Dateien nach old verschoben oder erledigte Teilphasen/Abschnitte im aktiven Plan abgehakt bzw. in old ausgelagert werden. Verwenden, wenn der Nutzer nach der Umsetzung Cleanup, Archivierung, Aufraeumen von Plans/Tasks, Abschluss einer Phase/eines Plan-Teils oder $cleanup-task verlangt; offene, teilweise erledigte oder unklare Arbeit darf nicht als erledigt archiviert werden.
---

# Cleanup Task

## Zweck

Nach einer Implementierung die zugehoerigen Plan- oder Task-Dateien pruefen und erledigte Arbeit sauber abschliessen. Das kann bedeuten:
- eine vollstaendig erledigte Datei in das passende `old`-Verzeichnis verschieben
- einen erledigten Teil im aktiven Plan abhaken oder als abgeschlossen markieren
- einen erledigten Abschnitt aus einem aktiven Plan ausschneiden und in eine Old-/Archivdatei verschieben, waehrend offene Teile im Planordner bleiben

Der Cleanup soll den Arbeitsstand klar halten, ohne offene Arbeit versehentlich zu archivieren.

## Grundregel

Nur als erledigt markieren oder verschieben, was wirklich abgeschlossen ist.

Eine ganze Datei nur verschieben, wenn die gesamte Datei abgeschlossen ist.

Wenn nur ein Teil einer Phase oder eines Plans erledigt ist:
- die aktive Datei behalten
- den erledigten Teil dort abhaken oder als abgeschlossen markieren
- optional den erledigten Teil in eine passende Datei unter `old` auslagern, wenn der Plan dadurch uebersichtlicher wird
- alle offenen Abschnitte, TODOs und naechsten Phasen im aktiven Plan lassen

Nicht als erledigt behandeln bei:
- offenen Anforderungen, Restproblemen oder TODOs im betroffenen Abschnitt
- Status wie `geplant`, `in Umsetzung`, `vorbereitet`, `teilweise umgesetzt`, `offen`
- fehlender Verifikation oder unklarem Bezug zur gerade implementierten Aufgabe
- unklarer Trennlinie zwischen erledigtem und offenem Inhalt
- Dateien, die reine Backlogs, Ideensammlungen oder Sammel-Roadmaps mit offenen Eintraegen sind

Im Zweifel die Datei aktiv lassen und im Abschluss nennen, warum sie nicht oder nur teilweise bereinigt wurde.

## Arbeitsablauf

1. Kontext pruefen
   - Aktuellen Git-Status lesen.
   - Relevante Plan-/Task-Dateien identifizieren, typischerweise unter `plans/`, `tasks/`, `docs/plans/` oder projektlokalen Planordnern.
   - Bereits vorhandene `old`-Verzeichnisse erkennen.

2. Erledigung bewerten
   - Dateiinhalt lesen, nicht nur Dateiname oder Statuszeile.
   - Gegen die implementierte Aenderung und vorhandene Tests/Dateien plausibilisieren.
   - Auf offene Abschnitte wie `Offen`, `Noch offen`, `Risiken`, `Naechste Schritte`, `TODO`, `Restprobleme` achten.
   - Klaeren, ob die ganze Datei erledigt ist oder nur ein Abschnitt/eine Phase/ein Punkt.

3. Zielverzeichnis bestimmen
   - Im selben Planordner ein `old`-Verzeichnis verwenden, z. B. `plans/old/`.
   - Falls das Projekt eine andere Archivkonvention nutzt, diese befolgen.
   - `old` anlegen, wenn es fehlt und eindeutig der richtige Ort ist.

4. Cleanup-Art waehlen
   - Ganze Datei erledigt: Datei nach `old` verschieben.
   - Teil erledigt, Rest offen: aktive Datei bearbeiten und nur den erledigten Teil abhaken/als abgeschlossen markieren.
   - Teil erledigt, Plan wird sonst unuebersichtlich: erledigten Abschnitt in eine Archivdatei unter `old` verschieben und im aktiven Plan eine kurze Abschlussnotiz oder Referenz lassen.
   - Unklarer Status: nichts verschieben, nichts abhaken, Begruendung melden.

5. Aendern oder verschieben
   - Nur eindeutig erledigte Dateien oder Abschnitte verschieben.
   - Offene Inhalte im aktiven Planordner lassen.
   - Beim Ausschneiden eines Abschnitts die Ueberschriftenstruktur im aktiven Plan intakt halten.
   - Archivierte Teilabschnitte mit Quelle, Datum und kurzem Kontext versehen, falls eine neue Old-Datei entsteht.
   - Keine fremden oder unzusammenhaengenden Dateien anfassen.

6. Abschluss pruefen
   - Git-Status kontrollieren.
   - Kurz berichten, welche Dateien verschoben, welche Abschnitte abgehakt oder ausgelagert und welche bewusst nicht bereinigt wurden.

## Bewertungsheuristik

Eine Datei ist archivierungsreif, wenn alle Punkte zutreffen:
- Die beschriebene Aufgabe ist implementiert.
- Fachliche Akzeptanzkriterien sind erfuellt oder nicht mehr relevant.
- Relevante Tests/Checks wurden ausgefuehrt oder die fehlende Verifikation ist nachvollziehbar und nicht blockierend.
- Es gibt keine offenen Muss-Punkte im Dokument.
- Das Dokument ist kein laufender Sammelbacklog.

Eine Datei bleibt aktiv, wenn einer dieser Punkte zutrifft:
- Es gibt noch fachliche Restfaelle.
- Das Dokument beschreibt weitere Phasen, die noch nicht umgesetzt sind.
- Es ist eine Ideensammlung oder Roadmap mit mehreren offenen Themen.
- Der aktuelle Code zeigt, dass die Umsetzung nur teilweise vorhanden ist.

Ein Abschnitt ist teil-cleanup-reif, wenn alle Punkte zutreffen:
- Der Abschnitt beschreibt eine klar abgrenzbare Phase, Teilaufgabe oder Akzeptanzkriterium.
- Genau dieser Teil wurde umgesetzt und plausibel verifiziert.
- Nach dem Entfernen oder Abhaken bleibt der Restplan verstaendlich.
- Es gibt keine offenen Muss-Punkte innerhalb dieses Abschnitts.

Teil-Cleanup ist nicht geeignet, wenn der erledigte Teil quer ueber viele offene Abschnitte verteilt ist oder das Ausschneiden den Plan schwerer verstaendlich machen wuerde. Dann lieber den erledigten Stand markieren und den offenen Rest explizit stehen lassen.

## Befehle

Bevorzugte Inspektionsbefehle:
- `find <ordner> -type f -name '*.md'`
- `rg -n "Status|Offen|Noch offen|TODO|Rest|geplant|in Umsetzung|teilweise|abgeschlossen" <ordner>`
- `git status --short`

Zum Verschieben normale Shell-Befehle verwenden, z. B.:

```bash
mkdir -p plans/old
mv plans/example-task.md plans/old/
```

Fuer Teil-Cleanup Dateien mit `apply_patch` bearbeiten. Keine aktiven Planinhalte per blindem `sed`/`perl` umschreiben.

Beispiel fuer eine Archivdatei bei ausgelagertem Abschnitt:

```markdown
# Archiv: <Planname> - <Abschnitt>

Quelle: `plans/example-task.md`
Archiviert: YYYY-MM-DD
Grund: Abschnitt umgesetzt und verifiziert.

## Erledigter Abschnitt

...
```

## Abschlussantwort

Kurz und konkret berichten:
- Verschoben: Liste der Dateien.
- Abgehakt/aktualisiert: aktive Plan-Dateien mit kurzer Beschreibung.
- Ausgelagert: Archivdateien fuer erledigte Teilabschnitte.
- Nicht verschoben: nur relevante Grenzfaelle mit kurzer Begruendung.
- Verifikation: Git-Status oder Hinweis, dass nur Plan-/Archivdateien geaendert wurden.
