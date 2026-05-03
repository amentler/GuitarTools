# Playwright-Testplan 2026-04-29

**Plan**
Ziel ist ein umsetzungsreifer, priorisierter Plan fuer den Ausbau der bestehenden Playwright-Suite in `tests/e2e/`. Der Fokus liegt auf stabilen Browser-Regressionstests fuer reale Nutzerfluesse, zunaechst ohne unnoetig hohe Flake-Gefahr durch komplexe Audio-Erkennung. Ein anderer Agent soll diesen Plan spaeter direkt in kleine, pruefbare Implementierungsschritte uebersetzen koennen.

Nach Abschluss der spaeteren Umsetzung soll Folgendes wahr sein:
- alle Top-Level-Seiten sind per Browser-Smoke-Test erreichbar
- kritische Navigation und der gemeinsame Rueckweg zum Hauptmenue sind abgesichert
- zentrale Nicht-Audio-Interaktionen fuer Metronom, Tuner, Notenlesen, Ton spielen, Noten spielen und Akkordfolgen-Trainer sind browserseitig regressionsgesichert
- Mikrofon-Fehlerpfade sind fuer alle relevanten Seiten reproduzierbar getestet
- Audio-getriebene E2E-Faelle werden nur dort erweitert, wo Fixtures nachweisbar deterministisch funktionieren

**Ausgangslage**
- Vorhanden sind bereits Playwright-Tests fuer `gt-fretboard`, den Akkord-Trainer und mehrere `chord-playing-essentia`-Faelle.
- `playwright.config.js` stellt bereits einen lauffaehigen Chromium-Stack mit Fake-Mikrofon und WAV-basierter Audioeinspeisung bereit.
- `gt-exercise-header` kapselt den gemeinsamen Rueck-Link nach `../../index.html`; das ist ein systemweit wiederkehrender Navigationsanker.
- Die App ist keine klassische SPA mit Router, sondern eine Sammlung einzelner HTML-Seiten unter `pages/*/index.html`. Der Plan muss deshalb seitenbasiert und nicht komponentenbasiert priorisieren.

**Fachliche Anforderungen**
- Die neuen Tests muessen primaer beobachtbares Verhalten absichern, nicht interne Implementierungsdetails.
- Jede neue Testsuite soll mit stabilen DOM-Ankern arbeiten, vorzugsweise bestehenden `id`-Selektoren und klaren Texten.
- Audio-lastige Tests sind nach Risiko zu staffeln:
  - zuerst UI-Flows und Fehlerpfade ohne echte Tonerkennung
  - danach deterministische Audio-Faelle mit bestehenden Fake-Audio-Mechanismen
  - keine neue Low-Level-Injection als erster Schritt
- Persistenz soll nur dort getestet werden, wo das Produkt sie explizit verspricht oder der Code sie bereits speichert:
  - Metronom: `metronome_bpm`, `metronome_beats`
  - Noten lesen: `sheetMusic_bpm`, `sheetMusic_timeSig`, `sheetMusic_showTab`, `sheetMusic_endless`
- Pro Seite sollen nur wenige, hochwertige Flows abgedeckt werden. Kein Aufblaehen durch jede moegliche UI-Kombination.
- Neue Tests muessen CI-tauglich bleiben:
  - keine visuellen Pixel-Vergleiche als Pflicht
  - keine Timing-Asserts gegen exakte Audio- oder Animationsmillisekunden
  - keine Assertions auf zufaellige Inhalte ohne vorherige Stabilisierung des Erwartungswerts

**Nicht-Ziele**
- Keine sofortige Vollabdeckung saemtlicher Audio-Erkennungspfade.
- Keine Browser-Tests fuer jede einzelne interne Hilfsfunktion.
- Keine parallele Erweiterung der bestehenden Unit-/Audio-Teststruktur.
- Keine PWA-Tiefentests ueber einen leichten Smoke-Check hinaus.

**Teststrategie**
- Testpyramide innerhalb Playwright:
  - Ebene 1: Navigation- und Page-Smokes
  - Ebene 2: deterministische UI- und Persistenz-Flows ohne Audio-Abhaengigkeit
  - Ebene 3: Permission-/Fehlerpfade fuer Mikrofon-Seiten
  - Ebene 4: gezielte Audio-Regressionen mit WAV-Fixtures
- Selektorstrategie:
  - bevorzugt `id`-Selektoren aus den HTML-Seiten
  - fuer wiederkehrende Komponenten direkte Suche nach `gt-exercise-header a.btn-back`
  - fuer aktive/inaktive Zustandswechsel CSS-Klassen wie `active`, `u-hidden`, `playing`
