# 5 Übungs- und Tool-Ideen für GuitarTools (Einsteiger)

Bestehende Features: Griffbrett-Tonerkennung, Stimmgerät, Noten lesen.

---

## 1. 🥁 Metronom
**Typ:** Tool  
**Beschreibung:** Einstellbares Metronom mit BPM-Slider (40–240), Tap-Tempo-Button und visuellem Takt-Blinker. Optional: Betonung des ersten Schlags (Zähler). Kein Mikrofon nötig – reines Web Audio API Tick-Signal.  
**Warum geeignet:** Absolutes Basis-Tool für jeden Musiker. Extrem einfach zu implementieren, hoher Nutzwert vom ersten Übe-Tag an.

---

## 2. 🎸 Akkord-Trainer
**Typ:** Übung  
**Beschreibung:** Ein zufälliger Akkordname (C, G, Em, Am, D, F…) wird angezeigt. Der Nutzer sieht ein leeres Griffbrett-Diagramm und wählt per Tipp auf Saite+Bund die Finger­position. Richtige Töne werden grün markiert, falsche rot. Einsteigerprogression: erst offene Akkorde, dann Barré.  
**Warum geeignet:** Akkorde lernen ist der erste große Schritt für Anfänger. Visuelles Feedback direkt auf dem Griffbrett-Diagramm ist intuitiv.

---

## 3. 🎵 Intervall-Gehörtraining
**Typ:** Übung  
**Beschreibung:** Zwei aufeinanderfolgende Töne werden auf dem Bildschirm gezeigt (z. B. C → E). Der Nutzer wählt das Intervall aus einer Liste (Sekunde, Terz, Quarte…). Später-Modus: nur Tonname, kein Griffbrett. Passt gut zum bestehenden `fretboardLogic.js`-Berechnungs-Code.  
**Warum geeignet:** Gehörbildung ist zentral fürs Musizieren. Baut auf vorhandener Note-Logik auf, kaum Neu-Code nötig.

---

## 4. 🗺️ Skalenvisualisierer
**Typ:** Tool  
**Beschreibung:** Auswahl aus gängigen Skalen (C-Dur, A-Moll-Pentatonik, Blues-Skala…) und Grundton. Das gesamte Griffbrett zeigt alle Töne der Skala farbig an – Grundton in Akzentfarbe, übrige Töne in Sekundärfarbe. Kein Scoring, reines Nachschlage-/Übungstool.  
**Warum geeignet:** Pentatonik-Patterns sind das Erste, was Einsteiger für Soli lernen. Baut direkt auf dem bestehenden `fretboardSVG.js` auf.

---

## 5. 🔍 Ton-Finder (Griffbrett-Quiz umgekehrt)
**Typ:** Übung  
**Beschreibung:** Inverse der bestehenden Griffbrett-Übung: Ein **Tonname** wird angezeigt (z. B. „G"), der Nutzer tippt auf **alle** Stellen des Griffbretts, an denen dieser Ton vorkommt. Punkte für jede richtig gefundene Position, Abzug für Fehler. Einstellbar: nur offene Lagen oder bis Bund 12.  
**Warum geeignet:** Fretboard-Mapping ist eine Schwäche vieler Gitarristen. Dreht das vorhandene Spielprinzip einfach um – großer Lerneffekt, minimaler Implementierungsaufwand.
