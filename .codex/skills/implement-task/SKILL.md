---
name: implement-task
description: Implementiert einen bereits geplanten oder freigegebenen Task sauber und verifizierbar. Verwenden, wenn der Nutzer nach einem Plan die Umsetzung freigibt, explizit $implement-task aufruft oder eine geplante Aufgabe implementiert werden soll; dabei auf Architektur, SOLID, DRY, KISS, YAGNI, bestehende Projektmuster, Tests und begrenzte Aenderungen achten.
---

# Implement Task

## Zweck

Einen geplanten Task in funktionierenden Code ueberfuehren. Die Umsetzung folgt dem vorhandenen Plan, respektiert die bestehende Architektur und bleibt so klein, testbar und wartbar wie moeglich.

## Startregel

Vor der Umsetzung klaeren:
- Gibt es einen freigegebenen Plan oder eine eindeutig beschriebene Aufgabe?
- Sind fachliche Anforderungen und Akzeptanzkriterien ausreichend klar?
- Gibt es bestehende Projektmuster, die vor neuen Abstraktionen zu bevorzugen sind?

Wenn der Plan fehlt oder die Aufgabe fachlich mehrdeutig ist, nicht sofort implementieren. Erst einen kurzen Umsetzungsplan oder eine gezielte Rueckfrage liefern.

## Arbeitsablauf

1. Kontext aufnehmen
   - Den freigegebenen Plan, relevante Dateien, Tests und bestehende Patterns lesen.
   - Aktuellen Git-Status pruefen und fremde Aenderungen nicht zuruecksetzen.
   - Betroffene Module und Verantwortungsgrenzen identifizieren.

2. Umsetzung schneiden
   - In kleine, reviewbare Schritte zerlegen.
   - Zuerst Verhalten absichern, wenn das Risiko relevant ist.
   - Aenderungen auf den benoetigten Umfang begrenzen.

3. Implementieren
   - Bestehende Architektur und lokale Konventionen verwenden.
   - Neue Abstraktionen nur einfuehren, wenn sie echte Komplexitaet reduzieren oder ein vorhandenes Muster fortsetzen.
   - Keine ungeplanten Refactors, Umbenennungen oder Stilwechsel einbauen.

4. Verifizieren
   - Relevante Unit-, Integrations-, Smoke- oder E2E-Tests ausfuehren.
   - Bei UI-Aenderungen nach Moeglichkeit Browser-/Screenshot-Checks verwenden.
   - Lint oder Formatierung nur ausfuehren, wenn das Projekt es vorsieht oder die Aenderung es nahelegt.

5. Dokumentieren
   - Relevante Plan- oder Dokumentationsdateien aktualisieren, wenn der Task das verlangt.
   - Falls ein Plan vollstaendig erledigt ist, Status/Restpunkte sauber festhalten oder nach Projektkonvention verschieben.

## Programmierprinzipien

### SOLID

- Single Responsibility: Module, Funktionen und Controller nicht mit mehreren Gruenden fuer Aenderung ueberladen.
- Open/Closed: Erweiterungen bevorzugen, ohne stabile Kernlogik unnoetig aufzureissen.
- Liskov Substitution: Bestehende Schnittstellen nicht so aendern, dass Nutzer still brechen.
- Interface Segregation: Kleine, konkrete APIs statt breiter Alleskoenner-Schnittstellen.
- Dependency Inversion: Fachlogik nicht an UI, Browser-APIs oder konkrete Feature-Controller koppeln, wenn eine neutrale Schicht existiert.

### DRY, KISS, YAGNI

- DRY: Wiederholung entfernen, wenn sie echte Wartungskosten verursacht; keine abstrakte Vorwegnahme fuer nur hypothetische Faelle.
- KISS: Die einfachste robuste Loesung bevorzugen.
- YAGNI: Keine Features, Optionen oder Frameworks einfuehren, die fuer den Task nicht gebraucht werden.

### Architektur

- Abhaengigkeiten in die stabile Richtung fuehren: Feature-Code darf gemeinsame Domain-/Shared-Module nutzen, aber generische Komponenten sollen nicht an konkrete Features haengen.
- Fachlogik moeglichst rein und testbar halten.
- UI-, Persistenz-, Audio-, Netzwerk- und Browser-API-Zugriffe kapseln, wenn sie sonst Logik vermischen.
- Bestehende Dateistruktur und Namenskonventionen respektieren.

## Teststrategie

Die Tests am Risiko ausrichten:
- Pure Fachlogik: gezielte Unit-Tests.
- Controller/State-Flows: Integrationstests mit Mocks oder DOM-Harness.
- UI/Layout: Smoke-Tests, visuelle Checks oder Playwright, wenn vorhanden.
- Regressionen: erst einen fehlschlagenden Test ergaenzen, wenn der Bug klar reproduzierbar ist.

Wenn Tests nicht laufen oder aus Umgebungsgruenden nicht moeglich sind, den Grund im Abschluss nennen und die verbleibende Restunsicherheit beschreiben.

## Abschlussantwort

Kurz berichten:
- Was wurde umgesetzt?
- Welche Dateien sind relevant?
- Welche Tests/Checks wurden ausgefuehrt?
- Welche offenen Punkte oder Risiken bleiben?

Nicht mit allgemeinen Floskeln enden. Falls sinnvoll, einen konkreten naechsten Schritt nennen.