- Erwartungsstrategie:
  - sichtbare Panels, Button-Texte, Klassen, Zahlenlabels, Formularwerte
  - bei Persistenz immer echte Reload-Assertions statt nur `localStorage`-Inspektion
  - bei Zufallsinhalten nur auf Strukturwechsel testen, nicht auf konkrete Zufallswerte

**Kandidaten fuer neue Testdateien**
- `tests/e2e/navigation.spec.js`
- `tests/e2e/page-smoke.spec.js`
- `tests/e2e/metronome.spec.js`
- `tests/e2e/guitar-tuner-ui.spec.js`
- `tests/e2e/guitar-tuner-permission.spec.js`
- `tests/e2e/sheet-music-reading.spec.js`
- `tests/e2e/note-playing-ui.spec.js`
- `tests/e2e/note-playing-permission.spec.js`
- `tests/e2e/sheet-music-mic-ui.spec.js`
- `tests/e2e/sheet-music-mic-permission.spec.js`
- `tests/e2e/akkordfolgen-trainer-ui.spec.js`
- `tests/e2e/akkordfolgen-trainer-permission.spec.js`
- spaeter optional:
  - `tests/e2e/note-playing-audio.spec.js`
  - `tests/e2e/sheet-music-mic-audio.spec.js`
  - `tests/e2e/guitar-tuner-audio.spec.js`
  - `tests/e2e/pwa-smoke.spec.js`

**Fachliche Testfaelle**

1. Navigation und System-Smoke
- Hauptmenue auf `index.html` rendert alle Menuekarten fuer Uebungen, Uebungen mit Gitarre und Werkzeuge.
- Jede Top-Level-Seite ist vom Hauptmenue erreichbar und laedt ohne offensichtlichen Initialisierungsfehler.
- Auf jeder Unterseite ist der gemeinsame Rueck-Link sichtbar und fuehrt zur Startseite zurueck.
- Mindestmenge der Zielseiten:
  - `pages/fretboard-tone-recognition/index.html`
  - `pages/sheet-music-reading/index.html`
  - `pages/akkord-trainer/index.html`
  - `pages/ton-finder/index.html`
  - `pages/note-playing/index.html`
  - `pages/sheet-music-mic/index.html`
  - `pages/chord-playing-essentia/index.html`
  - `pages/akkordfolgen-trainer/index.html`
  - `pages/guitar-tuner/index.html`
  - `pages/metronome/index.html`
  - `pages/akkord-uebersicht/index.html`
- Akzeptanzkriterium:
  - die Seite zeigt einen spezifischen Primaranker und bleibt interagierbar

2. Metronom
- Start/Stop schaltet den Buttontext zwischen `Start` und `Stop` und setzt die Klasse `playing`.
- BPM-Slider aendert Anzeige und Wert konsistent.
- `-5`, `-1`, `+1`, `+5` passen BPM sichtbar an.
- Taktart-Select aendert den gewaehlten Wert.
- Reload uebernimmt gespeicherte BPM und Taktart.
- Akzeptanzkriterium:
  - `#metronome-bpm-value`, `#metronome-bpm-slider`, `#metronome-beats-select`, `#btn-metronome-toggle` bleiben nach Interaktion synchron

3. Gitarren-Tuner UI
- Standardmodus ist initial aktiv.
- Wechsel auf chromatisch setzt aktive Klasse korrekt um.
- Start des gefuehrten Stimmens blendet Startpanel aus und Aktivpanel ein.
- `Weiter` wechselt auf den naechsten Schritt und aktualisiert Zielsaite/Zielton.
- `Beenden` bringt den Nutzer in einen beendeten oder neutralen Zustand zurueck, ohne haengenden Aktivscreen.
- `Nochmal stimmen` startet den Ablauf erneut.
- `Fertig` beendet den gefuehrten Modus und laesst die Seite bedienbar zurueck.
- Akzeptanzkriterium:
  - Panelwechsel nur ueber sichtbare Klassen und konkrete Zieltexte verifizieren

4. Gitarren-Tuner Permission-Failure
- Wenn `getUserMedia` abgelehnt wird, erscheint die Fehlermeldung in `#tuner-permission`.
- Die Seite soll trotz Fehler nicht abstuerzen; Mode-Toggle und Ruecknavigation bleiben nutzbar.
- Akzeptanzkriterium:
  - Fehlertext enthaelt sinngemaess `Mikrofon nicht verfuegbar`

5. Noten lesen
- Seite rendert initial Notensystem in `#score-container`.
- `Tabs anzeigen` toggelt den aktiven Zustand.
- Der Endlos-Button `#btn-endless-mode` toggelt den aktiven Zustand.
- BPM-Slider aktualisiert Label und Wert.
- Taktart-Select uebernimmt den neuen Wert.
- `Neue Takte` regeneriert den Inhalt, ohne die Seite in einen leeren Fehlerzustand zu bringen.
- Reload uebernimmt BPM, Taktart, Tab-Modus und Endless-Modus.
- Optional spaeter: Tastaturkuerzel fuer Play, neue Takte, Tabs und Endless.
- Akzeptanzkriterium:
  - `#score-container` bleibt nach jeder Interaktion gefuellt

6. Ton spielen UI
- Seite rendert initial Notation und einen verdeckten Zielton.
- `Hilfe 1` blendet den Notennamen ein.
- `Hilfe 2` blendet Tabpositionen ein.
- `Weiter` erzeugt eine neue Runde und setzt Hinweise/Feedback zurueck.
- Aenderung des Bund-Sliders setzt den Durchgang zurueck und aktualisiert das Label.
- Aktivieren/Deaktivieren von Saiten setzt den Durchgang ebenfalls zurueck.
- Akzeptanzkriterium:
  - Zieltonanzeige, Tabbereich und Feedback wechseln nachvollziehbar zwischen verborgen, sichtbar und zurueckgesetzt

7. Ton spielen Permission-Failure
- Wenn `getUserMedia` abgelehnt wird, erscheint die Fehlermeldung in `#note-play-permission`.
- Der statische UI-Teil der Aufgabe bleibt sichtbar: Notation, Hilfebuttons, Ruecknavigation, Settings.
- Akzeptanzkriterium:
  - kein Harterror und weiterhin bedienbare Nicht-Audio-UI

8. Noten spielen UI
- Seite rendert Notensystem, Score im Header und aktuellen Notenindikator.
- `Hoeren starten` blendet auf Stopp-Zustand um.
- `Stopp` kehrt in den Start-Zustand zurueck.
- `Neue Noten` regeneriert die Uebung und setzt Status/Fokus auf den ersten Ton.
- Moduswechsel zwischen `Einfach` und `Schwer` aktualisiert das Select stabil.
- Bund-Slider und Saiten-Toggles bleiben interagierbar.
- Nach abgeschlossenem Ablauf soll die UI einen Abschlusszustand anzeigen; falls dies ohne Audio nicht deterministisch erreichbar ist, wird dieser Fall in die spaetere Audio-Phase verschoben.
- Akzeptanzkriterium:
  - Start-/Stopp-Buttons sind nie gleichzeitig sichtbar

9. Noten spielen Permission-Failure
- Wenn `getUserMedia` abgelehnt wird, zeigt `#sheet-mic-permission` die Fehlermeldung.
- Trotz Fehler bleiben `Neue Noten`, Moduswahl und Ruecknavigation erreichbar.

10. Akkordfolgen-Trainer UI
- Setup-Panel rendert Tonart, Akkordfolge, BPM, Schlaege/Akkord und Startbutton.
- Zufallsfolge setzt den Toggle-Zustand sichtbar.
- Auswahl einer festen Folge setzt den Random-Zustand zurueck.
- BPM-Slider und BPM-Buttons aktualisieren das Label konsistent.
- Schlaege/Akkord-Select uebernimmt den Wert.
- Start blendet Setup aus und Aktivpanel ein.
- Aktivpanel zeigt Progressionsanzeige, Akkordname, Numeral, Beat-Dots und Stopp.
- Stopp fuehrt in die Zusammenfassung.
- `Nochmal` startet erneut aus der Summary.
- `Neue Einstellungen` fuehrt zurueck ins Setup.
- Akzeptanzkriterium:
  - Setup, Aktiv und Summary sind sauber gegeneinander exklusiv sichtbar

11. Akkordfolgen-Trainer Permission-Failure
- Bei abgelehntem Mikrofonzugriff erscheint die Fehlermeldung in `#aft-permission`.
- Der Startversuch darf keinen haengenden Zwischenzustand hinterlassen.
- Der Nutzer muss im Setup verbleiben oder sauber dorthin zurueckkehren.

12. Sekundaere PWA-/Infra-Smokes
- Startseite referenziert `manifest.json`.
- Service-Worker-Registrierung wird versucht.
- Dieser Block ist nachrangig und darf nur umgesetzt werden, wenn er ohne hohe CI-Empfindlichkeit pruefbar bleibt.

**Technisches Vorgehen**
- Bestehende Playwright-Muster wiederverwenden:
  - `page.goto('/pages/.../index.html')`
  - einfache `expect(locator).toBeVisible()`
  - wo noetig `force: true` nur fuer SVG/Fretboard-Interaktionen
- Gemeinsame Helfer mit Augenmass einfuehren, aber nur wenn mindestens 2 Tests davon profitieren:
  - Navigation zu einer Seite plus Rueckweg-Assertion
  - Mikrofonablehnung per `page.addInitScript(...)` oder Kontext-Override
  - optionale Console-Fehler-Sammlung fuer reine Smoke-Suites
- Keine grosse Helper-Abstraktion vor dem ersten Satz konkreter Tests. Erst 2-3 Specs normal schreiben, dann Duplikate schneiden.
- Permission-Failure vorzugsweise seitenlokal mocken statt globale Config umzubauen.
- Audio-Fixtures nur auf bestehender `PLAYWRIGHT_FAKE_AUDIO_PATH`-Infrastruktur aufsetzen.

**Empfohlene Phasen**

**Phase 1: Navigation und Page-Smokes**
- Ziel:
  - systemweite Regressionen durch fehlende Seiten, gebrochene Links oder Initialisierungsfehler frueh erkennen
- Umsetzung:
  - `navigation.spec.js`
  - `page-smoke.spec.js`
- Validierung:
  - alle Top-Level-Seiten laden
  - Rueck-Link auf Unterseiten funktioniert
- Erfolgskriterium:
  - ein schneller Basissatz, der bei kaputten Imports, 404s oder fehlenden DOM-Ankern rot wird

**Phase 2: Persistenz und stabile Nicht-Audio-Flows**
- Ziel:
  - hochwertige, wenig flakey Kerninteraktionen absichern
- Umsetzung:
  - `metronome.spec.js`
  - `sheet-music-reading.spec.js`
  - `guitar-tuner-ui.spec.js`
  - `note-playing-ui.spec.js`
  - `sheet-music-mic-ui.spec.js`
  - `akkordfolgen-trainer-ui.spec.js`
- Validierung:
  - sichtbare Panelwechsel
  - Button-/Klassenwechsel
  - Reload-basierte Persistenz
- Erfolgskriterium:
  - wichtigste Alltagsfluesse sind ohne Audioabhaengigkeit regressionsgesichert

**Phase 3: Permission- und Fehlerpfade**
- Ziel:
  - negative Browserpfade absichern, die produktiv haeufig auftreten koennen
- Umsetzung:
  - je eine spezialisierte Spec oder klar abgegrenzte `describe`-Bloecke fuer Tuner, Ton spielen, Noten spielen, Akkordfolgen-Trainer
- Validierung:
  - Fehlermeldung sichtbar
  - UI bleibt navigierbar
  - kein inkonsistenter Zwischenzustand
- Erfolgskriterium:
  - Mikrofonseiten verhalten sich reproduzierbar bei verweigertem Zugriff

**Phase 4: Audio-getriebene Regressionen**
- Ziel:
  - dort erweitern, wo sichtbarer Nutzwert hoch und Fixture-Stabilitaet nachweisbar ist
- Umsetzung:
  - zunaechst `note-playing-audio.spec.js` und `sheet-music-mic-audio.spec.js`
  - Tuner-Audio nur, wenn mindestens ein stabiler, schmaler Erkennungsfall gefunden wird
- Validierung:
  - bestehende Fake-Audio-Infrastruktur reicht ohne invasive Testhacks
  - gruen ueber mehrere lokale Wiederholungen
- Erfolgskriterium:
  - mindestens ein verlaesslicher positiver Audio-Flow pro neuem Audio-Feature

**Phase 5: Sekundaere Erweiterungen**
- Ziel:
  - nuetzliche, aber nicht kritische Zusatzabdeckung
- Umsetzung:
  - Console-Error-Smokes fuer Kernseiten
  - PWA-Smoke
  - Tastaturkuerzel fuer Noten lesen
- Validierung:
  - nur behalten, wenn lokal und in CI stabil

**Priorisierung fuer den umsetzenden Agenten**
- Prioritaet A:
  - `navigation.spec.js`
  - `page-smoke.spec.js`
  - `metronome.spec.js`
  - `sheet-music-reading.spec.js`
- Prioritaet B:
  - `guitar-tuner-ui.spec.js`
  - `note-playing-ui.spec.js`
  - `akkordfolgen-trainer-ui.spec.js`
  - Permission-Failure-Specs
- Prioritaet C:
  - `sheet-music-mic-ui.spec.js`
  - neue Audio-Specs
  - PWA-/Keyboard-Zusatztests

**Erwartete technische Stolperstellen**
- Mehrere Seiten starten beim Mount sofort Mikrofonlogik. Permission-Tests muessen den Fehlerpfad gezielt und frueh injizieren.
- Zufaellige Inhalte duerfen nicht ueber konkrete Notennamen oder Folgen verifiziert werden, solange kein deterministischer Seed existiert.
- Einige Audio-Seiten enthalten asynchrone Timer und Uebergangsfenster; Asserts muessen auf Zustandswechsel statt feste Wartezeiten optimiert werden.
- Der Tuner hat komplexe Analyse- und Guided-State-Logik; fuer Phase 2 nur UI-Schritte absichern, nicht Tonerkennung.
- PWA-Registrierung kann unter lokalem Testserver und Playwright unterschiedlich reagieren; deshalb nur sekundaer.

**Risiken / Offene Fragen**
- `Blockierend`: Wie soll Mikrofonablehnung in den Tests am robustesten simuliert werden, ohne die produktive Config fuer alle Specs umzubauen?
  Default: pro Spec `getUserMedia` per Init-Script auf `Promise.reject(...)` setzen.
- `Wichtig`: Gibt es bereits intern bevorzugte Helper-Konventionen fuer E2E-Specs, oder soll der umsetzende Agent zunaechst ohne gemeinsame Helfer starten?
  Default: erst konkrete Specs schreiben, spaeter kleinstmoegliche Helper extrahieren.
- `Wichtig`: Soll `page-smoke.spec.js` auch Console-Errors failen lassen oder vorerst nur sichtbare Primaranker pruefen?
  Default: zuerst nur Primaranker; Console-Checks spaeter separat.
- `Wichtig`: Welche neuen WAV-Fixtures existieren bereits fuer Einzelnoten, und fuer welche Features muessen sie ggf. erst erzeugt werden?
  Default: Audio-Phase nur starten, wenn vorhandene oder schnell erzeugbare Fixtures nachweislich stabil sind.
- `Optional`: Soll die `Akkord Uebersicht` ausser Page-Smoke spaeter auch interaktive Filtertests erhalten?
  Default: nein, derzeit ausserhalb des Kernumfangs.

**Rueckfragen zur spaeteren Implementierung**
- `Blockierend`: Soll der umsetzende Agent im ersten Schritt nur Phase 1 und 2 liefern oder direkt auch Permission-Faelle?
  Default: Phase 1 und 2 zuerst, danach Permission-Faelle.
- `Wichtig`: Sollen neue Tests strikt dateiweise nach Feature getrennt werden, auch wenn einzelne Permission-Faelle klein sind?
  Default: ja, weil Fehlerpfade und Happy-Path-Flows unterschiedliche Stabilitaetsprofile haben.
- `Wichtig`: Ist fuer Audio-E2E eine gruen bleibende lokale Wiederholungspflicht gewuenscht, bevor der Agent weitere Audio-Specs eincheckt?
  Default: ja, mindestens mehrere aufeinanderfolgende Durchlaeufe lokal.
- `Optional`: Soll fuer Navigation/Page-Smokes spaeter eine mobile Browser-Matrix hinzukommen?
  Default: nein, vorerst nur bestehendes Chromium-Desktop-Projekt.

**Konkrete Umsetzungshinweise fuer den anderen Agenten**
- Reihenfolge:
  1. schnelle Smokes
  2. Persistenz und UI-Flows
  3. Permission-Faelle
  4. Audio-Flows
- Pro neuer Spec zuerst kleinsten roten Fall formulieren und lokal isoliert laufen lassen.
- Bestehende gruene Akkord-/Fretboard-Specs nicht unnoetig umbauen; nur Muster angleichen, wenn echter Mehrwert entsteht.
- Bei jeder Seite zunaechst einen stabilen Primaranker und einen stabilen Interaktionsanker festlegen.
- Wenn sich Selektoren als fragil erweisen, lieber kleine produktive Testanker spaeter explizit planen statt textbasierte Workarounds zu stapeln.

Ich starte mit der Umsetzung erst, wenn du den Plan freigibst.
